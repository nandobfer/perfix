import { afterEach, describe, expect, it, vi } from "vitest"
import { assignmentVersion, createMemoryAssignmentStore, parseAssignment, serializeAssignment, type AssignmentStore } from "../src"
import { createFreshAssignmentResolver } from "../src/clerk"

function spyStore(initial: Record<string, { roles: string[]; version?: number }>) {
    const store = createMemoryAssignmentStore(initial)
    const get = vi.fn(store.get)
    return { store: { ...store, get } satisfies AssignmentStore, get }
}

afterEach(() => {
    vi.useRealTimers()
})

describe("versão da atribuição", () => {
    it("lê, serializa e trata versão ausente ou inválida como 0", () => {
        expect(parseAssignment({ roles: ["a"], version: 3 })).toEqual({ roles: ["a"], version: 3 })
        expect(serializeAssignment({ roles: ["a"], version: 3 })).toEqual({ roles: ["a"], version: 3 })
        expect(parseAssignment({ roles: ["a"], version: -1 })).toEqual({ roles: ["a"] })
        expect(parseAssignment({ roles: ["a"], version: "2" })).toEqual({ roles: ["a"] })
        expect(assignmentVersion(parseAssignment({ roles: [] }))).toBe(0)
        expect(assignmentVersion(null)).toBe(0)
    })
})

describe("createFreshAssignmentResolver", () => {
    it("usa a claim quando a versão dela é atual, sem ler o store", async () => {
        const { store, get } = spyStore({ u1: { roles: ["novo"], version: 2 } })
        const resolver = createFreshAssignmentResolver({ store })
        const result = await resolver.resolve({ userId: "u1", claims: { perfix: { roles: ["admin"], version: 2 } }, minVersion: 2 })
        expect(result).toEqual({ assignment: { roles: ["admin"], version: 2 }, source: "claims" })
        expect(get).not.toHaveBeenCalled()
    })

    it("claim atrasada relê o store: a atribuição retirada deixa de valer na hora", async () => {
        const { store, get } = spyStore({ u1: { roles: [], version: 3 } })
        const resolver = createFreshAssignmentResolver({ store })
        const result = await resolver.resolve({ userId: "u1", claims: { perfix: { roles: ["admin"], version: 2 } }, minVersion: 3 })
        expect(result).toEqual({ assignment: { roles: [], version: 3 }, source: "store" })
        expect(get).toHaveBeenCalledTimes(1)
    })

    it("claim sem versão vale como 0 e é aceita enquanto a aplicação não exige versão", async () => {
        const { store, get } = spyStore({})
        const resolver = createFreshAssignmentResolver({ store })
        const result = await resolver.resolve({ userId: "u1", claims: { perfix: { roles: ["a"] } }, minVersion: 0 })
        expect(result.source).toBe("claims")
        expect(get).not.toHaveBeenCalled()
    })

    it("cacheia a leitura do store, mas nunca atende a uma versão maior com o cache antigo", async () => {
        const { store, get } = spyStore({ u1: { roles: ["a"], version: 1 } })
        const resolver = createFreshAssignmentResolver({ store })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 1 })
        expect((await resolver.resolve({ userId: "u1", claims: null, minVersion: 1 })).source).toBe("cache")
        expect(get).toHaveBeenCalledTimes(1)

        await store.set("u1", { roles: [], version: 2 })
        const result = await resolver.resolve({ userId: "u1", claims: null, minVersion: 2 })
        expect(result).toEqual({ assignment: { roles: [], version: 2 }, source: "store" })
        expect(get).toHaveBeenCalledTimes(2)
    })

    it("não cacheia quando o store ainda está atrás da versão exigida (gravação em andamento)", async () => {
        const { store, get } = spyStore({ u1: { roles: ["a"], version: 1 } })
        const resolver = createFreshAssignmentResolver({ store })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 2 })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 2 })
        expect(get).toHaveBeenCalledTimes(2)
    })

    it("o cache expira e forget descarta o usuário", async () => {
        vi.useFakeTimers()
        const { store, get } = spyStore({ u1: { roles: ["a"] } })
        const resolver = createFreshAssignmentResolver({ store, cacheMs: 1000 })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 0 })
        vi.advanceTimersByTime(1001)
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 0 })
        resolver.forget("u1")
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 0 })
        expect(get).toHaveBeenCalledTimes(3)
    })

    it("limita o tamanho do cache descartando o mais antigo", async () => {
        const { store, get } = spyStore({})
        const resolver = createFreshAssignmentResolver({ store, maxEntries: 1 })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 0 })
        await resolver.resolve({ userId: "u2", claims: null, minVersion: 0 })
        await resolver.resolve({ userId: "u1", claims: null, minVersion: 0 })
        expect(get).toHaveBeenCalledTimes(3)
    })
})
