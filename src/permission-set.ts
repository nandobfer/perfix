/**
 * Conjuntos de permissão (modelo de cargos do Discord, como no Smart Desk).
 *
 * Um usuário tem um ou mais CARGOS; o acesso efetivo é a UNIÃO das permissões dos cargos
 * ATIVOS. Não existe permissão avulsa no usuário.
 *
 * Módulo ISOMÓRFICO: as funções recebem os cargos já carregados (documentos), nunca ids.
 */

import { WILDCARD, isPermissionLeaf, type Catalog, type PermissionNodeDef, type Wildcard } from "./catalog"

/**
 * Posição de um cargo fora da lista da hierarquia. Vai para o PÉ, nunca para o topo —
 * errar para o lado que tira poder.
 */
export const POSICAO_AUSENTE = Number.MAX_SAFE_INTEGER

/** O mínimo que esta biblioteca precisa saber de um cargo. */
export interface RoleLike {
    readonly id: string
    readonly slug: string
    readonly nome: string
    readonly cor?: string
    /** Índice na lista da hierarquia — 0 é o topo, menor vence. */
    readonly posicao: number
    /** Somente `false` revoga o cargo (ausente = ativo). */
    readonly ativo?: boolean
    /** Escopos de dados que o cargo restringe (definidos pela aplicação). */
    readonly escopos?: readonly string[]
    readonly permissoes: readonly string[]
}

/** Documento cru de cargo (Mongo `.lean()` ou JSON da API). */
export interface RoleRowLike {
    _id?: unknown
    id?: unknown
    slug?: string
    nome?: string
    cor?: string
    posicao?: number
    ativo?: boolean
    escopos?: readonly string[]
    permissoes?: readonly string[]
}

export function toRoleLike(row: RoleRowLike): RoleLike {
    return {
        id: String(row._id ?? row.id ?? ""),
        slug: row.slug ?? "",
        nome: row.nome ?? "",
        cor: row.cor,
        posicao: row.posicao ?? POSICAO_AUSENTE,
        ativo: row.ativo !== false,
        escopos: row.escopos ?? [],
        permissoes: row.permissoes ?? [],
    }
}

export type EffectivePermissions = ReadonlySet<string>

/** Conjunto efetivo = união das permissões dos cargos ativos. `*` fica literal. */
export function expandPermissions(cargos: readonly RoleLike[] = []): EffectivePermissions {
    const out = new Set<string>()
    for (const cargo of cargos) {
        if (cargo.ativo === false) continue
        for (const key of cargo.permissoes) out.add(key)
    }
    return out
}

/** Interseção de dois conjuntos efetivos (usada para "ver como"). `*` = todas. */
export function intersectPermissions(a: EffectivePermissions, b: EffectivePermissions): EffectivePermissions {
    const aTudo = a.has(WILDCARD)
    const bTudo = b.has(WILDCARD)
    if (aTudo && bTudo) return new Set([WILDCARD])
    if (aTudo) return new Set(b)
    if (bTudo) return new Set(a)
    return new Set([...a].filter((key) => b.has(key)))
}

export function hasPermission(effective: EffectivePermissions, key: string): boolean {
    return effective.has(WILDCARD) || effective.has(key)
}

export function hasAnyPermission(effective: EffectivePermissions, keys: readonly string[]): boolean {
    return keys.some((key) => hasPermission(effective, key))
}

export function hasAllPermissions(effective: EffectivePermissions, keys: readonly string[]): boolean {
    return keys.every((key) => hasPermission(effective, key))
}

export function isWildcard(effective: EffectivePermissions): boolean {
    return effective.has(WILDCARD)
}

/** Cargos ordenados pela hierarquia — o mais alto primeiro. */
export function resolveUserRoles<R extends RoleLike>(cargos: readonly R[] = []): R[] {
    return [...cargos].sort((a, b) => a.posicao - b.posicao)
}

// ---------------------------------------------------------------------------
// Estado da árvore (formulário de cargo)
// ---------------------------------------------------------------------------

export type PermissionNodeState = "checked" | "indeterminate" | "unchecked"

export function getNodeState(
    catalog: Catalog,
    node: PermissionNodeDef,
    selected: ReadonlySet<string>,
): PermissionNodeState {
    if (selected.has(WILDCARD)) return "checked"
    const leaves = catalog.getLeafKeys(node)
    if (leaves.length === 0) return "unchecked"
    const marked = leaves.filter((key) => selected.has(key)).length
    if (marked === 0) return "unchecked"
    if (marked === leaves.length) return "checked"
    return "indeterminate"
}

/** Marca ou desmarca um nó e toda a sua descendência, normalizando dependências. */
export function toggleNode(
    catalog: Catalog,
    node: PermissionNodeDef,
    selected: ReadonlySet<string>,
    next: boolean,
): Set<string> {
    const out = new Set(selected)
    for (const key of catalog.getLeafKeys(node)) {
        if (next) out.add(key)
        else out.delete(key)
    }
    return new Set<string>(catalog.normalizePermissionDependencies(out))
}

export function countNodeLeaves(
    catalog: Catalog,
    node: PermissionNodeDef,
    selected: ReadonlySet<string>,
): { marked: number; total: number } {
    const leaves = catalog.getLeafKeys(node)
    if (selected.has(WILDCARD)) return { marked: leaves.length, total: leaves.length }
    return { marked: leaves.filter((key) => selected.has(key)).length, total: leaves.length }
}

/** Filtra a árvore por texto, preservando os ancestrais dos nós que casam. */
export function filterPermissionNodes(nodes: readonly PermissionNodeDef[], query: string): PermissionNodeDef[] {
    const term = query.trim().toLowerCase()
    if (!term) return [...nodes]

    const out: PermissionNodeDef[] = []
    for (const node of nodes) {
        const matchesSelf = node.label.toLowerCase().includes(term)
        if (isPermissionLeaf(node)) {
            if (matchesSelf || node.key.toLowerCase().includes(term)) out.push(node)
            continue
        }
        if (matchesSelf) {
            out.push(node)
            continue
        }
        const children = filterPermissionNodes(node.children, query)
        if (children.length > 0) out.push({ ...node, children })
    }
    return out
}

export type { Wildcard }
