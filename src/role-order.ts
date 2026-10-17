/**
 * Posição dos cargos a partir da lista da hierarquia (índice 0 = topo; menor vence).
 * Módulo ISOMÓRFICO.
 */

import { POSICAO_AUSENTE, type RoleRowLike } from "./permission-set"

function rowId(row: RoleRowLike): string {
    return String(row._id ?? row.id ?? "")
}

/**
 * Atribui `posicao` a cada linha a partir da lista ordenada de ids. Cargo ausente vai para
 * o PÉ, desempatado por nome. Ids órfãos na lista são ignorados. Não reordena o resultado.
 */
export function aplicarPosicoes<T extends RoleRowLike>(
    rows: readonly T[],
    ordem: readonly string[],
): (T & { posicao: number })[] {
    const indicePorId = new Map(ordem.map((id, index) => [String(id), index]))

    const ausentes = rows
        .filter((row) => !indicePorId.has(rowId(row)))
        .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""))

    const posicaoDosAusentes = new Map(ausentes.map((row, index) => [rowId(row), ordem.length + index]))

    return rows.map((row) => ({
        ...row,
        posicao: indicePorId.get(rowId(row)) ?? posicaoDosAusentes.get(rowId(row)) ?? POSICAO_AUSENTE,
    }))
}

/** Do topo para o pé. */
export function ordenarPorPosicao<T extends { posicao: number }>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => a.posicao - b.posicao)
}
