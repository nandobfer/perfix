import { describe, expect, it } from "vitest"
import {
    aplicarPosicoes,
    expandPermissions,
    getNodeState,
    hasAllPermissions,
    hasAnyPermission,
    hasPermission,
    intersectPermissions,
    ordenarPorPosicao,
    toggleNode,
    WILDCARD,
} from "../src"
import { catalog, role, TREE } from "./fixtures"

describe("conjunto efetivo", () => {
    it("une os cargos ativos e ignora os inativos", () => {
        const eff = expandPermissions([
            role({ id: "a", permissoes: ["funnel.view"] }),
            role({ id: "b", permissoes: ["offers.view"] }),
            role({ id: "c", permissoes: ["roles.edit"], ativo: false }),
        ])
        expect(hasPermission(eff, "funnel.view")).toBe(true)
        expect(hasPermission(eff, "offers.view")).toBe(true)
        expect(hasPermission(eff, "roles.edit")).toBe(false)
        expect(hasAnyPermission(eff, ["roles.edit", "offers.view"])).toBe(true)
        expect(hasAllPermissions(eff, ["roles.edit", "offers.view"])).toBe(false)
    })

    it("coringa concede qualquer chave", () => {
        const eff = expandPermissions([role({ id: "admin", permissoes: [WILDCARD] })])
        expect(hasPermission(eff, "roles.edit")).toBe(true)
    })

    it("interseção trata o coringa como 'todas'", () => {
        const all = new Set([WILDCARD])
        const some = new Set(["funnel.view"])
        expect([...intersectPermissions(all, some)]).toEqual(["funnel.view"])
        expect([...intersectPermissions(some, new Set(["offers.view"]))]).toEqual([])
    })
})

describe("árvore do formulário", () => {
    const funil = TREE[0]

    it("deriva estado tri-state e alterna com dependências", () => {
        expect(getNodeState(catalog, funil, new Set(["funnel.view"]))).toBe("indeterminate")
        const marcado = toggleNode(catalog, funil.children[2], new Set(), true)
        expect([...marcado].sort()).toEqual(["funnel.assign_bulk", "funnel.view"])
        expect(getNodeState(catalog, funil, new Set([WILDCARD]))).toBe("checked")
    })
})

describe("posições", () => {
    it("aplica índice da lista e manda ausentes para o pé, por nome", () => {
        const rows = aplicarPosicoes(
            [
                { _id: "z", nome: "Zeta" },
                { _id: "b", nome: "Beta" },
                { _id: "a", nome: "Alfa" },
            ],
            ["b", "orfao"],
        )
        expect(ordenarPorPosicao(rows).map((r) => r._id)).toEqual(["b", "a", "z"])
        expect(rows.find((r) => r._id === "a")?.posicao).toBe(2)
    })
})
