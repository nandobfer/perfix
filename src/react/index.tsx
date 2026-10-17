/**
 * Provider e hooks de UI. As guardas de UI são EXPERIÊNCIA, não segurança: a autoridade é
 * sempre a guarda do servidor.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { WILDCARD } from "../catalog"
import { hasAllPermissions, hasAnyPermission, hasPermission, type RoleLike } from "../permission-set"
import { useViewAs } from "./view-as"

export * from "./view-as"

export interface PermissionsValue {
    /** Permissões efetivas (chaves e/ou `*`). */
    readonly permissions: ReadonlySet<string>
    readonly roles: readonly RoleLike[]
    /** Escopos restritos pelos cargos ativos do usuário. */
    readonly restrictedScopes: readonly string[]
    readonly loading: boolean
    can(key: string): boolean
    canAny(keys: readonly string[]): boolean
    canAll(keys: readonly string[]): boolean
    readonly isAdmin: boolean
    /** A aba está simulando outro cargo/usuário (`ViewAsProvider`). */
    readonly isSimulating: boolean
    /** Quem está logado tem o coringa de verdade (pode simular), mesmo durante a simulação. */
    readonly realIsAdmin: boolean
}

const EMPTY: PermissionsValue = {
    permissions: new Set(),
    roles: [],
    restrictedScopes: [],
    loading: true,
    can: () => false,
    canAny: () => false,
    canAll: () => false,
    isAdmin: false,
    isSimulating: false,
    realIsAdmin: false,
}

const PermissionsContext = createContext<PermissionsValue>(EMPTY)

export interface PermissionsProviderProps {
    permissions: Iterable<string> | null | undefined
    roles?: readonly RoleLike[]
    restrictedScopes?: readonly string[]
    loading?: boolean
    /**
     * Coringa REAL de quem está logado. Informe quando `permissions` já for o conjunto simulado
     * vindo do servidor. Ausente = `permissions` contém `*`.
     */
    realIsAdmin?: boolean
    children: ReactNode
}

export function PermissionsProvider({
    permissions,
    roles = [],
    restrictedScopes = [],
    loading = false,
    realIsAdmin,
    children,
}: PermissionsProviderProps) {
    const { isSimulating } = useViewAs()
    const value = useMemo<PermissionsValue>(() => {
        const set = new Set(permissions ?? [])
        return {
            permissions: set,
            roles,
            restrictedScopes,
            loading,
            can: (key) => !loading && hasPermission(set, key),
            canAny: (keys) => !loading && hasAnyPermission(set, keys),
            canAll: (keys) => !loading && hasAllPermissions(set, keys),
            isAdmin: set.has(WILDCARD),
            isSimulating,
            realIsAdmin: realIsAdmin ?? set.has(WILDCARD),
        }
    }, [permissions, roles, restrictedScopes, loading, isSimulating, realIsAdmin])

    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsValue {
    return useContext(PermissionsContext)
}

export interface CanProps {
    permission?: string
    any?: readonly string[]
    all?: readonly string[]
    fallback?: ReactNode
    children: ReactNode
}

/** Renderiza `children` só quando o usuário possui a(s) permissão(ões). */
export function Can({ permission, any, all, fallback = null, children }: CanProps) {
    const { can, canAny, canAll } = usePermissions()
    const ok =
        (permission === undefined || can(permission)) &&
        (any === undefined || canAny(any)) &&
        (all === undefined || canAll(all))
    return <>{ok ? children : fallback}</>
}
