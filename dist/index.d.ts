import { R as RoleRowLike, a as RoleLike, C as Catalog, E as EffectivePermissions } from './scopes-CKePgTCJ.js';
export { b as ComputeScopeInput, L as LeafKeysOf, N as NodeIdsOf, P as POSICAO_AUSENTE, c as PermissionBranchDef, d as PermissionLeafDef, e as PermissionMeta, f as PermissionNodeDef, g as PermissionNodeState, h as ResolveScopeInput, S as ScopeCombine, i as ScopeDef, j as ScopeDefs, k as ScopeDimension, l as ScopeRegistry, m as ScopeResolver, n as ScopeResolvers, o as ScopeResult, p as ScopeValue, W as WILDCARD, q as Wildcard, r as computeScope, s as countNodeLeaves, t as defineCatalog, u as defineScopes, v as expandPermissions, w as filterPermissionNodes, x as getNodeState, y as hasAllPermissions, z as hasAnyPermission, A as hasPermission, B as intersectPermissions, D as isEmptyScope, F as isPermissionLeaf, G as isWildcard, H as isWithinScope, I as matchesDimension, J as resolveScope, K as resolveUserRoles, M as restrictedScopes, O as toRoleLike, Q as toggleNode } from './scopes-CKePgTCJ.js';
export { A as AccessSet, R as ReadViewAsInput, a as ReadViewAsResult, b as ResolveViewAsInput, V as VIEW_AS_COOKIE, c as VIEW_AS_HEADER, d as VIEW_AS_MAX_TABS, e as VIEW_AS_NONE, f as VIEW_AS_TAB_COOKIE, g as ViewAs, h as ViewAsChoiceCheck, i as ViewAsMarker, j as ViewAsRejection, k as ViewAsResolution, l as ViewAsSource, m as ViewAsSubject, n as ViewAsTabMap, o as ViewAsTarget, p as accessIncludes, q as canSimulate, r as decodeViewAs, s as decodeViewAsTabMap, t as encodeViewAs, u as encodeViewAsTabMap, v as intersectAccess, w as intersectScopeDimension, x as intersectScopeResults, y as parseViewAs, z as readViewAs, B as resolveViewAs, C as simulatedPermissions, D as updateViewAsTabMap } from './view-as-D5EIoNFe.js';

/**
 * Posição dos cargos a partir da lista da hierarquia (índice 0 = topo; menor vence).
 * Módulo ISOMÓRFICO.
 */

/**
 * Atribui `posicao` a cada linha a partir da lista ordenada de ids. Cargo ausente vai para
 * o PÉ, desempatado por nome. Ids órfãos na lista são ignorados. Não reordena o resultado.
 */
declare function aplicarPosicoes<T extends RoleRowLike>(rows: readonly T[], ordem: readonly string[]): (T & {
    posicao: number;
})[];
/** Do topo para o pé. */
declare function ordenarPorPosicao<T extends {
    posicao: number;
}>(rows: readonly T[]): T[];

/**
 * Hierarquia de cargos — quem pode atribuir, editar e reordenar qual cargo.
 *
 * Cargos ficam numa lista ordenada (índice 0 = topo). Ninguém entrega cargo ACIMA da
 * própria posição (posição igual é permitida, como no Smart Desk). Sobre a hierarquia vale o
 * piso das chaves sensíveis: ninguém entrega cargo que conceda chave `sensitive` que não possui.
 *
 * Fail-closed: cargo sem posição vai para o pé; o coringa é o topo absoluto.
 * Módulo ISOMÓRFICO.
 */

/** Posição de quem não tem cargo nenhum: abaixo de qualquer cargo real. */
declare const NO_POSITION: number;
type UnassignableReason = "hierarquia" | "chave-sensivel";
interface UnassignableRole {
    readonly id: string;
    readonly motivo: UnassignableReason;
}
declare const UNASSIGNABLE_LABELS: Record<UnassignableReason, string>;
/** Posição do cargo — o coringa é `-Infinity` (topo absoluto). */
declare function rolePosition(cargo: Pick<RoleLike, "posicao" | "permissoes">): number;
/** Posição de quem concede = a do seu cargo ATIVO mais alto. */
declare function callerPosition(cargos?: readonly RoleLike[]): number;
/** O solicitante pode administrar este usuário? (empate permitido) */
declare function canManageUser(callerCargos?: readonly RoleLike[], targetCargos?: readonly RoleLike[]): boolean;
/**
 * O solicitante pode editar, excluir ou gerenciar os membros deste cargo?
 * Definir cargos é exclusivo de quem tem o coringa, e o cargo com coringa nunca é editável.
 */
