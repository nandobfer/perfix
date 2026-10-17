/**
 * Escopos de dados GENERALIZADOS (row-level security definido pela aplicação).
 *
 * Substitui o escopo fixo de filial do Smart Desk. A aplicação:
 *  1. declara as dimensões com `defineScopes` (ex.: `filial`, `carteira`);
 *  2. marca, nos grupos do catálogo, quais escopos valem para as folhas (`scopes`);
 *  3. guarda em cada cargo os escopos que ele restringe (`escopos: string[]`);
 *  4. fornece os VALORES de cada escopo para o usuário no contexto (resolvedores).
 *
 * Regras:
 *  - Sem a permissão de visualização ⇒ `{ allowed: false }` (não vê nada).
 *  - Combinação entre cargos ativos: `restrictive` (padrão) — basta um cargo restringir;
 *    `permissive` — só restringe se TODOS os cargos ativos restringirem.
 *  - Escopo restrito com lista vazia ⇒ nenhum dado, nunca global.
 *  - Escopo não declarado pela folha é ignorado.
 *
 * A biblioteca NÃO monta consultas: a aplicação traduz o resultado em filtros.
 * Módulo ISOMÓRFICO.
 */

import type { Catalog } from "./catalog"
import { hasPermission, type EffectivePermissions, type RoleLike } from "./permission-set"

export type ScopeCombine = "restrictive" | "permissive"

export interface ScopeDef {
    readonly label: string
    readonly description?: string
    readonly combine?: ScopeCombine
}

export type ScopeDefs<S extends string = string> = { readonly [K in S]: ScopeDef }

export interface ScopeRegistry<S extends string = string> {
    readonly defs: ScopeDefs<S>
    readonly names: readonly S[]
    isKnownScope(name: string): name is S
    /** Remove nomes desconhecidos e duplicados, na ordem da declaração. */
    sanitize(names: Iterable<string>): S[]
}

export function defineScopes<const D extends Record<string, ScopeDef>>(
    defs: D,
): ScopeRegistry<Extract<keyof D, string>> {
    type S = Extract<keyof D, string>
    const names = Object.keys(defs) as S[]
    const known = new Set<string>(names)
    return {
        defs: defs as unknown as ScopeDefs<S>,
        names,
        isKnownScope: (name): name is S => known.has(name),
        sanitize: (input) => {
            const wanted = new Set(input)
            return names.filter((name) => wanted.has(name))
        },
    }
}

/** Valor de escopo; `null` representa "sem valor" (ex.: item sem responsável). */
export type ScopeValue = string | null

export type ScopeDimension =
    /** Não restrito: vê tudo nessa dimensão. */
    | { readonly kind: "global" }
    /** Restrito aos valores listados (lista vazia = nada). */
    | { readonly kind: "values"; readonly values: readonly ScopeValue[] }

export type ScopeResult<S extends string = string> =
    | { readonly allowed: false }
    | { readonly allowed: true; readonly dimensions: Readonly<Partial<Record<S, ScopeDimension>>> }

/** Escopos que os cargos ativos restringem, aplicando a combinação de cada dimensão. */
export function restrictedScopes<S extends string>(registry: ScopeRegistry<S>, roles: readonly RoleLike[]): S[] {
    const ativos = roles.filter((role) => role.ativo !== false)
    if (ativos.length === 0) return []

    return registry.names.filter((name) => {
        const combine = registry.defs[name].combine ?? "restrictive"
        const restringe = (role: RoleLike) => (role.escopos ?? []).includes(name)
        return combine === "restrictive" ? ativos.some(restringe) : ativos.every(restringe)
    })
}

export interface ComputeScopeInput<S extends string> {
    catalog: Catalog
    registry: ScopeRegistry<S>
    roles: readonly RoleLike[]
    effective: EffectivePermissions
    /** Folha de visualização do recurso consultado. */
    viewKey: string
    /** Valores já resolvidos para cada escopo restrito aplicável. */
    values: Readonly<Partial<Record<S, readonly ScopeValue[]>>>
}

/** Versão síncrona: recebe os valores já resolvidos. */
export function computeScope<S extends string>(input: ComputeScopeInput<S>): ScopeResult<S> {
    const { catalog, registry, roles, effective, viewKey, values } = input
    if (!hasPermission(effective, viewKey)) return { allowed: false }

    const aplicaveis = catalog.scopesFor(viewKey).filter((name): name is S => registry.isKnownScope(name))
    const restritos = new Set(restrictedScopes(registry, roles))

    const dimensions: Partial<Record<S, ScopeDimension>> = {}
    for (const name of aplicaveis) {
        dimensions[name] = restritos.has(name) ? { kind: "values", values: [...(values[name] ?? [])] } : { kind: "global" }
    }
    return { allowed: true, dimensions }
}

export type ScopeResolver<Ctx> = (ctx: Ctx) => Promise<readonly ScopeValue[]> | readonly ScopeValue[]
export type ScopeResolvers<S extends string, Ctx> = { readonly [K in S]: ScopeResolver<Ctx> }

export interface ResolveScopeInput<S extends string, Ctx> extends Omit<ComputeScopeInput<S>, "values"> {
    resolvers: ScopeResolvers<S, Ctx>
    ctx: Ctx
}

/** Versão assíncrona: chama os resolvedores apenas dos escopos restritos e aplicáveis. */
export async function resolveScope<S extends string, Ctx>(input: ResolveScopeInput<S, Ctx>): Promise<ScopeResult<S>> {
    const { catalog, registry, roles, effective, viewKey, resolvers, ctx } = input
    if (!hasPermission(effective, viewKey)) return { allowed: false }

    const restritos = new Set(restrictedScopes(registry, roles))
    const alvos = catalog
        .scopesFor(viewKey)
        .filter((name): name is S => registry.isKnownScope(name) && restritos.has(name as S))

    const values: Partial<Record<S, readonly ScopeValue[]>> = {}
    await Promise.all(
        alvos.map(async (name) => {
            values[name] = await resolvers[name](ctx)
        }),
    )
    return computeScope({ catalog, registry, roles, effective, viewKey, values })
}

/** `true` quando o escopo não permite ver nada — atalho para curto-circuitar a consulta. */
export function isEmptyScope(result: ScopeResult): boolean {
    if (!result.allowed) return true
    return Object.values<ScopeDimension | undefined>(result.dimensions).some(
        (dim) => dim?.kind === "values" && dim.values.length === 0,
    )
}

/** `true` quando um valor passa numa dimensão (útil para checar um registro já carregado). */
export function matchesDimension(dim: ScopeDimension | undefined, value: ScopeValue): boolean {
    if (!dim || dim.kind === "global") return true
    return dim.values.includes(value)
}

/** `true` quando um registro (valores por escopo) está dentro do escopo resolvido. */
export function isWithinScope<S extends string>(
    result: ScopeResult<S>,
    record: Readonly<Partial<Record<S, ScopeValue>>>,
): boolean {
    if (!result.allowed) return false
    return (Object.keys(result.dimensions) as S[]).every((name) =>
        matchesDimension(result.dimensions[name], record[name] ?? null),
    )
}
