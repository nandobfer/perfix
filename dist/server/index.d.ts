import { a as RoleLike, E as EffectivePermissions, C as Catalog, l as ScopeRegistry, n as ScopeResolvers, o as ScopeResult } from '../scopes-CKePgTCJ.js';

/**
 * Fábricas de guardas de servidor, agnósticas de framework.
 *
 * A aplicação fornece `getAuth()` (ex.: sessão autenticada + banco da aplicação) e recebe
 * `requirePermission`, `requireAnyPermission` e `requireScope`, que LANÇAM `PermissionError` com o
 * status HTTP adequado (401/403). A tradução para resposta HTTP fica na aplicação.
 */

type PermissionErrorCode = "UNAUTHORIZED" | "FORBIDDEN";
declare class PermissionError extends Error {
    readonly code: PermissionErrorCode;
    readonly status: 401 | 403;
    constructor(code: PermissionErrorCode, message?: string);
}
declare function isPermissionError(error: unknown): error is PermissionError;
/** O que a aplicação precisa devolver para as guardas funcionarem. */
interface GuardAuth {
    readonly roles: readonly RoleLike[];
    readonly effective: EffectivePermissions;
}
interface CreateGuardsOptions<A extends GuardAuth, S extends string, Ctx> {
    catalog: Catalog;
    /** Devolve o contexto autenticado ou `null` (401). */
    getAuth: () => Promise<A | null>;
    scopes?: {
        registry: ScopeRegistry<S>;
        resolvers: ScopeResolvers<S, Ctx>;
    };
}
interface Guards<A extends GuardAuth, S extends string, Ctx> {
    requireAuth(): Promise<A>;
    requirePermission(key: string): Promise<A>;
    requireAnyPermission(keys: readonly string[]): Promise<A>;
    /** Autoriza pela folha de visualização e devolve o escopo resolvido. Sem permissão → 403. */
    requireScope(viewKey: string, ctx: Ctx, auth?: A): Promise<{
        auth: A;
        scope: ScopeResult<S>;
    }>;
}
declare function createGuards<A extends GuardAuth, S extends string = string, Ctx = unknown>(options: CreateGuardsOptions<A, S, Ctx>): Guards<A, S, Ctx>;

export { type CreateGuardsOptions, type GuardAuth, type Guards, PermissionError, type PermissionErrorCode, createGuards, isPermissionError };
