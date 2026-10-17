import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { expandPermissions } from "../src"
import { Can, PermissionsProvider, usePermissions } from "../src/react"
import { createGuards, isPermissionError } from "../src/server"
import { catalog, role, scopes } from "./fixtures"

const vendedor = role({ id: "vendedor", escopos: ["filial", "carteira"], permissoes: ["funnel.view"] })

describe("guardas de servidor", () => {
    const guards = createGuards({
        catalog,
        getAuth: async () => ({ roles: [vendedor], effective: expandPermissions([vendedor]) }),
        scopes: {
            registry: scopes,
            resolvers: { filial: () => ["f1"], carteira: () => ["u1", null], regiao: () => [] },
        },
    })

    it("403 sem permissão, ok com permissão", async () => {
        await expect(guards.requirePermission("funnel.view")).resolves.toBeTruthy()
        const error = await guards.requirePermission("roles.edit").catch((e: unknown) => e)
        expect(isPermissionError(error) && error.status).toBe(403)
    })

    it("401 sem autenticação", async () => {
        const anon = createGuards({ catalog, getAuth: async () => null })
        const error = await anon.requireAnyPermission(["funnel.view"]).catch((e: unknown) => e)
        expect(isPermissionError(error) && error.status).toBe(401)
    })

    it("requireScope devolve o escopo resolvido", async () => {
        const { scope } = await guards.requireScope("funnel.view", {})
        expect(scope).toEqual({
            allowed: true,
            dimensions: {
                filial: { kind: "values", values: ["f1"] },
                carteira: { kind: "values", values: ["u1", null] },
            },
        })
    })
})

describe("provider de UI", () => {
    function Probe() {
        const { can, isAdmin } = usePermissions()
        return <span>{`${can("funnel.view")}-${can("roles.edit")}-${isAdmin}`}</span>
    }

    it("expõe can/Can e trata loading como sem permissão", () => {
        const html = renderToStaticMarkup(
            <PermissionsProvider permissions={["funnel.view"]}>
                <Probe />
                <Can permission="roles.edit" fallback={<i>não</i>}>
                    <b>sim</b>
                </Can>
            </PermissionsProvider>,
        )
        expect(html).toContain("true-false-false")
        expect(html).toContain("<i>não</i>")

        const loading = renderToStaticMarkup(
            <PermissionsProvider permissions={["*"]} loading>
                <Probe />
            </PermissionsProvider>,
        )
        expect(loading).toContain("false-false-true")
    })
})
