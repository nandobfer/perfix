/**
 * ATRIBUIÇÕES do usuário: quais cargos ele tem (e dados extras definidos pela aplicação, como
 * vínculos com empresas/filiais). As DEFINIÇÕES dos cargos ficam sempre no banco da aplicação
 * (`RoleStore`); as atribuições ficam no `AssignmentStore` fornecido pela aplicação (ex.: coleção
 * no banco, cache ou memória em testes).
 */

import type { RoleLike } from "./permission-set"

export interface Assignment<Extra = unknown> {
    /** Ids dos cargos atribuídos. */
    readonly roles: readonly string[]
    /** Dados extras da aplicação (ex.: `{ empresas: [...] }`). */
    readonly extra?: Extra
    /**
     * Versão da atribuição (inteiro >= 0), incrementada pela aplicação a cada gravação. Permite
     * detectar uma cópia desatualizada (ex.: claim do token de sessão) — ver
     * `createFreshAssignmentResolver` na raiz do pacote. Ausente = 0.
     */
    readonly version?: number
}

export const EMPTY_ASSIGNMENT: Assignment<never> = Object.freeze({ roles: Object.freeze([]) as readonly string[] })

export interface AssignmentStore<Extra = unknown> {
    /** Atribuição do usuário (id do provedor de identidade). Desconhecido → vazio. */
    get(userId: string): Promise<Assignment<Extra>>
    /** Substitui a atribuição do usuário. */
    set(userId: string, assignment: Assignment<Extra>): Promise<void>
    /** Usuários cuja atribuição satisfaz o predicado (listas por cargo/filial). Opcional. */
    list?(predicate?: (assignment: Assignment<Extra>) => boolean): Promise<Array<{ userId: string; assignment: Assignment<Extra> }>>
}

/** Onde a aplicação guarda as DEFINIÇÕES de cargos. */
export interface RoleStore {
    /** Cargos pelos ids (com `posicao` já resolvida). Ids desconhecidos são omitidos. */
    getRoles(ids: readonly string[]): Promise<RoleLike[]>
}

export type ExtraParser<Extra> = (value: unknown) => Extra | undefined

/**
 * Normaliza um valor desconhecido (metadado, claim, JSON) em atribuição. Formato inválido vira
 * atribuição VAZIA — errar para o lado que tira acesso.
 */
export function parseAssignment<Extra = unknown>(value: unknown, parseExtra?: ExtraParser<Extra>): Assignment<Extra> {
    let raw: unknown = value
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw)
        } catch {
            return EMPTY_ASSIGNMENT as Assignment<Extra>
        }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_ASSIGNMENT as Assignment<Extra>
    const record = raw as { roles?: unknown; extra?: unknown; version?: unknown }
    const roles = Array.isArray(record.roles) ? record.roles.filter((id): id is string => typeof id === "string" && id.length > 0) : []
    const extra = record.extra === undefined ? undefined : parseExtra ? parseExtra(record.extra) : (record.extra as Extra)
    return {
        roles: [...new Set(roles)],
        ...(extra === undefined ? {} : { extra }),
        ...(isVersion(record.version) ? { version: record.version } : {}),
    }
}

function isVersion(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

/** Versão da atribuição; ausente ou inválida = 0. */
export function assignmentVersion(assignment: { readonly version?: number } | null | undefined): number {
    const version = assignment?.version
    return isVersion(version) ? version : 0
}

/** Serializa para JSON puro (sem `undefined`), pronto para metadados. */
export function serializeAssignment<Extra>(assignment: Assignment<Extra>): { roles: string[]; extra?: Extra; version?: number } {
    return {
        roles: [...new Set(assignment.roles)],
        ...(assignment.extra === undefined ? {} : { extra: assignment.extra }),
        ...(isVersion(assignment.version) ? { version: assignment.version } : {}),
    }
}

/** Store em memória (testes e protótipos). */
export function createMemoryAssignmentStore<Extra = unknown>(initial: Record<string, Assignment<Extra>> = {}): AssignmentStore<Extra> {
    const data = new Map(Object.entries(initial))
    return {
        async get(userId) {
            return data.get(userId) ?? (EMPTY_ASSIGNMENT as Assignment<Extra>)
        },
        async set(userId, assignment) {
            data.set(userId, parseAssignment<Extra>(serializeAssignment(assignment)))
        },
        async list(predicate) {
            return [...data.entries()]
                .filter(([, assignment]) => !predicate || predicate(assignment))
                .map(([userId, assignment]) => ({ userId, assignment }))
        },
    }
}

export interface AccessControlOptions<Extra> {
    roles: RoleStore
    /** Store das atribuições, fornecido pela aplicação. */
    assignments: AssignmentStore<Extra>
}

export interface AccessControl<Extra> {
    readonly assignments: AssignmentStore<Extra>
    /** Atribuição + cargos carregados do usuário. `given` evita reler o store (ex.: claim da sessão). */
    load(userId: string, given?: Assignment<Extra>): Promise<{ assignment: Assignment<Extra>; roles: RoleLike[] }>
}

/**
 * Liga o store de cargos ao store de atribuições. A aplicação fornece ambos: as definições de
 * cargos (`RoleStore`) e a persistência das atribuições (`AssignmentStore`).
 */
export function createAccessControl<Extra = unknown>(options: AccessControlOptions<Extra>): AccessControl<Extra> {
    const { roles, assignments } = options
    return {
        assignments,
        async load(userId, given) {
            const assignment = given ?? (await assignments.get(userId))
            const loaded = assignment.roles.length > 0 ? await roles.getRoles(assignment.roles) : []
            return { assignment, roles: loaded }
        },
    }
}
