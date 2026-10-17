import { describe, expect, it, vi } from "vitest"
import { createAccessControl, createMemoryAssignmentStore, parseAssignment, serializeAssignment } from "../src"
import {
    createClerkAccessControl,
    createClerkAssignmentStore,
    readAssignmentFromClaims,
    type ClerkClientLike,
    type ClerkUserLike,
} from "../src/clerk"
import { role } from "./fixtures"

interface Extra {
    empresas: { companyId: string; filiais: string[] }[]
}

/** Clerk falso: guarda usuários e MESCLA o nível de cima do publicMetadata, como a API real. */
function fakeClerk(users: ClerkUserLike[]) {
    const byId = new Map(users.map((user) => [user.id, { ...user, publicMetadata: { ...(user.publicMetadata ?? {}) } }]))
    const client: ClerkClientLike = {
        users: {
            getUser: vi.fn(async (id: string) => {
                const user = byId.get(id)
                if (!user) throw new Error("not found")
                return user
            }),
            updateUserMetadata: vi.fn(async (id: string, params: { publicMetadata?: Record<string, unknown> }) => {
                const user = byId.get(id)
                if (!user) throw new Error("not found")
                user.publicMetadata = { ...user.publicMetadata, ...params.publicMetadata }
                return user
            }),
            getUserList: vi.fn(async ({ limit = 10, offset = 0 }: { limit?: number; offset?: number }) => ({
                data: [...byId.values()].slice(offset, offset + limit),
            })),
        },
    }
    return { client, byId }
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

describe("store do Clerk (padrão)", () => {
    it("grava só a chave do namespace e preserva os demais metadados", async () => {
        const { client, byId } = fakeClerk([{ id: "u1", publicMetadata: { tema: "escuro" } }])
        const store = createClerkAssignmentStore<Extra>({ client })
        await store.set("u1", { roles: ["admin"], extra: { empresas: [{ companyId: "c1", filiais: [] }] } })
        expect(byId.get("u1")?.publicMetadata).toEqual({
            tema: "escuro",
            perfix: { roles: ["admin"], extra: { empresas: [{ companyId: "c1", filiais: [] }] } },
        })
        expect(await store.get("u1")).toEqual({ roles: ["admin"], extra: { empresas: [{ companyId: "c1", filiais: [] }] } })
    })

    it("aceita o cliente como função (clerkClient) e namespace próprio", async () => {
        const { client, byId } = fakeClerk([{ id: "u1" }])
        const store = createClerkAssignmentStore({ client: async () => client, namespace: "acesso" })
        await store.set("u1", { roles: ["x"] })
        expect(byId.get("u1")?.publicMetadata).toEqual({ acesso: { roles: ["x"] } })
    })

    it("list pagina o Clerk, filtra e usa cache até a próxima escrita", async () => {
        const users = Array.from({ length: 3 }, (_, i) => ({ id: `u${i}`, publicMetadata: { perfix: { roles: i === 1 ? ["gerente"] : [] } } }))
        const { client } = fakeClerk(users)
        const store = createClerkAssignmentStore({ client })
        const gerentes = await store.list?.((a) => a.roles.includes("gerente"))
        expect(gerentes?.map((row) => row.userId)).toEqual(["u1"])
        await store.list?.()
        expect(client.users.getUserList).toHaveBeenCalledTimes(1)
        await store.set("u0", { roles: ["gerente"] })
        const depois = (await store.list?.((a) => a.roles.includes("gerente"))) ?? []
        expect(depois.map((r) => r.userId)).toEqual(["u0", "u1"])
    })

    it("claims da sessão: lê o namespace; sem a claim devolve null", () => {
        expect(readAssignmentFromClaims({ perfix: { roles: ["a"] } })).toEqual({ roles: ["a"] })
        expect(readAssignmentFromClaims({ perfix: '{"roles":["b"]}' })).toEqual({ roles: ["b"] })
        expect(readAssignmentFromClaims({ sub: "u1" })).toBeNull()
        expect(readAssignmentFromClaims({ perfix: "" })).toBeNull()
        expect(readAssignmentFromClaims(null)).toBeNull()
    })

    it("createClerkAccessControl carrega atribuição e cargos; usa a atribuição dada sem ler o Clerk", async () => {
        const { client } = fakeClerk([{ id: "u1", publicMetadata: { perfix: { roles: ["vendedor"] } } }])
        const access = createClerkAccessControl({ client, roles })
        const loaded = await access.load("u1")
        expect(loaded.roles.map((r) => r.id)).toEqual(["vendedor"])

        vi.mocked(client.users.getUser).mockClear()
        await access.load("u1", { roles: ["admin"] })
        expect(client.users.getUser).not.toHaveBeenCalled()
    })
})

describe("opt-out: store próprio", () => {
    it("createAccessControl com store da aplicação não usa o Clerk", async () => {
        const store = createMemoryAssignmentStore({ u1: { roles: ["gerente"] } })
        const access = createAccessControl({ roles, assignments: store })
        expect((await access.load("u1")).roles.map((r) => r.id)).toEqual(["gerente"])
        expect((await access.load("desconhecido")).roles).toEqual([])
    })
})
