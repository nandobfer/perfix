import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { decodeViewAsTabMap, encodeViewAs, VIEW_AS_COOKIE, VIEW_AS_TAB_COOKIE } from "../src"
import {
    getViewAsHeaderValue,
    getViewAsTabId,
    PermissionsProvider,
    readViewAsState,
    syncViewAsCookies,
    usePermissions,
    useViewAs,
    VIEW_AS_STORAGE_KEY,
} from "../src/react"

class MemoryStorage {
    private data = new Map<string, string>()
    getItem(key: string) {
        return this.data.get(key) ?? null
    }
    setItem(key: string, value: string) {
        this.data.set(key, value)
    }
    removeItem(key: string) {
        this.data.delete(key)
    }
}

function installBrowser() {
    const jar = new Map<string, string>()
    const document = {
        get cookie() {
            return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
        },
        set cookie(value: string) {
            const pair = value.split("; ")[0] ?? ""
            const index = pair.indexOf("=")
            const name = pair.slice(0, index)
            if (value.includes("Max-Age=0")) jar.delete(name)
            else jar.set(name, pair.slice(index + 1))
        },
    }
    Object.assign(globalThis, { window: { sessionStorage: new MemoryStorage() }, document })
    return jar
}

describe("estado da aba", () => {
    let jar: Map<string, string>
    beforeEach(() => {
        jar = installBrowser()
    })
    afterEach(() => {
        Reflect.deleteProperty(globalThis, "window")
        Reflect.deleteProperty(globalThis, "document")
    })

    it("sem simulação o cabeçalho é `none`", () => {
        expect(getViewAsHeaderValue()).toBe("none")
        expect(readViewAsState()).toBeNull()
    })

    it("com simulação o cabeçalho leva o estado e o cookie espelha a aba", () => {
        const viewAs = { tipo: "usuario" as const, userId: "u2" }
        window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify({ viewAs, label: { alvo: "Ana" } }))
        expect(getViewAsHeaderValue()).toBe(encodeViewAs(viewAs))
        syncViewAsCookies()
        const tab = getViewAsTabId()
        expect(jar.get(VIEW_AS_TAB_COOKIE)).toBe(tab)
        expect(decodeViewAsTabMap(decodeURIComponent(jar.get(VIEW_AS_COOKIE) ?? ""))).toEqual({ [tab]: viewAs })
    })

    it("estado adulterado é ignorado e encerrar limpa o cookie", () => {
        window.sessionStorage.setItem(VIEW_AS_STORAGE_KEY, JSON.stringify({ viewAs: { tipo: "root" }, label: { alvo: "x" } }))
        expect(readViewAsState()).toBeNull()
        syncViewAsCookies(null)
        expect(jar.has(VIEW_AS_COOKIE)).toBe(false)
    })
})

describe("provider", () => {
    it("fora do ViewAsProvider o estado é neutro", () => {
        function Probe() {
            const { isSimulating } = useViewAs()
            const { realIsAdmin, isAdmin } = usePermissions()
            return <span>{`${isSimulating}|${realIsAdmin}|${isAdmin}`}</span>
        }
        const html = renderToStaticMarkup(
            <PermissionsProvider permissions={["funnel.view"]} realIsAdmin>
                <Probe />
            </PermissionsProvider>,
        )
        expect(html).toContain("false|true|false")
    })
})
