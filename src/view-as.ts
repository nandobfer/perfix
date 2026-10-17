/**
 * "Visualizar como": simular um CARGO ou um USUÁRIO.
 *
 * Regras:
 *  - Só quem tem o coringa `*` simula (`canSimulate`).
 *  - O contexto efetivo NUNCA vê mais que o real: permissões, escopos e acessos são a
 *    INTERSEÇÃO entre o real de quem simula e o do alvo.
 *  - Escopo restrito com lista vazia continua vazio (nunca global).
 *
 * Também traz o formato de transporte (cabeçalho/cookie) e a validação estrita dele.
 * Módulo ISOMÓRFICO e sem dependências.
 */

import { WILDCARD } from "./catalog"
import { expandPermissions, intersectPermissions, type EffectivePermissions, type RoleLike } from "./permission-set"
import type { ScopeDimension, ScopeResult, ScopeValue } from "./scopes"

/**
 * O que está sendo simulado.
 * - `cargo`: um cargo ativo; `escolhas` traz o valor escolhido para escopos que o cargo restringe
 *   e que a aplicação pede ao simulador (ex.: `{ filial: "<id>" }`).
 * - `usuario`: as atribuições exatas de outro usuário (id do provedor de identidade ou da aplicação).
 */
export type ViewAs =
    | { readonly tipo: "cargo"; readonly roleId: string; readonly escolhas?: Readonly<Record<string, string>> }
    | { readonly tipo: "usuario"; readonly userId: string }

/** Marcador gravado em auditoria e logs durante a simulação. */
export interface ViewAsMarker {
    readonly tipo: ViewAs["tipo"]
    readonly alvoId: string
    readonly alvoNome: string
    /** Escolhas aplicadas (ex.: `{ filial: "<id>" }`). */
    readonly escolhas?: Readonly<Record<string, string>>
}

/** Só o coringa simula. */
export function canSimulate(effective: EffectivePermissions): boolean {
    return effective.has(WILDCARD)
}

/** Permissões efetivas da simulação = real ∩ união dos cargos ativos do alvo. */
export function simulatedPermissions(real: EffectivePermissions, roles: readonly RoleLike[]): EffectivePermissions {
    return intersectPermissions(real, expandPermissions(roles))
}

// ---------------------------------------------------------------------------
// Interseções
// ---------------------------------------------------------------------------

/** `global ∩ X = X`; `values ∩ values` = valores em comum (vazio continua vazio). */
export function intersectScopeDimension(a: ScopeDimension | undefined, b: ScopeDimension | undefined): ScopeDimension | undefined {
    if (!a) return b
    if (!b) return a
    if (a.kind === "global") return b
    if (b.kind === "global") return a
    const set = new Set<ScopeValue>(b.values)
    return { kind: "values", values: a.values.filter((value) => set.has(value)) }
}

/** Interseção de dois escopos resolvidos: só é permitido se os dois permitirem. */
export function intersectScopeResults<S extends string>(a: ScopeResult<S>, b: ScopeResult<S>): ScopeResult<S> {
    if (!a.allowed || !b.allowed) return { allowed: false }
    const names = new Set<S>([...(Object.keys(a.dimensions) as S[]), ...(Object.keys(b.dimensions) as S[])])
    const dimensions: Partial<Record<S, ScopeDimension>> = {}
    for (const name of names) {
        const dim = intersectScopeDimension(a.dimensions[name], b.dimensions[name])
        if (dim) dimensions[name] = dim
    }
    return { allowed: true, dimensions }
}

/** Acesso a um conjunto de itens (ex.: quais "espaços" o usuário acessa): todos ou alguns. */
export type AccessSet = { readonly kind: "all" } | { readonly kind: "values"; readonly values: readonly string[] }

export function intersectAccess(a: AccessSet, b: AccessSet): AccessSet {
    if (a.kind === "all") return b
    if (b.kind === "all") return a
    const set = new Set(b.values)
    return { kind: "values", values: a.values.filter((value) => set.has(value)) }
}

export function accessIncludes(access: AccessSet, value: string): boolean {
    return access.kind === "all" || access.values.includes(value)
}

// ---------------------------------------------------------------------------
// Transporte: validação estrita + codificação base64url (cabeçalho e cookie)
// ---------------------------------------------------------------------------

/** Cabeçalho que o cliente envia em toda requisição (`none` = sem simulação nesta aba). */
export const VIEW_AS_HEADER = "x-perfix-view-as"
export const VIEW_AS_NONE = "none"
/** Cookie com o mapa `{ abaId: ViewAs }` (espelho para Server Components). */
export const VIEW_AS_COOKIE = "perfix-view-as"
/** Cookie com o id da aba em foco. */
export const VIEW_AS_TAB_COOKIE = "perfix-view-as-tab"
/** Máximo de abas guardadas no cookie (as mais antigas saem). */
export const VIEW_AS_MAX_TABS = 10

