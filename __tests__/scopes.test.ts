import { describe, expect, it, vi } from "vitest"
import { computeScope, expandPermissions, isEmptyScope, isWithinScope, resolveScope, restrictedScopes } from "../src"
import { catalog, role, scopes } from "./fixtures"

const vendedor = role({ id: "vendedor", escopos: ["filial", "carteira"], permissoes: ["funnel.view", "offers.view"] })
const gerente = role({ id: "gerente", escopos: ["filial"], permissoes: ["funnel.view", "offers.view"] })
const diretoria = role({ id: "diretoria", escopos: [], permissoes: ["funnel.view", "offers.view"] })

function compute(roles = [vendedor], viewKey = "funnel.view", values = {}) {
    return computeScope({ catalog, registry: scopes, roles, effective: expandPermissions(roles), viewKey, values })
}

describe("escopos generalizados", () => {
    it("combina dois escopos restritos (filial + carteira)", () => {
        const result = compute([vendedor], "funnel.view", { filial: ["f1"], carteira: ["u1", null] })
        expect(result).toEqual({
            allowed: true,
            dimensions: {
                filial: { kind: "values", values: ["f1"] },
                carteira: { kind: "values", values: ["u1", null] },
            },
        })
        expect(isWithinScope(result, { filial: "f1", carteira: null })).toBe(true)
        expect(isWithinScope(result, { filial: "f1", carteira: "u2" })).toBe(false)
        expect(isWithinScope(result, { filial: "f2", carteira: "u1" })).toBe(false)
    })

    it("restrição vence entre cargos (restrictive)", () => {
        expect(restrictedScopes(scopes, [vendedor, diretoria])).toEqual(["filial", "carteira"])
        const result = compute([gerente, diretoria], "funnel.view", { filial: ["f1"] })
        expect(result.allowed && result.dimensions.carteira).toEqual({ kind: "global" })
        expect(result.allowed && result.dimensions.filial).toEqual({ kind: "values", values: ["f1"] })
    })

    it("permissive só restringe se todos os cargos restringirem", () => {
        const a = role({ id: "a", escopos: ["regiao"] })
        const b = role({ id: "b", escopos: [] })
        expect(restrictedScopes(scopes, [a, b])).toEqual([])
        expect(restrictedScopes(scopes, [a])).toEqual(["regiao"])
    })

    it("lista vazia significa nenhum dado, nunca global", () => {
        const result = compute([vendedor], "funnel.view", { filial: [], carteira: ["u1", null] })
        expect(isEmptyScope(result)).toBe(true)
    })

    it("escopo não declarado pela folha é ignorado", () => {
        const result = compute([vendedor], "offers.view", { filial: ["f1"] })
        expect(result.allowed && Object.keys(result.dimensions)).toEqual(["filial"])
    })

    it("sem a permissão de ver, nada é permitido", () => {
        const semVer = role({ id: "x", escopos: [], permissoes: [] })
        const result = compute([semVer], "funnel.view")
        expect(result).toEqual({ allowed: false })
        expect(isEmptyScope(result)).toBe(true)
    })

    it("resolveScope só chama resolvedores dos escopos restritos aplicáveis", async () => {
        const filial = vi.fn(() => ["f1"])
        const carteira = vi.fn(async () => ["u1", null] as const)
        const regiao = vi.fn(() => ["r1"])
        const result = await resolveScope({
            catalog,
            registry: scopes,
            roles: [gerente],
            effective: expandPermissions([gerente]),
            viewKey: "funnel.view",
            resolvers: { filial, carteira, regiao },
            ctx: { companyId: "c1" },
        })
        expect(filial).toHaveBeenCalledWith({ companyId: "c1" })
        expect(carteira).not.toHaveBeenCalled()
        expect(regiao).not.toHaveBeenCalled()
        expect(result.allowed && result.dimensions.carteira).toEqual({ kind: "global" })
    })
})
