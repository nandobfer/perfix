// src/assignments.ts
var EMPTY_ASSIGNMENT = Object.freeze({ roles: Object.freeze([]) });
function parseAssignment(value, parseExtra) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return EMPTY_ASSIGNMENT;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_ASSIGNMENT;
  const record = raw;
  const roles = Array.isArray(record.roles) ? record.roles.filter((id) => typeof id === "string" && id.length > 0) : [];
  const extra = record.extra === void 0 ? void 0 : parseExtra ? parseExtra(record.extra) : record.extra;
  return {
    roles: [...new Set(roles)],
    ...extra === void 0 ? {} : { extra },
    ...isVersion(record.version) ? { version: record.version } : {}
  };
}
function isVersion(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function assignmentVersion(assignment) {
  const version = assignment?.version;
  return isVersion(version) ? version : 0;
}
function serializeAssignment(assignment) {
  return {
    roles: [...new Set(assignment.roles)],
    ...assignment.extra === void 0 ? {} : { extra: assignment.extra },
    ...isVersion(assignment.version) ? { version: assignment.version } : {}
  };
}
function createMemoryAssignmentStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async get(userId) {
      return data.get(userId) ?? EMPTY_ASSIGNMENT;
    },
    async set(userId, assignment) {
      data.set(userId, parseAssignment(serializeAssignment(assignment)));
    },
    async list(predicate) {
      return [...data.entries()].filter(([, assignment]) => !predicate || predicate(assignment)).map(([userId, assignment]) => ({ userId, assignment }));
    }
  };
}
function createAccessControl(options) {
  const { roles, assignments } = options;
  return {
    assignments,
    async load(userId, given) {
      const assignment = given ?? await assignments.get(userId);
      const loaded = assignment.roles.length > 0 ? await roles.getRoles(assignment.roles) : [];
      return { assignment, roles: loaded };
    }
  };
}

export { EMPTY_ASSIGNMENT, assignmentVersion, createAccessControl, createMemoryAssignmentStore, parseAssignment, serializeAssignment };
