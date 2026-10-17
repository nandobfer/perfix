/**
 * Padrão da biblioteca: atribuições no `publicMetadata` do Clerk, sob uma chave (namespace).
 *
 * - Só o servidor escreve (Backend API); o navegador só lê.
 * - O app configura a claim do token de sessão (Clerk › Sessions › Customize session token):
 *   `{ "perfix": "{{user.public_metadata.perfix}}" }` — assim cada requisição lê as atribuições
 *   da própria sessão, sem chamar a API do Clerk. Mudanças valem ao renovar o token (~60 s).
 * - Sem dependência do SDK: recebe um cliente mínimo compatível com `clerkClient()`.
 */

import {
    assignmentVersion,
    createAccessControl,
    parseAssignment,
    serializeAssignment,
    type AccessControl,
    type Assignment,
    type AssignmentStore,
    type ExtraParser,
    type RoleStore,
} from "../assignments"

export const DEFAULT_NAMESPACE = "perfix"

/** Subconjunto do usuário do Clerk que a biblioteca usa. */
export interface ClerkUserLike {
    id: string
    publicMetadata?: Record<string, unknown> | null
}

/** Subconjunto de `clerkClient().users` (Backend SDK). */
export interface ClerkUsersApiLike {
    getUser(userId: string): Promise<ClerkUserLike>
    updateUserMetadata(userId: string, params: { publicMetadata?: Record<string, unknown> }): Promise<unknown>
    getUserList?(params: { limit?: number; offset?: number }): Promise<{ data: ClerkUserLike[]; totalCount?: number } | ClerkUserLike[]>
}

export interface ClerkClientLike {
    users: ClerkUsersApiLike
}

export interface ClerkAssignmentStoreOptions<Extra> {
    /** Cliente do Clerk, ou função que o devolve (ex.: `clerkClient` do `@clerk/nextjs/server`). */
    client: ClerkClientLike | (() => ClerkClientLike | Promise<ClerkClientLike>)
    namespace?: string
    parseExtra?: ExtraParser<Extra>
    /** Validade do cache de `list()` em ms (padrão 30 s). */
    listCacheMs?: number
}

const PAGE = 500

async function resolveClient(client: ClerkAssignmentStoreOptions<unknown>["client"]): Promise<ClerkClientLike> {
    return typeof client === "function" ? await client() : client
}

/** Lê a atribuição do usuário do Clerk (metadado público). */
export function readAssignmentFromUser<Extra = unknown>(user: ClerkUserLike, namespace = DEFAULT_NAMESPACE, parseExtra?: ExtraParser<Extra>) {
    return parseAssignment<Extra>(user.publicMetadata?.[namespace], parseExtra)
}

/**
 * Lê a atribuição das CLAIMS do token de sessão. Devolve `null` quando a claim não existe
 * (token não configurado ou ainda não renovado) — o chamador decide buscar no store.
 */
export function readAssignmentFromClaims<Extra = unknown>(
    claims: Record<string, unknown> | null | undefined,
    namespace = DEFAULT_NAMESPACE,
    parseExtra?: ExtraParser<Extra>,
): Assignment<Extra> | null {
    if (!claims || !(namespace in claims)) return null
    const value = claims[namespace]
    if (value === null || value === undefined || value === "") return null
    return parseAssignment<Extra>(value, parseExtra)
}

export function createClerkAssignmentStore<Extra = unknown>(options: ClerkAssignmentStoreOptions<Extra>): AssignmentStore<Extra> {
    const namespace = options.namespace ?? DEFAULT_NAMESPACE
    const cacheMs = options.listCacheMs ?? 30_000
    let cache: { at: number; rows: Array<{ userId: string; assignment: Assignment<Extra> }> } | null = null

    return {
        async get(userId) {
            const client = await resolveClient(options.client)
            return readAssignmentFromUser<Extra>(await client.users.getUser(userId), namespace, options.parseExtra)
        },
        async set(userId, assignment) {
            const client = await resolveClient(options.client)
            // O Clerk mescla o nível de cima do metadado: só a chave do namespace é substituída.
            await client.users.updateUserMetadata(userId, { publicMetadata: { [namespace]: serializeAssignment(assignment) } })
            cache = null
        },
        async list(predicate) {
            if (!cache || Date.now() - cache.at > cacheMs) {
                const client = await resolveClient(options.client)
                if (!client.users.getUserList) throw new Error("@nandobfer/perfix: o cliente do Clerk não expõe users.getUserList")
                const rows: Array<{ userId: string; assignment: Assignment<Extra> }> = []
                for (let offset = 0; ; offset += PAGE) {
                    const page = await client.users.getUserList({ limit: PAGE, offset })
                    const users = Array.isArray(page) ? page : page.data
                    for (const user of users) rows.push({ userId: user.id, assignment: readAssignmentFromUser<Extra>(user, namespace, options.parseExtra) })
                    if (users.length < PAGE) break
                }
                cache = { at: Date.now(), rows }
            }
            return predicate ? cache.rows.filter((row) => predicate(row.assignment)) : [...cache.rows]
        },
    }
}

