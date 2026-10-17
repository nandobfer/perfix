/**
 * Atribuições vindas de CLAIMS de sessão e resolução sempre atual.
 *
 * A aplicação pode injetar a atribuição no token de sessão (sob uma chave/namespace) para evitar
 * uma leitura ao store por requisição. Quando a claim não existe ou está atrasada, o resolver relê
 * do `AssignmentStore`. Nada aqui conhece o provedor de identidade: as claims são um objeto
 * genérico e o store é fornecido pela aplicação.
 */

import {
    assignmentVersion,
    parseAssignment,
    type Assignment,
    type AssignmentStore,
    type ExtraParser,
} from "./assignments"

/** Chave padrão da atribuição nas claims de sessão. */
export const DEFAULT_ASSIGNMENT_NAMESPACE = "perfix"

/**
 * Lê a atribuição das CLAIMS do token de sessão. Devolve `null` quando a claim não existe
 * (token sem a informação ou ainda não renovado) — o chamador decide buscar no store.
 */
export function readAssignmentFromClaims<Extra = unknown>(
    claims: Record<string, unknown> | null | undefined,
    namespace = DEFAULT_ASSIGNMENT_NAMESPACE,
    parseExtra?: ExtraParser<Extra>,
): Assignment<Extra> | null {
    if (!claims || !(namespace in claims)) return null
    const value = claims[namespace]
    if (value === null || value === undefined || value === "") return null
    return parseAssignment<Extra>(value, parseExtra)
}

export interface FreshAssignmentResolverOptions<Extra> {
    /** Store de onde reler a atribuição quando a claim estiver ausente ou atrasada. */
    store: AssignmentStore<Extra>
    /** Chave da atribuição nas claims de sessão (padrão `perfix`). */
    namespace?: string
    parseExtra?: ExtraParser<Extra>
    /** Validade do cache das leituras do store em ms (padrão 30 s). */
    cacheMs?: number
    /** Máximo de usuários no cache (padrão 1000; os mais antigos saem primeiro). */
    maxEntries?: number
}

export interface ResolveFreshAssignmentInput {
    /** Id do usuário. */
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
 * Atribuição sempre atual sem consultar o store a cada requisição: usa a claim do token enquanto
 * a versão dela for >= `minVersion`; senão relê do store (com cache curto, chaveado pela
 * versão — um cache antigo nunca atende a uma versão nova). Assim, uma atribuição retirada
 * deixa de valer na próxima requisição, sem esperar o token renovar.
 *
 * Se o store ainda devolver versão menor (gravação em andamento), devolve o que leu sem cachear.
 */
export function createFreshAssignmentResolver<Extra = unknown>(options: FreshAssignmentResolverOptions<Extra>): FreshAssignmentResolver<Extra> {
    const namespace = options.namespace ?? DEFAULT_ASSIGNMENT_NAMESPACE
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
