import { parseAssignment, serializeAssignment, assignmentVersion, createAccessControl } from '../chunk-SVMZQVV5.js';

// src/clerk/index.ts
var DEFAULT_NAMESPACE = "perfix";
var PAGE = 500;
async function resolveClient(client) {
  return typeof client === "function" ? await client() : client;
}
function readAssignmentFromUser(user, namespace = DEFAULT_NAMESPACE, parseExtra) {
  return parseAssignment(user.publicMetadata?.[namespace], parseExtra);
}
function readAssignmentFromClaims(claims, namespace = DEFAULT_NAMESPACE, parseExtra) {
  if (!claims || !(namespace in claims)) return null;
  const value = claims[namespace];
  if (value === null || value === void 0 || value === "") return null;
  return parseAssignment(value, parseExtra);
}
function createClerkAssignmentStore(options) {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const cacheMs = options.listCacheMs ?? 3e4;
  let cache = null;
  return {
    async get(userId) {
      const client = await resolveClient(options.client);
      return readAssignmentFromUser(await client.users.getUser(userId), namespace, options.parseExtra);
    },
    async set(userId, assignment) {
      const client = await resolveClient(options.client);
      await client.users.updateUserMetadata(userId, { publicMetadata: { [namespace]: serializeAssignment(assignment) } });
      cache = null;
    },
    async list(predicate) {
      if (!cache || Date.now() - cache.at > cacheMs) {
        const client = await resolveClient(options.client);
        if (!client.users.getUserList) throw new Error("@nandobfer/perfix: o cliente do Clerk n\xE3o exp\xF5e users.getUserList");
        const rows = [];
        for (let offset = 0; ; offset += PAGE) {
          const page = await client.users.getUserList({ limit: PAGE, offset });
          const users = Array.isArray(page) ? page : page.data;
          for (const user of users) rows.push({ userId: user.id, assignment: readAssignmentFromUser(user, namespace, options.parseExtra) });
          if (users.length < PAGE) break;
        }
        cache = { at: Date.now(), rows };
      }
      return predicate ? cache.rows.filter((row) => predicate(row.assignment)) : [...cache.rows];
    }
  };
}
function createFreshAssignmentResolver(options) {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const cacheMs = options.cacheMs ?? 3e4;
  const maxEntries = Math.max(1, options.maxEntries ?? 1e3);
  const cache = /* @__PURE__ */ new Map();
  return {
    async resolve({ userId, claims, minVersion }) {
      const fromClaims = readAssignmentFromClaims(claims, namespace, options.parseExtra);
      if (fromClaims && assignmentVersion(fromClaims) >= minVersion) return { assignment: fromClaims, source: "claims" };
      const cached = cache.get(userId);
      if (cached && Date.now() - cached.at < cacheMs && assignmentVersion(cached.assignment) >= minVersion) {
        return { assignment: cached.assignment, source: "cache" };
      }
      const assignment = await options.store.get(userId);
      cache.delete(userId);
      if (assignmentVersion(assignment) >= minVersion) {
        cache.set(userId, { at: Date.now(), assignment });
        if (cache.size > maxEntries) {
          const oldest = cache.keys().next().value;
          if (oldest !== void 0) cache.delete(oldest);
        }
      }
      return { assignment, source: "store" };
    },
    forget(userId) {
      cache.delete(userId);
    }
  };
}
function createClerkAccessControl(options) {
  return createAccessControl({ roles: options.roles, assignments: createClerkAssignmentStore(options) });
}

export { DEFAULT_NAMESPACE, createClerkAccessControl, createClerkAssignmentStore, createFreshAssignmentResolver, readAssignmentFromClaims, readAssignmentFromUser };