export interface FreshAssignmentResolverOptions<Extra> {
    /** Store de onde reler a atribuição quando a claim estiver ausente ou atrasada. */
    store: AssignmentStore<Extra>
    namespace?: string
    parseExtra?: ExtraParser<Extra>
    /** Validade do cache das leituras do store em ms (padrão 30 s). */
    cacheMs?: number
    /** Máximo de usuários no cache (padrão 1000; os mais antigos saem primeiro). */
    maxEntries?: number
}

export interface ResolveFreshAssignmentInput {
    /** Id do usuário no provedor de identidade. */
    userId: string
    /** Claims do token de sessão. */
    claims: Record<string, unknown> | null | undefined
    /**
     * Versão mínima aceita, mantida pela aplicação numa fonte sempre atual (ex.: perfil no banco,
     * lido a cada requisição). Claim ou cache com versão menor são descartados.
     */
    minVersion: number
}

export interface FreshAssignmentResolver<Extra> {
    resolve(input: ResolveFreshAssignmentInput): Promise<{ assignment: Assignment<Extra>; source: "claims" | "cache" | "store" }>
    /** Descarta o cache do usuário (ex.: logo após gravar a atribuição nesta instância). */
    forget(userId: string): void
}

/**
 * Atribuição sempre atual sem chamar o Clerk a cada requisição: usa a claim do token enquanto
 * a versão dela for >= `minVersion`; senão relê do store (com cache curto, chaveado pela
 * versão — um cache antigo nunca atende a uma versão nova). Assim, uma atribuição retirada
 * deixa de valer na próxima requisição, sem esperar o token renovar (~60 s).
 *
 * Se o store ainda devolver versão menor (gravação em andamento), devolve o que leu sem cachear.
 */
export function createFreshAssignmentResolver<Extra = unknown>(options: FreshAssignmentResolverOptions<Extra>): FreshAssignmentResolver<Extra> {
    const namespace = options.namespace ?? DEFAULT_NAMESPACE
    const cacheMs = options.cacheMs ?? 30_000
    const maxEntries = Math.max(1, options.maxEntries ?? 1000)
    const cache = new Map<string, { at: number; assignment: Assignment<Extra> }>()

    return {
        async resolve({ userId, claims, minVersion }) {
            const fromClaims = readAssignmentFromClaims<Extra>(claims, namespace, options.parseExtra)
            if (fromClaims && assignmentVersion(fromClaims) >= minVersion) return { assignment: fromClaims, source: "claims" }

            const cached = cache.get(userId)
            if (cached && Date.now() - cached.at < cacheMs && assignmentVersion(cached.assignment) >= minVersion) {
                return { assignment: cached.assignment, source: "cache" }
            }

            const assignment = await options.store.get(userId)
            cache.delete(userId)
            if (assignmentVersion(assignment) >= minVersion) {
                cache.set(userId, { at: Date.now(), assignment })
                if (cache.size > maxEntries) {
                    const oldest = cache.keys().next().value
                    if (oldest !== undefined) cache.delete(oldest)
                }
            }
            return { assignment, source: "store" }
        },
        forget(userId) {
            cache.delete(userId)
        },
    }
}

export interface ClerkAccessControlOptions<Extra> extends ClerkAssignmentStoreOptions<Extra> {
    roles: RoleStore
}

/** Padrão: cargos no banco da aplicação + atribuições no Clerk. */
export function createClerkAccessControl<Extra = unknown>(options: ClerkAccessControlOptions<Extra>): AccessControl<Extra> {
    return createAccessControl<Extra>({ roles: options.roles, assignments: createClerkAssignmentStore<Extra>(options) })
}
