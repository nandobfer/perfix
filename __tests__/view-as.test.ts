import { describe, expect, it } from "vitest"
import {
    accessIncludes,
    canSimulate,
    decodeViewAs,
    decodeViewAsTabMap,
    encodeViewAs,
    encodeViewAsTabMap,
    intersectAccess,
    intersectScopeResults,
    parseViewAs,
    readViewAs,
    resolveViewAs,
    simulatedPermissions,
    updateViewAsTabMap,
    VIEW_AS_MAX_TABS,
    type ViewAs,
    type ViewAsTarget,
} from "../src"
import { role } from "./fixtures"

const admin = new Set(["*"])
const vendedor = role({ id: "vendedor", nome: "Vendedor", escopos: ["filial", "carteira"], permissoes: ["funnel.view"] })
const gerente = role({ id: "gerente", nome: "Gerente", escopos: ["filial"], permissoes: ["funnel.view", "funnel.move"] })
const inativo = role({ id: "velho", ativo: false, permissoes: ["funnel.view"] })

describe("interseções", () => {
    it("permissões: coringa ∩ cargo = cargo; nunca amplia", () => {
        expect([...simulatedPermissions(admin, [vendedor])]).toEqual(["funnel.view"])
        expect([...simulatedPermissions(new Set(["funnel.view"]), [gerente])]).toEqual(["funnel.view"])
        expect([...simulatedPermissions(admin, [inativo])]).toEqual([])
    })

    it("escopos: global ∩ valores = valores; valores ∩ valores = comuns; vazio continua vazio", () => {
        const real = { allowed: true as const, dimensions: { filial: { kind: "global" as const }, carteira: { kind: "values" as const, values: ["u1", null] } } }
        const alvo = { allowed: true as const, dimensions: { filial: { kind: "values" as const, values: [] }, carteira: { kind: "values" as const, values: ["u2", null] } } }
        expect(intersectScopeResults(real, alvo)).toEqual({
            allowed: true,
            dimensions: { filial: { kind: "values", values: [] }, carteira: { kind: "values", values: [null] } },
        })
        expect(intersectScopeResults(real, { allowed: false })).toEqual({ allowed: false })
    })

    it("acesso: todos ∩ alguns = alguns; alguns ∩ alguns = comuns", () => {
        expect(intersectAccess({ kind: "all" }, { kind: "values", values: ["a"] })).toEqual({ kind: "values", values: ["a"] })
        expect(intersectAccess({ kind: "values", values: ["a", "b"] }, { kind: "values", values: ["b", "c"] })).toEqual({ kind: "values", values: ["b"] })
        expect(accessIncludes({ kind: "values", values: [] }, "a")).toBe(false)
        expect(accessIncludes({ kind: "all" }, "a")).toBe(true)
    })

    it("só o coringa simula", () => {
        expect(canSimulate(admin)).toBe(true)
        expect(canSimulate(new Set(["roles.edit"]))).toBe(false)
    })
})

describe("transporte", () => {
    it("valida o formato estritamente", () => {
        expect(parseViewAs({ tipo: "usuario", userId: "user_1" })).toEqual({ tipo: "usuario", userId: "user_1" })
        expect(parseViewAs({ tipo: "cargo", roleId: "r1", escolhas: { filial: "f1" } })).toEqual({ tipo: "cargo", roleId: "r1", escolhas: { filial: "f1" } })
        expect(parseViewAs({ tipo: "usuario", userId: "x", extra: 1 })).toBeNull()
        expect(parseViewAs({ tipo: "cargo", roleId: "$where" })).toBeNull()
        expect(parseViewAs({ tipo: "cargo", roleId: "r1", escolhas: { filial: 3 } })).toBeNull()
        expect(parseViewAs("cargo")).toBeNull()
    })

    it("codifica e decodifica em base64url", () => {
        const viewAs: ViewAs = { tipo: "cargo", roleId: "r1", escolhas: { filial: "f1" } }
        const encoded = encodeViewAs(viewAs)
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(decodeViewAs(encoded)).toEqual(viewAs)
        expect(decodeViewAs("%%%")).toBeNull()
    })

    it("cabeçalho vence o cookie; `none` desliga mesmo com cookie de outra aba", () => {
        const map = encodeViewAsTabMap({ a: { tipo: "usuario", userId: "u1" } })
        const header = encodeViewAs({ tipo: "cargo", roleId: "r1" })
        expect(readViewAs({ header, tabMapCookie: map, tabCookie: "a" })).toEqual({ source: "header", viewAs: { tipo: "cargo", roleId: "r1" }, invalid: false })
        expect(readViewAs({ header: "none", tabMapCookie: map, tabCookie: "a" }).viewAs).toBeNull()
        expect(readViewAs({ tabMapCookie: map, tabCookie: "a" })).toEqual({ source: "cookie", viewAs: { tipo: "usuario", userId: "u1" }, invalid: false })
        expect(readViewAs({ tabMapCookie: map, tabCookie: "b" }).viewAs).toBeNull()
    })

    it("cabeçalho inválido é ignorado e sinalizado", () => {
        expect(readViewAs({ header: "lixo!" })).toEqual({ source: "none", viewAs: null, invalid: true })
    })

    it("mapa de abas descarta inválidos e guarda no máximo N abas", () => {
        expect(decodeViewAsTabMap(encodeViewAsTabMap({ a: { tipo: "usuario", userId: "u1" } }) + "x")).toEqual({})
        let map: Record<string, ViewAs> = {}
        for (let i = 0; i < VIEW_AS_MAX_TABS + 3; i++) map = updateViewAsTabMap(map, `t${i}`, { tipo: "usuario", userId: `u${i}` })
        expect(Object.keys(map)).toHaveLength(VIEW_AS_MAX_TABS)
        expect(map.t0).toBeUndefined()
        expect(updateViewAsTabMap(map, "t5", null).t5).toBeUndefined()
    })
})

