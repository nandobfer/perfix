import { defineCatalog, defineScopes, toRoleLike, type PermissionBranchDef, type RoleLike } from "../src"

export const TREE = [
    {
        id: "funil",
        label: "Funil",
        viewKey: "funnel.view",
        scopes: ["filial", "carteira"],
        children: [
            { key: "funnel.view", label: "Visualizar" },
            { key: "funnel.move", label: "Mover" },
            {
                id: "funil-lote",
                label: "Lote",
                children: [{ key: "funnel.assign_bulk", label: "Atribuir em lote" }],
            },
        ],
    },
    {
        id: "ofertas",
        label: "Ofertas",
        viewKey: "offers.view",
        scopes: ["filial"],
        children: [
            { key: "offers.view", label: "Visualizar" },
            { key: "offers.import", label: "Importar", sensitive: true },
        ],
    },
    {
        id: "admin",
        label: "Administração",
        sensitive: true,
        children: [{ key: "roles.edit", label: "Editar cargos" }],
    },
] as const satisfies readonly PermissionBranchDef[]

export const catalog = defineCatalog(TREE)

export const scopes = defineScopes({
    filial: { label: "Filial" },
    carteira: { label: "Carteira" },
    regiao: { label: "Região", combine: "permissive" },
})

export function role(partial: Partial<RoleLike> & { id: string }): RoleLike {
    return toRoleLike({
        _id: partial.id,
        slug: partial.slug ?? partial.id,
        nome: partial.nome ?? partial.id,
        posicao: partial.posicao,
        ativo: partial.ativo,
        escopos: partial.escopos,
        permissoes: partial.permissoes ?? [],
    })
}
