import { describe, expect, it, vi } from "vitest"
import { createAccessControl, createMemoryAssignmentStore, parseAssignment, serializeAssignment, type AssignmentStore } from "../src"
import { role } from "./fixtures"

interface Extra {
    empresas: { companyId: string; filiais: string[] }[]
}

const roles = { getRoles: vi.fn(async (ids: readonly string[]) => ids.map((id) => role({ id }))) }

describe("parseAssignment", () => {
    it("aceita objeto ou JSON em texto e remove cargos repetidos/inválidos", () => {
        expect(parseAssignment({ roles: ["a", "a", 1, ""] })).toEqual({ roles: ["a"] })
        expect(parseAssignment('{"roles":["b"],"extra":{"x":1}}')).toEqual({ roles: ["b"], extra: { x: 1 } })
    })

    it("formato inválido vira atribuição vazia (tira acesso)", () => {
        expect(parseAssignment("{quebrado")).toEqual({ roles: [] })
        expect(parseAssignment(["a"])).toEqual({ roles: [] })
        expect(parseAssignment(null)).toEqual({ roles: [] })
    })

    it("serializa sem undefined", () => {
        expect(serializeAssignment({ roles: ["a"] })).toEqual({ roles: ["a"] })
    })
})

describe("createAccessControl com store da aplicação", () => {
    it("carrega atribuição e cargos do store fornecido", async () => {
        const store = createMemoryAssignmentStore({ u1: { roles: ["gerente"] } })
        const access = createAccessControl({ roles, assignments: store })
        expect((await access.load("u1")).roles.map((r) => r.id)).toEqual(["gerente"])
        expect((await access.load("desconhecido")).roles).toEqual([])
    })

    it("expõe o store de atribuições recebido", () => {
        const store = createMemoryAssignmentStore<Extra>()
        const access = createAccessControl({ roles, assignments: store })
        expect(access.assignments).toBe(store)
    })

    it("usa a atribuição dada sem ler o store", async () => {
        const store = createMemoryAssignmentStore({ u1: { roles: ["gerente"] } })
        const get = vi.fn(store.get)
        const assignments: AssignmentStore = { ...store, get }
        const access = createAccessControl({ roles, assignments })
        const loaded = await access.load("u1", { roles: ["admin"] })
        expect(loaded.roles.map((r) => r.id)).toEqual(["admin"])
        expect(get).not.toHaveBeenCalled()
    })
})
