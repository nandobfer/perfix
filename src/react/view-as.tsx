/**
 * "Visualizar como" no navegador (headless): estado POR ABA no `sessionStorage`, cookie espelho
 * para os Server Components e o valor do cabeçalho para o cliente HTTP.
 *
 * - Sobrevive a recarregar a página; termina ao fechar a aba.
 * - Cada aba tem um id; o cookie guarda `{ abaId: ViewAs }` e outro cookie, a aba em foco
 *   (regravado ao ganhar foco). O servidor aplica só a entrada da aba em foco; o cabeçalho vence.
 * - Isto é UX + transporte. Quem decide é sempre o servidor, que revalida tudo a cada requisição.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
    decodeViewAsTabMap,
    encodeViewAs,
    encodeViewAsTabMap,
    parseViewAs,
    updateViewAsTabMap,
    VIEW_AS_COOKIE,
    VIEW_AS_NONE,
    VIEW_AS_TAB_COOKIE,
    type ViewAs,
} from "../view-as"

/** Estado guardado na aba: o que é simulado + rótulo para a interface (o servidor ignora o rótulo). */
export interface ViewAsState {
    viewAs: ViewAs
    /** Ex.: `{ alvo: "Vendedor", escolha: "Filial Centro" }`. */
    label: { alvo: string; escolha?: string }
}

export const VIEW_AS_STORAGE_KEY = "perfix:view-as"
export const VIEW_AS_TAB_STORAGE_KEY = "perfix:view-as-tab"

const hasWindow = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"

function parseState(raw: string | null): ViewAsState | null {
    if (!raw) return null
    try {
        const value = JSON.parse(raw) as { viewAs?: unknown; label?: { alvo?: unknown; escolha?: unknown } }
        const viewAs = parseViewAs(value.viewAs)
        const alvo = value.label?.alvo
        if (!viewAs || typeof alvo !== "string") return null
        const escolha = typeof value.label?.escolha === "string" ? value.label.escolha : undefined
        return { viewAs, label: escolha ? { alvo, escolha } : { alvo } }
    } catch {
        return null
    }
}

/** Estado da aba atual (fora de componentes, ex.: interceptor HTTP). */
export function readViewAsState(): ViewAsState | null {
    if (!hasWindow()) return null
    return parseState(window.sessionStorage.getItem(VIEW_AS_STORAGE_KEY))
}

/** Valor do cabeçalho `x-perfix-view-as` desta aba: estado codificado ou `none`. */
export function getViewAsHeaderValue(): string {
    const state = readViewAsState()
    return state ? encodeViewAs(state.viewAs) : VIEW_AS_NONE
}

/** Id desta aba (criado na primeira leitura). */
export function getViewAsTabId(): string {
    if (!hasWindow()) return ""
    let id = window.sessionStorage.getItem(VIEW_AS_TAB_STORAGE_KEY)
    if (!id) {
        id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
        window.sessionStorage.setItem(VIEW_AS_TAB_STORAGE_KEY, id)
    }
    return id
}

function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null
    const prefix = `${name}=`
    const item = document.cookie.split("; ").find((part) => part.startsWith(prefix))
    return item ? decodeURIComponent(item.slice(prefix.length)) : null
}

function writeCookie(name: string, value: string | null) {
    if (typeof document === "undefined") return
    const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : ""
    document.cookie = value === null
        ? `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
        : `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`
}

/** Espelha o estado desta aba nos cookies (entrada da aba + aba em foco). */
export function syncViewAsCookies(state: ViewAsState | null = readViewAsState()) {
    const tabId = getViewAsTabId()
    if (!tabId) return
    const map = updateViewAsTabMap(decodeViewAsTabMap(readCookie(VIEW_AS_COOKIE)), tabId, state?.viewAs ?? null)
    writeCookie(VIEW_AS_COOKIE, Object.keys(map).length > 0 ? encodeViewAsTabMap(map) : null)
    writeCookie(VIEW_AS_TAB_COOKIE, tabId)
}

function persist(state: ViewAsState | null) {
    if (!hasWindow()) return
    if (state) window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify(state))
    else window.sessionStorage.removeItem(VIEW_AS_STORAGE_KEY)
    syncViewAsCookies(state)
}

export interface ViewAsValue {
    state: ViewAsState | null
    viewAs: ViewAs | null
    isSimulating: boolean
    /** Inicia ou troca a simulação. */
    start(state: ViewAsState): void
    /** Encerra a simulação desta aba (limpa estado e cookie). */
    stop(): void
}

const NEUTRAL: ViewAsValue = { state: null, viewAs: null, isSimulating: false, start: () => {}, stop: () => {} }

const ViewAsContext = createContext<ViewAsValue>(NEUTRAL)

export type ViewAsChangeKind = "inicio" | "troca" | "fim"

export interface ViewAsProviderProps {
    children: ReactNode
    /** Chamado DEPOIS de gravar o novo estado (limpar cache, reconectar tempo real, navegar...). */
    onChange?(change: { kind: ViewAsChangeKind; previous: ViewAsState | null; next: ViewAsState | null }): void
}

export function ViewAsProvider({ children, onChange }: ViewAsProviderProps) {
    // Começa neutro e lê a aba após montar: o HTML do servidor não conhece o sessionStorage.
    const [state, setState] = useState<ViewAsState | null>(null)
    const stateRef = useRef<ViewAsState | null>(null)
    const onChangeRef = useRef(onChange)
    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        const initial = readViewAsState()
        stateRef.current = initial
        setState(initial)
        syncViewAsCookies(initial)
        const refocus = () => {
            if (document.visibilityState === "visible") syncViewAsCookies()
        }
        window.addEventListener("focus", refocus)
        document.addEventListener("visibilitychange", refocus)
        return () => {
            window.removeEventListener("focus", refocus)
            document.removeEventListener("visibilitychange", refocus)
        }
    }, [])

    const apply = useCallback((next: ViewAsState | null) => {
        const previous = stateRef.current
        if (!previous && !next) return
        persist(next)
        stateRef.current = next
        setState(next)
        const kind: ViewAsChangeKind = !previous ? "inicio" : next ? "troca" : "fim"
        onChangeRef.current?.({ kind, previous, next })
    }, [])

    const value = useMemo<ViewAsValue>(
        () => ({
            state,
            viewAs: state?.viewAs ?? null,
            isSimulating: state !== null,
            start: (next) => apply(next),
            stop: () => apply(null),
        }),
        [state, apply],
    )

    return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>
}

/** Não lança fora do provider: devolve o estado neutro (sem simulação). */
export function useViewAs(): ViewAsValue {
    return useContext(ViewAsContext)
}
