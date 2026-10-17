import { R as RoleRowLike, a as RoleLike, C as Catalog, E as EffectivePermissions } from './permission-set-B6UbcFOx.js';
export { L as LeafKeysOf, N as NodeIdsOf, P as POSICAO_AUSENTE, b as PermissionBranchDef, c as PermissionLeafDef, d as PermissionMeta, e as PermissionNodeDef, f as PermissionNodeState, W as WILDCARD, g as Wildcard, h as countNodeLeaves, i as defineCatalog, j as expandPermissions, k as filterPermissionNodes, l as getNodeState, m as hasAllPermissions, n as hasAnyPermission, o as hasPermission, p as intersectPermissions, q as isPermissionLeaf, r as isWildcard, s as resolveUserRoles, t as toRoleLike, u as toggleNode } from './permission-set-B6UbcFOx.js';
export { C as ComputeScopeInput, R as ResolveScopeInput, S as ScopeCombine, a as ScopeDef, b as ScopeDefs, c as ScopeDimension, d as ScopeRegistry, e as ScopeResolver, f as ScopeResolvers, g as ScopeResult, h as ScopeValue, i as computeScope, j as defineScopes, k as isEmptyScope, l as isWithinScope, m as matchesDimension, r as resolveScope, n as restrictedScopes } from './scopes-Y8Ng1aid.js';
export { b as AccessControl, c as AccessControlOptions, A as Assignment, a as AssignmentStore, d as EMPTY_ASSIGNMENT, E as ExtraParser, R as RoleStore, e as assignmentVersion, f as createAccessControl, g as createMemoryAssignmentStore, p as parseAssignment, s as serializeAssignment } from './assignments-BPC_-Nwk.js';
export { A as AccessSet, R as ReadViewAsInput, a as ReadViewAsResult, b as ResolveViewAsInput, V as VIEW_AS_COOKIE, c as VIEW_AS_HEADER, d as VIEW_AS_MAX_TABS, e as VIEW_AS_NONE, f as VIEW_AS_TAB_COOKIE, g as ViewAs, h as ViewAsChoiceCheck, i as ViewAsMarker, j as ViewAsRejection, k as ViewAsResolution, l as ViewAsSource, m as ViewAsSubject, n as ViewAsTabMap, o as ViewAsTarget, p as accessIncludes, q as canSimulate, r as decodeViewAs, s as decodeViewAsTabMap, t as encodeViewAs, u as encodeViewAsTabMap, v as intersectAccess, w as intersectScopeDimension, x as intersectScopeResults, y as parseViewAs, z as readViewAs, B as resolveViewAs, C as simulatedPermissions, D as updateViewAsTabMap } from './view-as-BdEfJN9a.js';

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

export { Catalog, EffectivePermissions, NO_POSITION, type RoleAssignmentInput, type RoleAssignmentResult, RoleLike, RoleRowLike, UNASSIGNABLE_LABELS, type UnassignableReason, type UnassignableRole, aplicarPosicoes, callerPosition, canAssignRole, canManageRole, canManageUser, canReorderRole, evaluateRoleAssignment, getUnassignableRoles, getUngrantableKeys, ordenarPorPosicao, rolePosition };
