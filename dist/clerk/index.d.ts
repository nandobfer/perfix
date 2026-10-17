import { E as ExtraParser, R as RoleStore, A as Assignment, a as AssignmentStore, b as AccessControl } from '../assignments-BPC_-Nwk.js';
import '../permission-set-B6UbcFOx.js';

/**
 * Padrão da biblioteca: atribuições no `publicMetadata` do Clerk, sob uma chave (namespace).
 *
 * - Só o servidor escreve (Backend API); o navegador só lê.
 * - O app configura a claim do token de sessão (Clerk › Sessions › Customize session token):
 *   `{ "perfix": "{{user.public_metadata.perfix}}" }` — assim cada requisição lê as atribuições
 *   da própria sessão, sem chamar a API do Clerk. Mudanças valem ao renovar o token (~60 s).
 * - Sem dependência do SDK: recebe um cliente mínimo compatível com `clerkClient()`.
 */

declare const DEFAULT_NAMESPACE = "perfix";
/** Subconjunto do usuário do Clerk que a biblioteca usa. */
interface ClerkUserLike {
    id: string;
    publicMetadata?: Record<string, unknown> | null;
}
/** Subconjunto de `clerkClient().users` (Backend SDK). */
interface ClerkUsersApiLike {
    getUser(userId: string): Promise<ClerkUserLike>;
    updateUserMetadata(userId: string, params: {
        publicMetadata?: Record<string, unknown>;
    }): Promise<unknown>;
    getUserList?(params: {
        limit?: number;
        offset?: number;
    }): Promise<{
        data: ClerkUserLike[];
        totalCount?: number;
    } | ClerkUserLike[]>;
}
interface ClerkClientLike {
    users: ClerkUsersApiLike;
}
interface ClerkAssignmentStoreOptions<Extra> {
    /** Cliente do Clerk, ou função que o devolve (ex.: `clerkClient` do `@clerk/nextjs/server`). */
    client: ClerkClientLike | (() => ClerkClientLike | Promise<ClerkClientLike>);
    namespace?: string;
    parseExtra?: ExtraParser<Extra>;
    /** Validade do cache de `list()` em ms (padrão 30 s). */
    listCacheMs?: number;
}
/** Lê a atribuição do usuário do Clerk (metadado público). */
declare function readAssignmentFromUser<Extra = unknown>(user: ClerkUserLike, namespace?: string, parseExtra?: ExtraParser<Extra>): Assignment<Extra>;
/**
 * Lê a atribuição das CLAIMS do token de sessão. Devolve `null` quando a claim não existe
 * (token não configurado ou ainda não renovado) — o chamador decide buscar no store.
 */
declare function readAssignmentFromClaims<Extra = unknown>(claims: Record<string, unknown> | null | undefined, namespace?: string, parseExtra?: ExtraParser<Extra>): Assignment<Extra> | null;
declare function createClerkAssignmentStore<Extra = unknown>(options: ClerkAssignmentStoreOptions<Extra>): AssignmentStore<Extra>;
interface FreshAssignmentResolverOptions<Extra> {
    /** Store de onde reler a atribuição quando a claim estiver ausente ou atrasada. */
    store: AssignmentStore<Extra>;
    namespace?: string;
    parseExtra?: ExtraParser<Extra>;
    /** Validade do cache das leituras do store em ms (padrão 30 s). */
    cacheMs?: number;
    /** Máximo de usuários no cache (padrão 1000; os mais antigos saem primeiro). */
    maxEntries?: number;
}
interface ResolveFreshAssignmentInput {
    /** Id do usuário no provedor de identidade. */
    userId: string;
    /** Claims do token de sessão. */
    claims: Record<string, unknown> | null | undefined;
    /**
     * Versão mínima aceita, mantida pela aplicação numa fonte sempre atual (ex.: perfil no banco,
     * lido a cada requisição). Claim ou cache com versão menor são descartados.
     */
    minVersion: number;
}
interface FreshAssignmentResolver<Extra> {
    resolve(input: ResolveFreshAssignmentInput): Promise<{
        assignment: Assignment<Extra>;
        source: "claims" | "cache" | "store";
    }>;
    /** Descarta o cache do usuário (ex.: logo após gravar a atribuição nesta instância). */
    forget(userId: string): void;
}
/**
 * Atribuição sempre atual sem chamar o Clerk a cada requisição: usa a claim do token enquanto
 * a versão dela for >= `minVersion`; senão relê do store (com cache curto, chaveado pela
 * versão — um cache antigo nunca atende a uma versão nova). Assim, uma atribuição retirada
 * deixa de valer na próxima requisição, sem esperar o token renovar (~60 s).
 *
 * Se o store ainda devolver versão menor (gravação em andamento), devolve o que leu sem cachear.
 */
declare function createFreshAssignmentResolver<Extra = unknown>(options: FreshAssignmentResolverOptions<Extra>): FreshAssignmentResolver<Extra>;
interface ClerkAccessControlOptions<Extra> extends ClerkAssignmentStoreOptions<Extra> {
    roles: RoleStore;
}
/** Padrão: cargos no banco da aplicação + atribuições no Clerk. */
declare function createClerkAccessControl<Extra = unknown>(options: ClerkAccessControlOptions<Extra>): AccessControl<Extra>;

export { type ClerkAccessControlOptions, type ClerkAssignmentStoreOptions, type ClerkClientLike, type ClerkUserLike, type ClerkUsersApiLike, DEFAULT_NAMESPACE, type FreshAssignmentResolver, type FreshAssignmentResolverOptions, type ResolveFreshAssignmentInput, createClerkAccessControl, createClerkAssignmentStore, createFreshAssignmentResolver, readAssignmentFromClaims, readAssignmentFromUser };
