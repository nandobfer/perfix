import { describe, expect, it } from "vitest"
import { defineCatalog, WILDCARD } from "../src"
import { catalog } from "./fixtures"

describe("defineCatalog", () => {
    it("deriva chaves na ordem da árvore", () => {
        expect(catalog.keys).toEqual([
            "funnel.view",
            "funnel.move",
            "funnel.assign_bulk",
            "offers.view",
            "offers.import",
            "roles.edit",
        ])
    })

    it("exige a viewKey do grupo para as demais folhas, inclusive em subgrupos", () => {
        expect(catalog.requiredViewFor("funnel.move")).toBe("funnel.view")
        expect(catalog.requiredViewFor("funnel.assign_bulk")).toBe("funnel.view")
        expect(catalog.requiredViewFor("funnel.view")).toBeUndefined()
        expect(catalog.normalizePermissionDependencies(["funnel.assign_bulk"]).sort()).toEqual([
            "funnel.assign_bulk",
            "funnel.view",
        ])
    })

    it("coringa absorve tudo na normalização", () => {
        expect(catalog.normalizePermissionDependencies([WILDCARD, "funnel.move"])).toEqual([WILDCARD])
    })

    it("sanitiza chaves desconhecidas", () => {
        expect(catalog.sanitizePermissions(["funnel.move", "legacy.key"]).sort()).toEqual([
            "funnel.move",
            "funnel.view",
        ])
    })

    it("resolve seletores de grupo em folhas", () => {
        expect(catalog.resolveGrants(["ofertas"]).sort()).toEqual(["offers.import", "offers.view"])
        expect(catalog.resolveGrants(["desconhecido"])).toEqual([])
    })

    it("herda sensibilidade e escopos do grupo", () => {
        expect(catalog.meta.get("roles.edit")?.sensitive).toBe(true)
        expect(catalog.getSensitiveKeys(["offers.import", "funnel.move", WILDCARD])).toEqual(["offers.import"])
        expect(catalog.scopesFor("funnel.assign_bulk")).toEqual(["filial", "carteira"])
        expect(catalog.scopesFor("roles.edit")).toEqual([])
    })

    it("recusa chave duplicada e viewKey inexistente", () => {
        expect(() =>
            defineCatalog([
                { id: "a", label: "A", children: [{ key: "x", label: "X" }] },
                { id: "b", label: "B", children: [{ key: "x", label: "X" }] },
            ]),
        ).toThrow(/duplicada/)
        expect(() =>
            defineCatalog([{ id: "a", label: "A", viewKey: "y", children: [{ key: "x", label: "X" }] }]),
        ).toThrow(/viewKey/)
    })
})
