/**
 * Hierarquia de cargos — quem pode atribuir, editar e reordenar qual cargo.
 *
 * Cargos ficam numa lista ordenada (índice 0 = topo). Ninguém entrega cargo ACIMA da
 * própria posição (posição igual é permitida, como no Smart Desk). Sobre a hierarquia vale o
 * piso das chaves sensíveis: ninguém entrega cargo que conceda chave `sensitive` que não possui.
 *
 * Fail-closed: cargo sem posição vai para o pé; o coringa é o topo absoluto.
 * Módulo ISOMÓRFICO.
 */

import { WILDCARD, type Catalog } from "./catalog"
import { expandPermissions, hasPermission, type EffectivePermissions, type RoleLike } from "./permission-set"

/** Posição de quem não tem cargo nenhum: abaixo de qualquer cargo real. */
export const NO_POSITION = Number.POSITIVE_INFINITY

export type UnassignableReason = "hierarquia" | "chave-sensivel"

export interface UnassignableRole {
    readonly id: string
    readonly motivo: UnassignableReason
}

export const UNASSIGNABLE_LABELS: Record<UnassignableReason, string> = {
    hierarquia: "Este cargo está acima do seu — você não pode concedê-lo",
    "chave-sensivel": "Este cargo concede permissões sensíveis que você não possui",
}

/** Posição do cargo — o coringa é `-Infinity` (topo absoluto). */
export function rolePosition(cargo: Pick<RoleLike, "posicao" | "permissoes">): number {
    if (cargo.permissoes.includes(WILDCARD)) return Number.NEGATIVE_INFINITY
    return cargo.posicao ?? NO_POSITION
}

/** Posição de quem concede = a do seu cargo ATIVO mais alto. */
export function callerPosition(cargos: readonly RoleLike[] = []): number {
    const ativos = cargos.filter((cargo) => cargo.ativo !== false)
    if (ativos.length === 0) return NO_POSITION
    return Math.min(...ativos.map(rolePosition))
}

/** O solicitante pode administrar este usuário? (empate permitido) */
export function canManageUser(callerCargos: readonly RoleLike[] = [], targetCargos: readonly RoleLike[] = []): boolean {
    return callerPosition(callerCargos) <= callerPosition(targetCargos)
}

/**
 * O solicitante pode editar, excluir ou gerenciar os membros deste cargo?
 * Definir cargos é exclusivo de quem tem o coringa, e o cargo com coringa nunca é editável.
 */
export function canManageRole(callerCargos: readonly RoleLike[] = [], alvo: Pick<RoleLike, "permissoes">): boolean {
    if (alvo.permissoes.includes(WILDCARD)) return false
    return expandPermissions(callerCargos).has(WILDCARD)
}

/** Reordenar segue a mesma regra de `canManageRole`; o cargo com coringa não é arrastável. */
export function canReorderRole(callerCargos: readonly RoleLike[] = [], alvo: Pick<RoleLike, "permissoes">): boolean {
    return canManageRole(callerCargos, alvo)
}

function temChaveSensivelQueFalta(catalog: Catalog, efetivas: EffectivePermissions, alvo: RoleLike): boolean {
    if (alvo.permissoes.includes(WILDCARD)) return true
    return catalog.getSensitiveKeys(alvo.permissoes).some((key) => !hasPermission(efetivas, key))
}

/** Cargos que o solicitante NÃO pode atribuir, com o motivo. Quem tem `*` não é barrado. */
export function getUnassignableRoles(
    catalog: Catalog,
    callerCargos: readonly RoleLike[] = [],
    alvos: readonly RoleLike[] = [],
): UnassignableRole[] {
    const efetivas = expandPermissions(callerCargos)
    if (efetivas.has(WILDCARD)) return []

    const teto = callerPosition(callerCargos)
    const recusados: UnassignableRole[] = []

    for (const alvo of alvos) {
        if (rolePosition(alvo) < teto) {
            recusados.push({ id: alvo.id, motivo: "hierarquia" })
            continue
        }
        if (temChaveSensivelQueFalta(catalog, efetivas, alvo)) {
            recusados.push({ id: alvo.id, motivo: "chave-sensivel" })
        }
    }
    return recusados
}

export function canAssignRole(catalog: Catalog, callerCargos: readonly RoleLike[], alvo: RoleLike): boolean {
    return getUnassignableRoles(catalog, callerCargos, [alvo]).length === 0
}
