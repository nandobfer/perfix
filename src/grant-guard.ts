/**
 * Guardas puras de concessão (sem I/O).
 *
 * `getUngrantableKeys` responde "quem pode DEFINIR as permissões de um cargo": ninguém
 * concede chave que não possui (monotonicidade). Quem tem `*` concede qualquer coisa.
 *
 * `evaluateRoleAssignment` responde "quem pode ATRIBUIR cargos prontos a um usuário":
 * hierarquia + piso de chaves sensíveis, validando apenas o delta e protegendo cargos atuais
 * fora do alcance (inclusive referências órfãs, fail-safe).
 */

import { WILDCARD, type Catalog } from "./catalog"
import { hasPermission, type EffectivePermissions, type RoleLike } from "./permission-set"
import { getUnassignableRoles, type UnassignableRole } from "./role-hierarchy"

export function getUngrantableKeys(effective: EffectivePermissions, keys: readonly string[]): string[] {
    if (effective.has(WILDCARD)) return []
    return [...new Set(keys)].filter((key) => !hasPermission(effective, key))
}

export type RoleAssignmentResult =
    | { status: "untouched" }
    | { status: "invalid-roles"; ids: string[] }
    | { status: "escalation"; cargos: UnassignableRole[] }
    | { status: "ok"; cargos: string[] }

export interface RoleAssignmentInput {
    catalog: Catalog
    /** Cargos do solicitante (com posição aplicada). */
    callerCargos: readonly RoleLike[]
    /** Ids pedidos no payload; `undefined` = payload não mexe em cargos. */
    requested: readonly string[] | undefined
    /** Ids atualmente gravados no usuário. */
    current?: readonly string[]
    /** Cargos carregados (pedidos + atuais), com posição aplicada. */
    loaded: readonly RoleLike[]
}

export function evaluateRoleAssignment(input: RoleAssignmentInput): RoleAssignmentResult {
    const { catalog, callerCargos, requested, current = [], loaded } = input
    if (requested === undefined) return { status: "untouched" }

    const pedidos = [...new Set(requested)]
    const atuais = [...new Set(current)]
    const atuaisSet = new Set(atuais)
    const byId = new Map(loaded.map((role) => [role.id, role]))

    const adicoes = pedidos.filter((id) => !atuaisSet.has(id))
    const invalidos = adicoes.filter((id) => {
        const role = byId.get(id)
        return !role || role.ativo === false
    })
    if (invalidos.length > 0) return { status: "invalid-roles", ids: invalidos }

    const recusados = getUnassignableRoles(
        catalog,
        callerCargos,
        adicoes.map((id) => byId.get(id) as RoleLike),
    )
    if (recusados.length > 0) return { status: "escalation", cargos: recusados }

    const carregadosAtuais = atuais.map((id) => byId.get(id)).filter((r): r is RoleLike => r !== undefined)
    const protegidos = new Set(getUnassignableRoles(catalog, callerCargos, carregadosAtuais).map((r) => r.id))
    for (const id of atuais) if (!byId.has(id)) protegidos.add(id)

    return { status: "ok", cargos: [...new Set([...pedidos, ...protegidos])] }
}