describe("resolveViewAs", () => {
    const targets: Record<string, ViewAsTarget<{ empresas: string[] }>> = {
        u2: { id: "u2", nome: "Ana", ativo: true, roles: [vendedor, inativo], extra: { empresas: ["e1"] } },
        u3: { id: "u3", nome: "Bia", ativo: false, roles: [vendedor] },
    }
    const base = {
        real: { userId: "u1", nome: "Admin", effective: admin },
        loadRole: async (id: string) => [vendedor, gerente].find((r) => r.id === id) ?? null,
        loadTarget: async (id: string) => targets[id] ?? null,
        choiceScopes: ["filial"],
    }

    it("sem simulação", async () => {
        expect(await resolveViewAs({ ...base, viewAs: null })).toEqual({ status: "none" })
    })

    it("quem não tem o coringa recebe forbidden", async () => {
        const result = await resolveViewAs({ ...base, real: { ...base.real, effective: new Set(["funnel.view"]) }, viewAs: { tipo: "cargo", roleId: "vendedor" } })
        expect(result.status).toBe("forbidden")
    })

    it("usuário: usa os cargos ativos e o extra do alvo", async () => {
        const result = await resolveViewAs({ ...base, viewAs: { tipo: "usuario", userId: "u2" } })
        if (result.status !== "ok") throw new Error(result.status)
        expect(result.subject).toMatchObject({ tipo: "usuario", id: "u2", nome: "Ana", extra: { empresas: ["e1"] } })
        expect(result.subject.roles.map((r) => r.id)).toEqual(["vendedor"])
        expect([...result.effective]).toEqual(["funnel.view"])
        expect(result.marker).toEqual({ tipo: "usuario", alvoId: "u2", alvoNome: "Ana" })
    })

    it("usuário inativo ou inexistente é rejeitado", async () => {
        expect(await resolveViewAs({ ...base, viewAs: { tipo: "usuario", userId: "u3" } })).toEqual({ status: "invalid", motivo: "ALVO" })
        expect(await resolveViewAs({ ...base, viewAs: { tipo: "usuario", userId: "zz" } })).toEqual({ status: "invalid", motivo: "ALVO" })
    })

    it("cargo: o sujeito é o próprio simulador; escolha pendente sem valor", async () => {
        const result = await resolveViewAs({ ...base, viewAs: { tipo: "cargo", roleId: "gerente" } })
        if (result.status !== "ok") throw new Error(result.status)
        expect(result.subject.id).toBe("u1")
        expect(result.pendingChoices).toEqual(["filial"])
    })

    it("cargo: escolha válida entra no marcador; inválida rejeita; cargo inativo rejeita", async () => {
        const checkChoice = (_scope: string, value: string | undefined) => (value === "f1" ? "ok" : value ? "invalid" : "pending") as "ok" | "invalid" | "pending"
        const ok = await resolveViewAs({ ...base, checkChoice, viewAs: { tipo: "cargo", roleId: "gerente", escolhas: { filial: "f1" } } })
        expect(ok.status === "ok" && ok.marker).toEqual({ tipo: "cargo", alvoId: "gerente", alvoNome: "Gerente", escolhas: { filial: "f1" } })
        expect(await resolveViewAs({ ...base, checkChoice, viewAs: { tipo: "cargo", roleId: "gerente", escolhas: { filial: "f9" } } })).toEqual({ status: "invalid", motivo: "ESCOLHA" })
        expect(await resolveViewAs({ ...base, viewAs: { tipo: "cargo", roleId: "velho" } })).toEqual({ status: "invalid", motivo: "CARGO" })
    })
})