const ID = /^[A-Za-z0-9:_.-]{1,128}$/
const MAX_ESCOLHAS = 8

const isId = (value: unknown): value is string => typeof value === "string" && ID.test(value)

/** Valida um valor desconhecido; qualquer desvio do formato → `null` (sem simulação). */
export function parseViewAs(value: unknown): ViewAs | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (record.tipo === "usuario") {
        const keys = Object.keys(record)
        if (!isId(record.userId) || keys.some((key) => key !== "tipo" && key !== "userId")) return null
        return { tipo: "usuario", userId: record.userId }
    }
    if (record.tipo === "cargo") {
        const keys = Object.keys(record)
        if (!isId(record.roleId) || keys.some((key) => !["tipo", "roleId", "escolhas"].includes(key))) return null
        if (record.escolhas === undefined) return { tipo: "cargo", roleId: record.roleId }
        const escolhas = record.escolhas
        if (!escolhas || typeof escolhas !== "object" || Array.isArray(escolhas)) return null
        const entries = Object.entries(escolhas as Record<string, unknown>)
        if (entries.length > MAX_ESCOLHAS || entries.some(([name, id]) => !ID.test(name) || !isId(id))) return null
        return entries.length === 0
            ? { tipo: "cargo", roleId: record.roleId }
            : { tipo: "cargo", roleId: record.roleId, escolhas: Object.fromEntries(entries) as Record<string, string> }
    }
    return null
}

function toBase64Url(text: string): string {
    const bytes = new TextEncoder().encode(text)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): string | null {
    if (!/^[A-Za-z0-9_-]*$/.test(value)) return null
    try {
        const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"))
        return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
    } catch {
        return null
    }
}