declare function canManageRole(callerCargos: readonly RoleLike[] | undefined, alvo: Pick<RoleLike, "permissoes">): boolean;
/** Reordenar segue a mesma regra de `canManageRole`; o cargo com coringa não é arrastável. */
declare function canReorderRole(callerCargos: readonly RoleLike[] | undefined, alvo: Pick<RoleLike, "permissoes">): boolean;
/** Cargos que o solicitante NÃO pode atribuir, com o motivo. Quem tem `*` não é barrado. */
declare function getUnassignableRoles(catalog: Catalog, callerCargos?: readonly RoleLike[], alvos?: readonly RoleLike[]): UnassignableRole[];
declare function canAssignRole(catalog: Catalog, callerCargos: readonly RoleLike[], alvo: RoleLike): boolean;

/**
 * Guardas puras de concessão (sem I/O).
 *
 * `getUngrantableKeys` responde "quem pode DEFINIR as permissões de um cargo": ninguém
 * concede chave que não possui (monotonicidade). Quem tem `*` concede qualquer coisa.
 *
 * `evaluateRoleAssignment` responde "quem pode ATRIBUIR cargos prontos a um usuário":
 * hierarquia + piso de chaves sensíveis, validando apenas o delta e protegendo cargos atuais
 * fora do alcance (inclusive referências órfãs, fail-safe).
 */

declare function getUngrantableKeys(effective: EffectivePermissions, keys: readonly string[]): string[];
type RoleAssignmentResult = {
    status: "untouched";
} | {
    status: "invalid-roles";
    ids: string[];
} | {
    status: "escalation";
    cargos: UnassignableRole[];
} | {
    status: "ok";
    cargos: string[];
};
interface RoleAssignmentInput {
    catalog: Catalog;
    /** Cargos do solicitante (com posição aplicada). */
    callerCargos: readonly RoleLike[];
    /** Ids pedidos no payload; `undefined` = payload não mexe em cargos. */
    requested: readonly string[] | undefined;
    /** Ids atualmente gravados no usuário. */
    current?: readonly string[];
    /** Cargos carregados (pedidos + atuais), com posição aplicada. */
    loaded: readonly RoleLike[];
}
declare function evaluateRoleAssignment(input: RoleAssignmentInput): RoleAssignmentResult;

/**
 * ATRIBUIÇÕES do usuário: quais cargos ele tem (e dados extras definidos pela aplicação, como
 * vínculos com empresas/filiais). As DEFINIÇÕES dos cargos ficam sempre no banco da aplicação
 * (`RoleStore`); as atribuições ficam no `AssignmentStore` fornecido pela aplicação (ex.: coleção
 * no banco, cache ou memória em testes).
 */

interface Assignment<Extra = unknown> {
    /** Ids dos cargos atribuídos. */
    readonly roles: readonly string[];
    /** Dados extras da aplicação (ex.: `{ empresas: [...] }`). */
    readonly extra?: Extra;
    /**
     * Versão da atribuição (inteiro >= 0), incrementada pela aplicação a cada gravação. Permite
     * detectar uma cópia desatualizada (ex.: claim do token de sessão) — ver
     * `createFreshAssignmentResolver` na raiz do pacote. Ausente = 0.
     */
    readonly version?: number;
}
declare const EMPTY_ASSIGNMENT: Assignment<never>;
interface AssignmentStore<Extra = unknown> {
    /** Atribuição do usuário (id do provedor de identidade). Desconhecido → vazio. */
    get(userId: string): Promise<Assignment<Extra>>;
    /** Substitui a atribuição do usuário. */
    set(userId: string, assignment: Assignment<Extra>): Promise<void>;
    /** Usuários cuja atribuição satisfaz o predicado (listas por cargo/filial). Opcional. */
    list?(predicate?: (assignment: Assignment<Extra>) => boolean): Promise<Array<{
        userId: string;
        assignment: Assignment<Extra>;
    }>>;
}
/** Onde a aplicação guarda as DEFINIÇÕES de cargos. */
interface RoleStore {
    /** Cargos pelos ids (com `posicao` já resolvida). Ids desconhecidos são omitidos. */
    getRoles(ids: readonly string[]): Promise<RoleLike[]>;
}
type ExtraParser<Extra> = (value: unknown) => Extra | undefined;
/**
 * Normaliza um valor desconhecido (metadado, claim, JSON) em atribuição. Formato inválido vira
 * atribuição VAZIA — errar para o lado que tira acesso.
 */
