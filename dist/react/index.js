import { VIEW_AS_NONE, encodeViewAs, updateViewAsTabMap, decodeViewAsTabMap, encodeViewAsTabMap, VIEW_AS_COOKIE, parseViewAs, VIEW_AS_TAB_COOKIE } from '../chunk-WQ4TMPLN.js';
import { WILDCARD, hasAllPermissions, hasAnyPermission, hasPermission } from '../chunk-36UT5DI7.js';
import { createContext, useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import { jsx, Fragment } from 'react/jsx-runtime';

var VIEW_AS_STORAGE_KEY = "perfix:view-as";
var VIEW_AS_TAB_STORAGE_KEY = "perfix:view-as-tab";
var hasWindow = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
function parseState(raw) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const viewAs = parseViewAs(value.viewAs);
    const alvo = value.label?.alvo;
    if (!viewAs || typeof alvo !== "string") return null;
    const escolha = typeof value.label?.escolha === "string" ? value.label.escolha : void 0;
    return { viewAs, label: escolha ? { alvo, escolha } : { alvo } };
  } catch {
    return null;
  }
}
function readViewAsState() {
  if (!hasWindow()) return null;
  return parseState(window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY));
}
function getViewAsHeaderValue() {
  const state = readViewAsState();
  return state ? encodeViewAs(state.viewAs) : VIEW_AS_NONE;
}
function getViewAsTabId() {
  if (!hasWindow()) return "";
  let id = window.sessionStorage.getItem(VIEW_AS_TAB_STORAGE_KEY);
  if (!id) {
    id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(VIEW_AS_TAB_STORAGE_KEY, id);
  }
  return id;
}
function readCookie(name) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}
function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = value === null ? `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}` : `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}
function syncViewAsCookies(state = readViewAsState()) {
  const tabId = getViewAsTabId();
  if (!tabId) return;
  const map = updateViewAsTabMap(decodeViewAsTabMap(readCookie(VIEW_AS_COOKIE)), tabId, state?.viewAs ?? null);
  writeCookie(VIEW_AS_COOKIE, Object.keys(map).length > 0 ? encodeViewAsTabMap(map) : null);
  writeCookie(VIEW_AS_TAB_COOKIE, tabId);
}
function persist(state) {
  if (!hasWindow()) return;
  if (state) window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(state));
  else window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY);
  syncViewAsCookies(state);
}
var NEUTRAL = { state: null, viewAs: null, isSimulating: false, start: () => {
}, stop: () => {
} };
var ViewAsContext = createContext(NEUTRAL);
function ViewAsProvider({ children, onChange }) {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const initial = readViewAsState();
    stateRef.current = initial;
    setState(initial);
    syncViewAsCookies(initial);
    const refocus = () => {
      if (document.visibilityState === "visible") syncViewAsCookies();
    };
    window.addEventListener("focus", refocus);
    document.addEventListener("visibilitychange", refocus);
    return () => {
      window.removeEventListener("focus", refocus);
      document.removeEventListener("visibilitychange", refocus);
    };
  }, []);
  const apply = useCallback((next) => {
    const previous = stateRef.current;
    if (!previous && !next) return;
    persist(next);
    stateRef.current = next;
    setState(next);
    const kind = !previous ? "inicio" : next ? "troca" : "fim";
    onChangeRef.current?.({ kind, previous, next });
  }, []);
  const value = useMemo(
    () => ({
      state,
      viewAs: state?.viewAs ?? null,
      isSimulating: state !== null,
      start: (next) => apply(next),
      stop: () => apply(null)
    }),
    [state, apply]
  );
  return /* @__PURE__ */ jsx(ViewAsContext.Provider, { value, children });
}
function useViewAs() {
  return useContext(ViewAsContext);
}
var EMPTY = {
  permissions: /* @__PURE__ */ new Set(),
  roles: [],
  restrictedScopes: [],
  loading: true,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  isAdmin: false,
  isSimulating: false,
  realIsAdmin: false
};
var PermissionsContext = createContext(EMPTY);
function PermissionsProvider({
  permissions,
  roles = [],
  restrictedScopes = [],
  loading = false,
  realIsAdmin,
  children
}) {
  const { isSimulating } = useViewAs();
  const value = useMemo(() => {
    const set = new Set(permissions ?? []);
    return {
      permissions: set,
      roles,
      restrictedScopes,
      loading,
      can: (key) => !loading && hasPermission(set, key),
      canAny: (keys) => !loading && hasAnyPermission(set, keys),
      canAll: (keys) => !loading && hasAllPermissions(set, keys),
      isAdmin: set.has(WILDCARD),
      isSimulating,
      realIsAdmin: realIsAdmin ?? set.has(WILDCARD)
    };
  }, [permissions, roles, restrictedScopes, loading, isSimulating, realIsAdmin]);
  return /* @__PURE__ */ jsx(PermissionsContext.Provider, { value, children });
}
function usePermissions() {
  return useContext(PermissionsContext);
}
function Can({ permission, any, all, fallback = null, children }) {
  const { can, canAny, canAll } = usePermissions();
  const ok = (permission === void 0 || can(permission)) && (any === void 0 || canAny(any)) && (all === void 0 || canAll(all));
  return /* @__PURE__ */ jsx(Fragment, { children: ok ? children : fallback });
}

export { Can, PermissionsProvider, VIEW_AS_STORAGE_KEY, VIEW_AS_TAB_STORAGE_KEY, ViewAsProvider, getViewAsHeaderValue, getViewAsTabId, readViewAsState, syncViewAsCookies, usePermissions, useViewAs };