function decodeJson(raw: string): unknown {
    const text = fromBase64Url(raw)
    if (text === null) return undefined
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

export function encodeViewAs(viewAs: ViewAs): string {
    return toBase64Url(JSON.stringify(viewAs))
}

export function decodeViewAs(raw: string): ViewAs | null {
    return parseViewAs(decodeJson(raw))
}

export type ViewAsTabMap = Readonly<Record<string, ViewAs>>

export function encodeViewAsTabMap(map: ViewAsTabMap): string {
    return toBase64Url(JSON.stringify(map))
}

/** Mapa de abas do cookie; entradas inválidas são descartadas. */
export function decodeViewAsTabMap(raw: string | null | undefined): Record<string, ViewAs> {
    if (!raw) return {}
    const value = decodeJson(raw)
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const out: Record<string, ViewAs> = {}
    for (const [tab, item] of Object.entries(value as Record<string, unknown>)) {
        const viewAs = isId(tab) ? parseViewAs(item) : null
        if (viewAs) out[tab] = viewAs
    }
    return out
}

/** Atualiza a entrada da aba (ou remove com `null`), mantendo no máximo `VIEW_AS_MAX_TABS`. */
export function updateViewAsTabMap(map: ViewAsTabMap, tabId: string, viewAs: ViewAs | null): Record<string, ViewAs> {
    const entries: Array<[string, ViewAs]> = Object.entries(map).filter(([tab]) => tab !== tabId)
    if (viewAs) entries.push([tabId, viewAs])
    return Object.fromEntries(entries.slice(Math.max(0, entries.length - VIEW_AS_MAX_TABS)))
}

export type ViewAsSource = "header" | "cookie" | "none"

export interface ReadViewAsInput {
    /** Valor do cabeçalho `x-perfix-view-as` (ausente = `null`). */
    header?: string | null
    /** Cookie com o mapa de abas. */
    tabMapCookie?: string | null
    /** Cookie com o id da aba em foco. */
    tabCookie?: string | null
}

export interface ReadViewAsResult {
    source: ViewAsSource
    viewAs: ViewAs | null
    /** Havia um valor, mas fora do formato (deve ser registrado em log). */
    invalid: boolean
}

/**
 * Lê a simulação da requisição. O cabeçalho vence o cookie; cabeçalho `none` desliga a simulação
 * mesmo com cookie (outra aba simulando). Sem cabeçalho, vale a entrada da aba em foco no cookie.
 */
export function readViewAs(input: ReadViewAsInput): ReadViewAsResult {
    const header = input.header?.trim()
    if (header) {
        if (header === VIEW_AS_NONE) return { source: "none", viewAs: null, invalid: false }
        const viewAs = decodeViewAs(header)
        return viewAs ? { source: "header", viewAs, invalid: false } : { source: "none", viewAs: null, invalid: true }
    }
    const tab = input.tabCookie?.trim()
    if (!tab || !input.tabMapCookie) return { source: "none", viewAs: null, invalid: false }
    if (!isId(tab)) return { source: "none", viewAs: null, invalid: true }
    const viewAs = decodeViewAsTabMap(input.tabMapCookie)[tab] ?? null
    return viewAs ? { source: "cookie", viewAs, invalid: false } : { source: "none", viewAs: null, invalid: false }
}

// ---------------------------------------------------------------------------
// Resolução (agnóstica de framework; a aplicação fornece os carregadores)
// ---------------------------------------------------------------------------

export interface ViewAsTarget<Extra> {
    id: string
    nome: string
    /** Usuário ativo (desativado, excluído ou convite pendente → `false`). */
    ativo: boolean
    /** Cargos atribuídos ao alvo (inativos são ignorados). */
    roles: readonly RoleLike[]
    extra?: Extra
}

/** `ok`: escolha válida; `pending`: falta escolher (escopo vazio até escolher); `invalid`: rejeita. */
export type ViewAsChoiceCheck = "ok" | "pending" | "invalid"

export interface ResolveViewAsInput<Extra> {
    real: { userId: string; nome: string; effective: EffectivePermissions }
    viewAs: ViewAs | null
    /** Cargo ATIVO pelo id, ou `null`. */
    loadRole(roleId: string): Promise<RoleLike | null>
    /** Alvo pelo id, ou `null` (excluído/desconhecido). */
    loadTarget(userId: string): Promise<ViewAsTarget<Extra> | null>
    /** Escopos cujo valor o simulador escolhe ao simular cargo (ex.: `["filial"]`). */
    choiceScopes?: readonly string[]
    /** Valida a escolha de um escopo (ex.: filial ativa e da empresa atual). */
    checkChoice?(scope: string, value: string | undefined): Promise<ViewAsChoiceCheck> | ViewAsChoiceCheck
}

export type ViewAsRejection = "ALVO" | "CARGO" | "ESCOLHA"

export interface ViewAsSubject<Extra> {
    tipo: ViewAs["tipo"]
    /** Id de quem é o "dono" dos itens (alvo ou o próprio simulador ao simular cargo). */
    id: string
    nome: string
    roles: RoleLike[]
    /** Atribuição extra do alvo (só ao simular usuário). */
    extra?: Extra
}

export type ViewAsResolution<Extra> =
    | { status: "none" }
    | { status: "forbidden" }
    | { status: "invalid"; motivo: ViewAsRejection }
    | {
          status: "ok"
          viewAs: ViewAs
          subject: ViewAsSubject<Extra>
          effective: EffectivePermissions
          marker: ViewAsMarker
          /** Escopos restritos que ainda aguardam a escolha (escopo vazio até lá). */
          pendingChoices: string[]
      }

/**
 * Revalida tudo a cada requisição: simulador com `*`, alvo ativo, cargo ativo e escolhas.
 * Nunca amplia: as permissões devolvidas já são a interseção com as reais.
 */
export async function resolveViewAs<Extra = unknown>(input: ResolveViewAsInput<Extra>): Promise<ViewAsResolution<Extra>> {
    const { real, viewAs } = input
    if (!viewAs) return { status: "none" }
    if (!canSimulate(real.effective)) return { status: "forbidden" }

    if (viewAs.tipo === "usuario") {
        const target = await input.loadTarget(viewAs.userId)
        if (!target || !target.ativo) return { status: "invalid", motivo: "ALVO" }
        const roles = target.roles.filter((role) => role.ativo !== false)
        const subject: ViewAsSubject<Extra> = { tipo: "usuario", id: target.id, nome: target.nome, roles, extra: target.extra }
        return {
            status: "ok",
            viewAs,
            subject,
            effective: simulatedPermissions(real.effective, roles),
            marker: { tipo: "usuario", alvoId: target.id, alvoNome: target.nome },
            pendingChoices: [],
        }
    }

    const role = await input.loadRole(viewAs.roleId)
    if (!role || role.ativo === false) return { status: "invalid", motivo: "CARGO" }

    const escolhas: Record<string, string> = {}
    const pendingChoices: string[] = []
    for (const scope of input.choiceScopes ?? []) {
        if (!(role.escopos ?? []).includes(scope)) continue
        const value = viewAs.escolhas?.[scope]
        const check = input.checkChoice ? await input.checkChoice(scope, value) : value ? "ok" : "pending"
        if (check === "invalid") return { status: "invalid", motivo: "ESCOLHA" }
        if (check === "pending" || !value) pendingChoices.push(scope)
        else escolhas[scope] = value
    }

    const hasChoices = Object.keys(escolhas).length > 0
    return {
        status: "ok",
        viewAs,
        subject: { tipo: "cargo", id: real.userId, nome: role.nome, roles: [role] },
        effective: simulatedPermissions(real.effective, [role]),
        marker: hasChoices
            ? { tipo: "cargo", alvoId: role.id, alvoNome: role.nome, escolhas }
            : { tipo: "cargo", alvoId: role.id, alvoNome: role.nome },
        pendingChoices,
    }
}