declare function parseAssignment<Extra = unknown>(value: unknown, parseExtra?: ExtraParser<Extra>): Assignment<Extra>;
/** Versão da atribuição; ausente ou inválida = 0. */
declare function assignmentVersion(assignment: {
    readonly version?: number;
} | null | undefined): number;
/** Serializa para JSON puro (sem `undefined`), pronto para metadados. */
declare function serializeAssignment<Extra>(assignment: Assignment<Extra>): {
    roles: string[];
    extra?: Extra;
    version?: number;
};
/** Store em memória (testes e protótipos). */
declare function createMemoryAssignmentStore<Extra = unknown>(initial?: Record<string, Assignment<Extra>>): AssignmentStore<Extra>;
interface AccessControlOptions<Extra> {
    roles: RoleStore;
    /** Store das atribuições, fornecido pela aplicação. */
    assignments: AssignmentStore<Extra>;
}
interface AccessControl<Extra> {
    readonly assignments: AssignmentStore<Extra>;
    /** Atribuição + cargos carregados do usuário. `given` evita reler o store (ex.: claim da sessão). */
    load(userId: string, given?: Assignment<Extra>): Promise<{
        assignment: Assignment<Extra>;
        roles: RoleLike[];
    }>;
}
/**
 * Liga o store de cargos ao store de atribuições. A aplicação fornece ambos: as definições de
 * cargos (`RoleStore`) e a persistência das atribuições (`AssignmentStore`).
 */
declare function createAccessControl<Extra = unknown>(options: AccessControlOptions<Extra>): AccessControl<Extra>;

/**
 * Atribuições vindas de CLAIMS de sessão e resolução sempre atual.
 *
 * A aplicação pode injetar a atribuição no token de sessão (sob uma chave/namespace) para evitar
 * uma leitura ao store por requisição. Quando a claim não existe ou está atrasada, o resolver relê
 * do `AssignmentStore`. Nada aqui conhece o provedor de identidade: as claims são um objeto
 * genérico e o store é fornecido pela aplicação.
 */

/** Chave padrão da atribuição nas claims de sessão. */
declare const DEFAULT_ASSIGNMENT_NAMESPACE = "perfix";
/**
 * Lê a atribuição das CLAIMS do token de sessão. Devolve `null` quando a claim não existe
 * (token sem a informação ou ainda não renovado) — o chamador decide buscar no store.
 */
declare function readAssignmentFromClaims<Extra = unknown>(claims: Record<string, unknown> | null | undefined, namespace?: string, parseExtra?: ExtraParser<Extra>): Assignment<Extra> | null;
interface FreshAssignmentResolverOptions<Extra> {
    /** Store de onde reler a atribuição quando a claim estiver ausente ou atrasada. */
    store: AssignmentStore<Extra>;
    /** Chave da atribuição nas claims de sessão (padrão `perfix`). */
    namespace?: string;
    parseExtra?: ExtraParser<Extra>;
    /** Validade do cache das leituras do store em ms (padrão 30 s). */
    cacheMs?: number;
    /** Máximo de usuários no cache (padrão 1000; os mais antigos saem primeiro). */
    maxEntries?: number;
}
interface ResolveFreshAssignmentInput {
    /** Id do usuário. */
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
 * Atribuição sempre atual sem consultar o store a cada requisição: usa a claim do token enquanto
 * a versão dela for >= `minVersion`; senão relê do store (com cache curto, chaveado pela
 * versão — um cache antigo nunca atende a uma versão nova). Assim, uma atribuição retirada
 * deixa de valer na próxima requisição, sem esperar o token renovar.
 *
 * Se o store ainda devolver versão menor (gravação em andamento), devolve o que leu sem cachear.
 */
declare function createFreshAssignmentResolver<Extra = unknown>(options: FreshAssignmentResolverOptions<Extra>): FreshAssignmentResolver<Extra>;

export { type AccessControl, type AccessControlOptions, type Assignment, type AssignmentStore, Catalog, DEFAULT_ASSIGNMENT_NAMESPACE, EMPTY_ASSIGNMENT, EffectivePermissions, type ExtraParser, type FreshAssignmentResolver, type FreshAssignmentResolverOptions, NO_POSITION, type ResolveFreshAssignmentInput, type RoleAssignmentInput, type RoleAssignmentResult, RoleLike, RoleRowLike, type RoleStore, UNASSIGNABLE_LABELS, type UnassignableReason, type UnassignableRole, aplicarPosicoes, assignmentVersion, callerPosition, canAssignRole, canManageRole, canManageUser, canReorderRole, createAccessControl, createFreshAssignmentResolver, createMemoryAssignmentStore, evaluateRoleAssignment, getUnassignableRoles, getUngrantableKeys, ordenarPorPosicao, parseAssignment, readAssignmentFromClaims, rolePosition, serializeAssignment };
