import { describe, expect, it } from "vitest"
import {
    canManageRole,
    canManageUser,
    evaluateRoleAssignment,
    getUnassignableRoles,
    getUngrantableKeys,
    WILDCARD,
} from "../src"
import { catalog, role } from "./fixtures"

const admin = role({ id: "admin", posicao: 0, permissoes: [WILDCARD] })
const gerente = role({ id: "gerente", posicao: 1, permissoes: ["funnel.view", "funnel.move", "offers.view"] })
const vendedor = role({ id: "vendedor", posicao: 2, permissoes: ["funnel.view"] })
const importador = role({ id: "importador", posicao: 3, permissoes: ["offers.view", "offers.import"] })

describe("hierarquia", () => {
    it("não atribui cargo acima do próprio; empate permitido", () => {
        expect(getUnassignableRoles(catalog, [gerente], [admin, gerente, vendedor])).toEqual([
            { id: "admin", motivo: "hierarquia" },
        ])
    })

    it("não atribui cargo com chave sensível que não possui, mesmo abaixo", () => {
        expect(getUnassignableRoles(catalog, [gerente], [importador])).toEqual([
            { id: "importador", motivo: "chave-sensivel" },
        ])
    })

    it("coringa atribui qualquer cargo", () => {
        expect(getUnassignableRoles(catalog, [admin], [admin, importador])).toEqual([])
    })

    it("cargo sem posição fica no pé (fail-closed)", () => {
        const semPosicao = role({ id: "x", permissoes: ["funnel.view"] })
        expect(canManageUser([semPosicao], [vendedor])).toBe(false)
        expect(canManageUser([gerente], [vendedor])).toBe(true)
    })

    it("cargo inativo não conta para a posição do solicitante", () => {
        const gerenteInativo = { ...gerente, ativo: false }
        expect(getUnassignableRoles(catalog, [gerenteInativo, vendedor], [gerente])).toEqual([
            { id: "gerente", motivo: "hierarquia" },
        ])
    })

    it("definir cargos é exclusivo do coringa e o cargo coringa não é editável", () => {
        expect(canManageRole([admin], vendedor)).toBe(true)
        expect(canManageRole([gerente], vendedor)).toBe(false)
        expect(canManageRole([admin], admin)).toBe(false)
    })

    it("monotonicidade ao definir permissões", () => {
        expect(getUngrantableKeys(new Set(["funnel.view"]), ["funnel.view", "roles.edit"])).toEqual(["roles.edit"])
        expect(getUngrantableKeys(new Set([WILDCARD]), ["roles.edit"])).toEqual([])
    })
})

describe("evaluateRoleAssignment", () => {
    const loaded = [admin, gerente, vendedor, importador]

    it("aprova delta dentro do alcance e preserva cargo atual fora do alcance", () => {
        const result = evaluateRoleAssignment({
            catalog,
            callerCargos: [gerente],
            requested: ["vendedor"],
            current: ["admin"],
            loaded,
        })
        expect(result).toEqual({ status: "ok", cargos: ["vendedor", "admin"] })
    })

    it("recusa escalada e cargo inexistente", () => {
        expect(
            evaluateRoleAssignment({ catalog, callerCargos: [gerente], requested: ["admin"], loaded }).status,
        ).toBe("escalation")
        expect(
            evaluateRoleAssignment({ catalog, callerCargos: [admin], requested: ["nao-existe"], loaded }),
        ).toEqual({ status: "invalid-roles", ids: ["nao-existe"] })
    })

    it("payload sem cargos não mexe em nada", () => {
        expect(evaluateRoleAssignment({ catalog, callerCargos: [admin], requested: undefined, loaded })).toEqual({
            status: "untouched",
        })
    })
})
