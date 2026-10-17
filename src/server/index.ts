/**
 * Fábricas de guardas de servidor, agnósticas de framework.
 *
 * A aplicação fornece `getAuth()` (ex.: Clerk + banco no CRM) e recebe `requirePermission`,
 * `requireAnyPermission` e `requireScope`, que LANÇAM `PermissionError` com o status HTTP
 * adequado (401/403). A tradução para resposta HTTP fica na aplicação.
 */

import type { Catalog } from "../catalog"
import { hasAnyPermission, hasPermission, type EffectivePermissions, type RoleLike } from "../permission-set"
import { resolveScope, type ScopeRegistry, type ScopeResolvers, type ScopeResult } from "../scopes"

export type PermissionErrorCode = "UNAUTHORIZED" | "FORBIDDEN"

export class PermissionError extends Error {
    readonly code: PermissionErrorCode
    readonly status: 401 | 403

    constructor(code: PermissionErrorCode, message?: string) {
        super(message ?? (code === "UNAUTHORIZED" ? "Não autenticado" : "Acesso negado"))
        this.name = "PermissionError"
        this.code = code
        this.status = code === "UNAUTHORIZED" ? 401 : 403
    }
}

export function isPermissionError(error: unknown): error is PermissionError {
    return error instanceof PermissionError
}

/** O que a aplicação precisa devolver para as guardas funcionarem. */
export interface GuardAuth {
    readonly roles: readonly RoleLike[]
    readonly effective: EffectivePermissions
}

export interface CreateGuardsOptions<A extends GuardAuth, S extends string, Ctx> {
    catalog: Catalog
    /** Devolve o contexto autenticado ou `null` (401). */
    getAuth: () => Promise<A | null>
    scopes?: {
        registry: ScopeRegistry<S>
        resolvers: ScopeResolvers<S, Ctx>
    }
}

export interface Guards<A extends GuardAuth, S extends string, Ctx> {
    requireAuth(): Promise<A>
    requirePermission(key: string): Promise<A>
    requireAnyPermission(keys: readonly string[]): Promise<A>
    /** Autoriza pela folha de visualização e devolve o escopo resolvido. Sem permissão → 403. */
    requireScope(viewKey: string, ctx: Ctx, auth?: A): Promise<{ auth: A; scope: ScopeResult<S> }>
}

export function createGuards<A extends GuardAuth, S extends string = string, Ctx = unknown>(
    options: CreateGuardsOptions<A, S, Ctx>,
): Guards<A, S, Ctx> {
    const requireAuth = async (): Promise<A> => {
        const auth = await options.getAuth()
        if (!auth) throw new PermissionError("UNAUTHORIZED")
        return auth
    }

    return {
        requireAuth,
        async requirePermission(key) {
            const auth = await requireAuth()
            if (!hasPermission(auth.effective, key)) throw new PermissionError("FORBIDDEN")
            return auth
        },
        async requireAnyPermission(keys) {
            const auth = await requireAuth()
            if (!hasAnyPermission(auth.effective, keys)) throw new PermissionError("FORBIDDEN")
            return auth
        },
        async requireScope(viewKey, ctx, given) {
            const auth = given ?? (await requireAuth())
            if (!hasPermission(auth.effective, viewKey)) throw new PermissionError("FORBIDDEN")
            if (!options.scopes) {
                throw new Error("@nandobfer/perfix: requireScope exige `scopes` em createGuards")
            }
            const scope = await resolveScope({
                catalog: options.catalog,
                registry: options.scopes.registry,
                resolvers: options.scopes.resolvers,
                roles: auth.roles,
                effective: auth.effective,
                viewKey,
                ctx,
            })
            return { auth, scope }
        },
    }
}
