import { WILDCARD, intersectPermissions, expandPermissions } from './chunk-36UT5DI7.js';

// src/view-as.ts
function canSimulate(effective) {
  return effective.has(WILDCARD);
}
function simulatedPermissions(real, roles) {
  return intersectPermissions(real, expandPermissions(roles));
}
function intersectScopeDimension(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.kind === "global") return b;
  if (b.kind === "global") return a;
  const set = new Set(b.values);
  return { kind: "values", values: a.values.filter((value) => set.has(value)) };
}
function intersectScopeResults(a, b) {
  if (!a.allowed || !b.allowed) return { allowed: false };
  const names = /* @__PURE__ */ new Set([...Object.keys(a.dimensions), ...Object.keys(b.dimensions)]);
  const dimensions = {};
  for (const name of names) {
    const dim = intersectScopeDimension(a.dimensions[name], b.dimensions[name]);
    if (dim) dimensions[name] = dim;
  }
  return { allowed: true, dimensions };
}
function intersectAccess(a, b) {
  if (a.kind === "all") return b;
  if (b.kind === "all") return a;
  const set = new Set(b.values);
  return { kind: "values", values: a.values.filter((value) => set.has(value)) };
}
function accessIncludes(access, value) {
  return access.kind === "all" || access.values.includes(value);
}
var VIEW_AS_HEADER = "x-perfix-view-as";
var VIEW_AS_NONE = "none";
var VIEW_AS_COOKIE = "perfix-view-as";
var VIEW_AS_TAB_COOKIE = "perfix-view-as-tab";
var VIEW_AS_MAX_TABS = 10;
var ID = /^[A-Za-z0-9:_.-]{1,128}$/;
var MAX_ESCOLHAS = 8;
var isId = (value) => typeof value === "string" && ID.test(value);
function parseViewAs(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value;
  if (record.tipo === "usuario") {
    const keys = Object.keys(record);
    if (!isId(record.userId) || keys.some((key) => key !== "tipo" && key !== "userId")) return null;
    return { tipo: "usuario", userId: record.userId };
  }
  if (record.tipo === "cargo") {
    const keys = Object.keys(record);
    if (!isId(record.roleId) || keys.some((key) => !["tipo", "roleId", "escolhas"].includes(key))) return null;
    if (record.escolhas === void 0) return { tipo: "cargo", roleId: record.roleId };
    const escolhas = record.escolhas;
    if (!escolhas || typeof escolhas !== "object" || Array.isArray(escolhas)) return null;
    const entries = Object.entries(escolhas);
    if (entries.length > MAX_ESCOLHAS || entries.some(([name, id]) => !ID.test(name) || !isId(id))) return null;
    return entries.length === 0 ? { tipo: "cargo", roleId: record.roleId } : { tipo: "cargo", roleId: record.roleId, escolhas: Object.fromEntries(entries) };
  }
  return null;
}
function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(value) {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}
function decodeJson(raw) {
  const text = fromBase64Url(raw);
  if (text === null) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function encodeViewAs(viewAs) {
  return toBase64Url(JSON.stringify(viewAs));
}
function decodeViewAs(raw) {
  return parseViewAs(decodeJson(raw));
}
function encodeViewAsTabMap(map) {
  return toBase64Url(JSON.stringify(map));
}
function decodeViewAsTabMap(raw) {
  if (!raw) return {};
  const value = decodeJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [tab, item] of Object.entries(value)) {
    const viewAs = isId(tab) ? parseViewAs(item) : null;
    if (viewAs) out[tab] = viewAs;
  }
  return out;
}
function updateViewAsTabMap(map, tabId, viewAs) {
  const entries = Object.entries(map).filter(([tab]) => tab !== tabId);
  if (viewAs) entries.push([tabId, viewAs]);
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - VIEW_AS_MAX_TABS)));
}
function readViewAs(input) {
  const header = input.header?.trim();
  if (header) {
    if (header === VIEW_AS_NONE) return { source: "none", viewAs: null, invalid: false };
    const viewAs2 = decodeViewAs(header);
    return viewAs2 ? { source: "header", viewAs: viewAs2, invalid: false } : { source: "none", viewAs: null, invalid: true };
  }
  const tab = input.tabCookie?.trim();
  if (!tab || !input.tabMapCookie) return { source: "none", viewAs: null, invalid: false };
  if (!isId(tab)) return { source: "none", viewAs: null, invalid: true };
  const viewAs = decodeViewAsTabMap(input.tabMapCookie)[tab] ?? null;
  return viewAs ? { source: "cookie", viewAs, invalid: false } : { source: "none", viewAs: null, invalid: false };
}
async function resolveViewAs(input) {
  const { real, viewAs } = input;
  if (!viewAs) return { status: "none" };
  if (!canSimulate(real.effective)) return { status: "forbidden" };
  if (viewAs.tipo === "usuario") {
    const target = await input.loadTarget(viewAs.userId);
    if (!target || !target.ativo) return { status: "invalid", motivo: "ALVO" };
    const roles = target.roles.filter((role2) => role2.ativo !== false);
    const subject = { tipo: "usuario", id: target.id, nome: target.nome, roles, extra: target.extra };
    return {
      status: "ok",
      viewAs,
      subject,
      effective: simulatedPermissions(real.effective, roles),
      marker: { tipo: "usuario", alvoId: target.id, alvoNome: target.nome },
      pendingChoices: []
    };
  }
  const role = await input.loadRole(viewAs.roleId);
  if (!role || role.ativo === false) return { status: "invalid", motivo: "CARGO" };
  const escolhas = {};
  const pendingChoices = [];
  for (const scope of input.choiceScopes ?? []) {
    if (!(role.escopos ?? []).includes(scope)) continue;
    const value = viewAs.escolhas?.[scope];
    const check = input.checkChoice ? await input.checkChoice(scope, value) : value ? "ok" : "pending";
    if (check === "invalid") return { status: "invalid", motivo: "ESCOLHA" };
    if (check === "pending" || !value) pendingChoices.push(scope);
    else escolhas[scope] = value;
  }
  const hasChoices = Object.keys(escolhas).length > 0;
  return {
    status: "ok",
    viewAs,
    subject: { tipo: "cargo", id: real.userId, nome: role.nome, roles: [role] },
    effective: simulatedPermissions(real.effective, [role]),
    marker: hasChoices ? { tipo: "cargo", alvoId: role.id, alvoNome: role.nome, escolhas } : { tipo: "cargo", alvoId: role.id, alvoNome: role.nome },
    pendingChoices
  };
}

export { VIEW_AS_COOKIE, VIEW_AS_HEADER, VIEW_AS_MAX_TABS, VIEW_AS_NONE, VIEW_AS_TAB_COOKIE, accessIncludes, canSimulate, decodeViewAs, decodeViewAsTabMap, encodeViewAs, encodeViewAsTabMap, intersectAccess, intersectScopeDimension, intersectScopeResults, parseViewAs, readViewAs, resolveViewAs, simulatedPermissions, updateViewAsTabMap };
