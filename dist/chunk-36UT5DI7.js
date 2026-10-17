// src/catalog.ts
var WILDCARD = "*";
function isPermissionLeaf(node) {
  return "key" in node;
}
function collectLeaves(nodes, ancestors, inheritedSensitive, inheritedScopes, out) {
  for (const node of nodes) {
    const sensitive = inheritedSensitive || node.sensitive === true;
    if (isPermissionLeaf(node)) {
      if (out.has(node.key)) {
        throw new Error(`@nandobfer/perfix: chave duplicada no cat\xE1logo: "${node.key}"`);
      }
      out.set(node.key, {
        key: node.key,
        label: node.label,
        description: node.description,
        sensitive,
        path: [...ancestors, node.label],
        scopes: inheritedScopes
      });
      continue;
    }
    const scopes = node.scopes ?? inheritedScopes;
    collectLeaves(node.children, [...ancestors, node.label], sensitive, scopes, out);
  }
}
function collectNodes(nodes, out) {
  for (const node of nodes) {
    if (isPermissionLeaf(node)) continue;
    if (out.has(node.id)) {
      throw new Error(`@nandobfer/perfix: id de grupo duplicado no cat\xE1logo: "${node.id}"`);
    }
    out.set(node.id, node);
    collectNodes(node.children, out);
  }
}
function leafKeysOf(node) {
  if (isPermissionLeaf(node)) return [node.key];
  return node.children.flatMap(leafKeysOf);
}
function defineCatalog(tree) {
  const meta = /* @__PURE__ */ new Map();
  collectLeaves(tree, [], false, [], meta);
  const nodes = /* @__PURE__ */ new Map();
  collectNodes(tree, nodes);
  const requiredView = /* @__PURE__ */ new Map();
  for (const node of nodes.values()) {
    if (!node.viewKey) continue;
    if (!meta.has(node.viewKey)) {
      throw new Error(
        `@nandobfer/perfix: viewKey "${node.viewKey}" do grupo "${node.id}" n\xE3o \xE9 folha do cat\xE1logo`
      );
    }
    for (const key of leafKeysOf(node)) {
      if (key !== node.viewKey && !requiredView.has(key)) requiredView.set(key, node.viewKey);
    }
  }
  const isKnownKey = (key) => meta.has(key);
  const requiredViewFor = (key) => requiredView.get(key);
  const normalizePermissionDependencies = (selected) => {
    const out = new Set(selected);
    if (out.has(WILDCARD)) return [WILDCARD];
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of out) {
        const required = requiredView.get(key);
        if (required && !out.has(required)) {
          out.add(required);
          changed = true;
        }
      }
    }
    return [...out];
  };
  const sanitizePermissions = (selected) => {
    const known = [...selected].filter((key) => key === WILDCARD || meta.has(key));
    return normalizePermissionDependencies(known);
  };
  const resolveGrants = (selectors) => {
    const out = /* @__PURE__ */ new Set();
    for (const selector of selectors) {
      if (selector === WILDCARD) {
        out.add(WILDCARD);
        continue;
      }
      const node = nodes.get(selector);
      if (node) {
        for (const key of leafKeysOf(node)) out.add(key);
        continue;
      }
      if (meta.has(selector)) out.add(selector);
    }
    return normalizePermissionDependencies(out);
  };
  const getSensitiveKeys = (selected) => {
    const out = [];
    for (const key of selected) {
      if (key === WILDCARD) continue;
      if (meta.get(key)?.sensitive) out.push(key);
    }
    return out;
  };
  return {
    tree,
    keys: [...meta.keys()],
    meta,
    nodes,
    isKnownKey,
    getLeafKeys: (node) => leafKeysOf(node),
    requiredViewFor,
    isRequiredView: (key, selected) => [...selected].some((s) => requiredView.get(s) === key),
    normalizePermissionDependencies,
    sanitizePermissions,
    resolveGrants,
    getSensitiveKeys,
    scopesFor: (key) => meta.get(key)?.scopes ?? []
  };
}

// src/permission-set.ts
var POSICAO_AUSENTE = Number.MAX_SAFE_INTEGER;
function toRoleLike(row) {
  return {
    id: String(row._id ?? row.id ?? ""),
    slug: row.slug ?? "",
    nome: row.nome ?? "",
    cor: row.cor,
    posicao: row.posicao ?? POSICAO_AUSENTE,
    ativo: row.ativo !== false,
    escopos: row.escopos ?? [],
    permissoes: row.permissoes ?? []
  };
}
function expandPermissions(cargos = []) {
  const out = /* @__PURE__ */ new Set();
  for (const cargo of cargos) {
    if (cargo.ativo === false) continue;
    for (const key of cargo.permissoes) out.add(key);
  }
  return out;
}
function intersectPermissions(a, b) {
  const aTudo = a.has(WILDCARD);
  const bTudo = b.has(WILDCARD);
  if (aTudo && bTudo) return /* @__PURE__ */ new Set([WILDCARD]);
  if (aTudo) return new Set(b);
  if (bTudo) return new Set(a);
  return new Set([...a].filter((key) => b.has(key)));
}
function hasPermission(effective, key) {
  return effective.has(WILDCARD) || effective.has(key);
}
function hasAnyPermission(effective, keys) {
  return keys.some((key) => hasPermission(effective, key));
}
function hasAllPermissions(effective, keys) {
  return keys.every((key) => hasPermission(effective, key));
}
function isWildcard(effective) {
  return effective.has(WILDCARD);
}
function resolveUserRoles(cargos = []) {
  return [...cargos].sort((a, b) => a.posicao - b.posicao);
}
function getNodeState(catalog, node, selected) {
  if (selected.has(WILDCARD)) return "checked";
  const leaves = catalog.getLeafKeys(node);
  if (leaves.length === 0) return "unchecked";
  const marked = leaves.filter((key) => selected.has(key)).length;
  if (marked === 0) return "unchecked";
  if (marked === leaves.length) return "checked";
  return "indeterminate";
}
function toggleNode(catalog, node, selected, next) {
  const out = new Set(selected);
  for (const key of catalog.getLeafKeys(node)) {
    if (next) out.add(key);
    else out.delete(key);
  }
  return new Set(catalog.normalizePermissionDependencies(out));
}
function countNodeLeaves(catalog, node, selected) {
  const leaves = catalog.getLeafKeys(node);
  if (selected.has(WILDCARD)) return { marked: leaves.length, total: leaves.length };
  return { marked: leaves.filter((key) => selected.has(key)).length, total: leaves.length };
}
function filterPermissionNodes(nodes, query) {
  const term = query.trim().toLowerCase();
  if (!term) return [...nodes];
  const out = [];
  for (const node of nodes) {
    const matchesSelf = node.label.toLowerCase().includes(term);
    if (isPermissionLeaf(node)) {
      if (matchesSelf || node.key.toLowerCase().includes(term)) out.push(node);
      continue;
    }
    if (matchesSelf) {
      out.push(node);
      continue;
    }
    const children = filterPermissionNodes(node.children, query);
    if (children.length > 0) out.push({ ...node, children });
  }
  return out;
}

export { POSICAO_AUSENTE, WILDCARD, countNodeLeaves, defineCatalog, expandPermissions, filterPermissionNodes, getNodeState, hasAllPermissions, hasAnyPermission, hasPermission, intersectPermissions, isPermissionLeaf, isWildcard, resolveUserRoles, toRoleLike, toggleNode };
