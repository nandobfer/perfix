import { hasPermission } from './chunk-36UT5DI7.js';

// src/scopes.ts
function defineScopes(defs) {
  const names = Object.keys(defs);
  const known = new Set(names);
  return {
    defs,
    names,
    isKnownScope: (name) => known.has(name),
    sanitize: (input) => {
      const wanted = new Set(input);
      return names.filter((name) => wanted.has(name));
    }
  };
}
function restrictedScopes(registry, roles) {
  const ativos = roles.filter((role) => role.ativo !== false);
  if (ativos.length === 0) return [];
  return registry.names.filter((name) => {
    const combine = registry.defs[name].combine ?? "restrictive";
    const restringe = (role) => (role.escopos ?? []).includes(name);
    return combine === "restrictive" ? ativos.some(restringe) : ativos.every(restringe);
  });
}
function computeScope(input) {
  const { catalog, registry, roles, effective, viewKey, values } = input;
  if (!hasPermission(effective, viewKey)) return { allowed: false };
  const aplicaveis = catalog.scopesFor(viewKey).filter((name) => registry.isKnownScope(name));
  const restritos = new Set(restrictedScopes(registry, roles));
  const dimensions = {};
  for (const name of aplicaveis) {
    dimensions[name] = restritos.has(name) ? { kind: "values", values: [...values[name] ?? []] } : { kind: "global" };
  }
  return { allowed: true, dimensions };
}
async function resolveScope(input) {
  const { catalog, registry, roles, effective, viewKey, resolvers, ctx } = input;
  if (!hasPermission(effective, viewKey)) return { allowed: false };
  const restritos = new Set(restrictedScopes(registry, roles));
  const alvos = catalog.scopesFor(viewKey).filter((name) => registry.isKnownScope(name) && restritos.has(name));
  const values = {};
  await Promise.all(
    alvos.map(async (name) => {
      values[name] = await resolvers[name](ctx);
    })
  );
  return computeScope({ catalog, registry, roles, effective, viewKey, values });
}
function isEmptyScope(result) {
  if (!result.allowed) return true;
  return Object.values(result.dimensions).some(
    (dim) => dim?.kind === "values" && dim.values.length === 0
  );
}
function matchesDimension(dim, value) {
  if (!dim || dim.kind === "global") return true;
  return dim.values.includes(value);
}
function isWithinScope(result, record) {
  if (!result.allowed) return false;
  return Object.keys(result.dimensions).every(
    (name) => matchesDimension(result.dimensions[name], record[name] ?? null)
  );
}

export { computeScope, defineScopes, isEmptyScope, isWithinScope, matchesDimension, resolveScope, restrictedScopes };
