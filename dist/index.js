export { computeScope, defineScopes, isEmptyScope, isWithinScope, matchesDimension, resolveScope, restrictedScopes } from './chunk-U2QJPD3U.js';
export { VIEW_AS_COOKIE, VIEW_AS_HEADER, VIEW_AS_MAX_TABS, VIEW_AS_NONE, VIEW_AS_TAB_COOKIE, accessIncludes, canSimulate, decodeViewAs, decodeViewAsTabMap, encodeViewAs, encodeViewAsTabMap, intersectAccess, intersectScopeDimension, intersectScopeResults, parseViewAs, readViewAs, resolveViewAs, simulatedPermissions, updateViewAsTabMap } from './chunk-WQ4TMPLN.js';
import { POSICAO_AUSENTE, WILDCARD, expandPermissions, hasPermission } from './chunk-36UT5DI7.js';
export { POSICAO_AUSENTE, WILDCARD, countNodeLeaves, defineCatalog, expandPermissions, filterPermissionNodes, getNodeState, hasAllPermissions, hasAnyPermission, hasPermission, intersectPermissions, isPermissionLeaf, isWildcard, resolveUserRoles, toRoleLike, toggleNode } from './chunk-36UT5DI7.js';
export { EMPTY_ASSIGNMENT, assignmentVersion, createAccessControl, createMemoryAssignmentStore, parseAssignment, serializeAssignment } from './chunk-SVMZQVV5.js';

// src/role-order.ts
function rowId(row) {
  return String(row._id ?? row.id ?? "");
}
function aplicarPosicoes(rows, ordem) {
  const indicePorId = new Map(ordem.map((id, index) => [String(id), index]));
  const ausentes = rows.filter((row) => !indicePorId.has(rowId(row))).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
  const posicaoDosAusentes = new Map(ausentes.map((row, index) => [rowId(row), ordem.length + index]));
  return rows.map((row) => ({
    ...row,
    posicao: indicePorId.get(rowId(row)) ?? posicaoDosAusentes.get(rowId(row)) ?? POSICAO_AUSENTE
  }));
}
function ordenarPorPosicao(rows) {
  return [...rows].sort((a, b) => a.posicao - b.posicao);
}

// src/role-hierarchy.ts
var NO_POSITION = Number.POSITIVE_INFINITY;
var UNASSIGNABLE_LABELS = {
  hierarquia: "Este cargo est\xE1 acima do seu \u2014 voc\xEA n\xE3o pode conced\xEA-lo",
  "chave-sensivel": "Este cargo concede permiss\xF5es sens\xEDveis que voc\xEA n\xE3o possui"
};
function rolePosition(cargo) {
  if (cargo.permissoes.includes(WILDCARD)) return Number.NEGATIVE_INFINITY;
  return cargo.posicao ?? NO_POSITION;
}
function callerPosition(cargos = []) {
  const ativos = cargos.filter((cargo) => cargo.ativo !== false);
  if (ativos.length === 0) return NO_POSITION;
  return Math.min(...ativos.map(rolePosition));
}
function canManageUser(callerCargos = [], targetCargos = []) {
  return callerPosition(callerCargos) <= callerPosition(targetCargos);
}
function canManageRole(callerCargos = [], alvo) {
  if (alvo.permissoes.includes(WILDCARD)) return false;
  return expandPermissions(callerCargos).has(WILDCARD);
}
function canReorderRole(callerCargos = [], alvo) {
  return canManageRole(callerCargos, alvo);
}
function temChaveSensivelQueFalta(catalog, efetivas, alvo) {
  if (alvo.permissoes.includes(WILDCARD)) return true;
  return catalog.getSensitiveKeys(alvo.permissoes).some((key) => !hasPermission(efetivas, key));
}
function getUnassignableRoles(catalog, callerCargos = [], alvos = []) {
  const efetivas = expandPermissions(callerCargos);
  if (efetivas.has(WILDCARD)) return [];
  const teto = callerPosition(callerCargos);
  const recusados = [];
  for (const alvo of alvos) {
    if (rolePosition(alvo) < teto) {
      recusados.push({ id: alvo.id, motivo: "hierarquia" });
      continue;
    }
    if (temChaveSensivelQueFalta(catalog, efetivas, alvo)) {
      recusados.push({ id: alvo.id, motivo: "chave-sensivel" });
    }
  }
  return recusados;
}
function canAssignRole(catalog, callerCargos, alvo) {
  return getUnassignableRoles(catalog, callerCargos, [alvo]).length === 0;
}

// src/grant-guard.ts
function getUngrantableKeys(effective, keys) {
  if (effective.has(WILDCARD)) return [];
  return [...new Set(keys)].filter((key) => !hasPermission(effective, key));
}
function evaluateRoleAssignment(input) {
  const { catalog, callerCargos, requested, current = [], loaded } = input;
  if (requested === void 0) return { status: "untouched" };
  const pedidos = [...new Set(requested)];
  const atuais = [...new Set(current)];
  const atuaisSet = new Set(atuais);
  const byId = new Map(loaded.map((role) => [role.id, role]));
  const adicoes = pedidos.filter((id) => !atuaisSet.has(id));
  const invalidos = adicoes.filter((id) => {
    const role = byId.get(id);
    return !role || role.ativo === false;
  });
  if (invalidos.length > 0) return { status: "invalid-roles", ids: invalidos };
  const recusados = getUnassignableRoles(
    catalog,
    callerCargos,
    adicoes.map((id) => byId.get(id))
  );
  if (recusados.length > 0) return { status: "escalation", cargos: recusados };
  const carregadosAtuais = atuais.map((id) => byId.get(id)).filter((r) => r !== void 0);
  const protegidos = new Set(getUnassignableRoles(catalog, callerCargos, carregadosAtuais).map((r) => r.id));
  for (const id of atuais) if (!byId.has(id)) protegidos.add(id);
  return { status: "ok", cargos: [.../* @__PURE__ */ new Set([...pedidos, ...protegidos])] };
}

export { NO_POSITION, UNASSIGNABLE_LABELS, aplicarPosicoes, callerPosition, canAssignRole, canManageRole, canManageUser, canReorderRole, evaluateRoleAssignment, getUnassignableRoles, getUngrantableKeys, ordenarPorPosicao, rolePosition };
