import { C as Catalog, a as RoleLike, E as EffectivePermissions } from './permission-set-B6UbcFOx.js';

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

type ScopeCombine = "restrictive" | "permissive";
interface ScopeDef {
    readonly label: string;
    readonly description?: string;
    readonly combine?: ScopeCombine;
}
type ScopeDefs<S extends string = string> = {
    readonly [K in S]: ScopeDef;
};
interface ScopeRegistry<S extends string = string> {
    readonly defs: ScopeDefs<S>;
    readonly names: readonly S[];
    isKnownScope(name: string): name is S;
    /** Remove nomes desconhecidos e duplicados, na ordem da declaração. */
    sanitize(names: Iterable<string>): S[];
}
declare function defineScopes<const D extends Record<string, ScopeDef>>(defs: D): ScopeRegistry<Extract<keyof D, string>>;
/** Valor de escopo; `null` representa "sem valor" (ex.: item sem responsável). */
type ScopeValue = string | null;
type ScopeDimension = 
/** Não restrito: vê tudo nessa dimensão. */
{
    readonly kind: "global";
}
/** Restrito aos valores listados (lista vazia = nada). */
 | {
    readonly kind: "values";
    readonly values: readonly ScopeValue[];
};
type ScopeResult<S extends string = string> = {
    readonly allowed: false;
} | {
    readonly allowed: true;
    readonly dimensions: Readonly<Partial<Record<S, ScopeDimension>>>;
};
/** Escopos que os cargos ativos restringem, aplicando a combinação de cada dimensão. */
declare function restrictedScopes<S extends string>(registry: ScopeRegistry<S>, roles: readonly RoleLike[]): S[];
interface ComputeScopeInput<S extends string> {
    catalog: Catalog;
    registry: ScopeRegistry<S>;
    roles: readonly RoleLike[];
    effective: EffectivePermissions;
    /** Folha de visualização do recurso consultado. */
    viewKey: string;
    /** Valores já resolvidos para cada escopo restrito aplicável. */
    values: Readonly<Partial<Record<S, readonly ScopeValue[]>>>;
}
/** Versão síncrona: recebe os valores já resolvidos. */
declare function computeScope<S extends string>(input: ComputeScopeInput<S>): ScopeResult<S>;
type ScopeResolver<Ctx> = (ctx: Ctx) => Promise<readonly ScopeValue[]> | readonly ScopeValue[];
type ScopeResolvers<S extends string, Ctx> = {
    readonly [K in S]: ScopeResolver<Ctx>;
};
interface ResolveScopeInput<S extends string, Ctx> extends Omit<ComputeScopeInput<S>, "values"> {
    resolvers: ScopeResolvers<S, Ctx>;
    ctx: Ctx;
}
/** Versão assíncrona: chama os resolvedores apenas dos escopos restritos e aplicáveis. */
declare function resolveScope<S extends string, Ctx>(input: ResolveScopeInput<S, Ctx>): Promise<ScopeResult<S>>;
/** `true` quando o escopo não permite ver nada — atalho para curto-circuitar a consulta. */
declare function isEmptyScope(result: ScopeResult): boolean;
/** `true` quando um valor passa numa dimensão (útil para checar um registro já carregado). */
declare function matchesDimension(dim: ScopeDimension | undefined, value: ScopeValue): boolean;
/** `true` quando um registro (valores por escopo) está dentro do escopo resolvido. */
declare function isWithinScope<S extends string>(result: ScopeResult<S>, record: Readonly<Partial<Record<S, ScopeValue>>>): boolean;

export { type ComputeScopeInput as C, type ResolveScopeInput as R, type ScopeCombine as S, type ScopeDef as a, type ScopeDefs as b, type ScopeDimension as c, type ScopeRegistry as d, type ScopeResolver as e, type ScopeResolvers as f, type ScopeResult as g, type ScopeValue as h, computeScope as i, defineScopes as j, isEmptyScope as k, isWithinScope as l, matchesDimension as m, restrictedScopes as n, resolveScope as r };
