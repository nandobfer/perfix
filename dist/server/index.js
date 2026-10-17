import { resolveScope } from '../chunk-U2QJPD3U.js';
import { hasPermission, hasAnyPermission } from '../chunk-36UT5DI7.js';

// src/server/index.ts
var PermissionError = class extends Error {
  code;
  status;
  constructor(code, message) {
    super(message ?? (code === "UNAUTHORIZED" ? "N\xE3o autenticado" : "Acesso negado"));
    this.name = "PermissionError";
    this.code = code;
    this.status = code === "UNAUTHORIZED" ? 401 : 403;
  }
};
function isPermissionError(error) {
  return error instanceof PermissionError;
}
function createGuards(options) {
  const requireAuth = async () => {
    const auth = await options.getAuth();
    if (!auth) throw new PermissionError("UNAUTHORIZED");
    return auth;
  };
  return {
    requireAuth,
    async requirePermission(key) {
      const auth = await requireAuth();
      if (!hasPermission(auth.effective, key)) throw new PermissionError("FORBIDDEN");
      return auth;
    },
    async requireAnyPermission(keys) {
      const auth = await requireAuth();
      if (!hasAnyPermission(auth.effective, keys)) throw new PermissionError("FORBIDDEN");
      return auth;
    },
    async requireScope(viewKey, ctx, given) {
      const auth = given ?? await requireAuth();
      if (!hasPermission(auth.effective, viewKey)) throw new PermissionError("FORBIDDEN");
      if (!options.scopes) {
        throw new Error("@nandobfer/perfix: requireScope exige `scopes` em createGuards");
      }
      const scope = await resolveScope({
        catalog: options.catalog,
        registry: options.scopes.registry,
        resolvers: options.scopes.resolvers,
        roles: auth.roles,
        effective: auth.effective,
        viewKey,
        ctx
      });
      return { auth, scope };
    }
  };
}

export { PermissionError, createGuards, isPermissionError };
