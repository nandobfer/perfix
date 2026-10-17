/**
 * Catálogo de permissões em árvore (módulos → subgrupos → folhas).
 *
 * Módulo ISOMÓRFICO e sem dependências: roda no servidor e no navegador.
 *
 * A aplicação declara a árvore com `defineCatalog(tree)`. O catálogo devolvido é a única
 * fonte das chaves conhecidas, dos metadados de cada folha, da dependência da folha de
 * visualização (`viewKey`) e dos escopos de dados que valem para cada folha (`scopes`,
 * herdado pelos filhos).
 */

/** Concede tudo. Persistido literalmente nas permissões do cargo Administrador. */
export const WILDCARD = "*" as const
export type Wildcard = typeof WILDCARD

/** Folha = permissão atômica. `key` é o identificador canônico, por domínio. */
export interface PermissionLeafDef {
    readonly key: string
    readonly label: string
    readonly description?: string
    /** Só concedível por quem já a possui (piso sobre a hierarquia). */
    readonly sensitive?: boolean
}

/** Nó intermediário: módulo (raiz) ou subgrupo. Profundidade arbitrária. */
export interface PermissionBranchDef {
    readonly id: string
    readonly label: string
    readonly description?: string
    /** Torna sensíveis todas as folhas abaixo. */
    readonly sensitive?: boolean
    /** Folha que precisa acompanhar qualquer outra ação deste grupo. */
    readonly viewKey?: string
    /**
     * Escopos de dados (definidos pela aplicação com `defineScopes`) que valem para as
     * folhas deste grupo. Herdado pelos subgrupos; um subgrupo pode redeclarar.
     */
    readonly scopes?: readonly string[]
    readonly children: readonly PermissionNodeDef[]
}

export type PermissionNodeDef = PermissionLeafDef | PermissionBranchDef

export function isPermissionLeaf(node: PermissionNodeDef): node is PermissionLeafDef {
    return "key" in node
}

type ExtractLeafKeys<T> = T extends readonly unknown[]
    ? ExtractLeafKeys<T[number]>
    : T extends { readonly children: infer C }
      ? ExtractLeafKeys<C>
      : T extends { readonly key: infer K }
        ? K extends string
            ? K
            : never
        : never

type ExtractNodeIds<T> = T extends readonly unknown[]
    ? ExtractNodeIds<T[number]>
    : T extends { readonly id: infer I; readonly children: infer C }
      ? (I extends string ? I : never) | ExtractNodeIds<C>
      : never

/** União das chaves de folha de uma árvore declarada `as const`. */
export type LeafKeysOf<T> = ExtractLeafKeys<T>
/** União dos ids de módulo/subgrupo de uma árvore declarada `as const`. */
export type NodeIdsOf<T> = ExtractNodeIds<T>

export interface PermissionMeta<K extends string = string> {
    readonly key: K
    readonly label: string
    readonly description?: string
    readonly sensitive: boolean
    /** Caminho de rótulos até a folha ("Administração › Cargos › Edição"). */
    readonly path: readonly string[]
    /** Escopos de dados aplicáveis à folha (herdados do grupo). */
    readonly scopes: readonly string[]
}

export interface Catalog<K extends string = string, N extends string = string> {
    readonly tree: readonly PermissionBranchDef[]
    /** Todas as chaves, na ordem da árvore. */
    readonly keys: readonly K[]
    readonly meta: ReadonlyMap<string, PermissionMeta<K>>
    readonly nodes: ReadonlyMap<string, PermissionBranchDef>
    isKnownKey(key: string): key is K
    getLeafKeys(node: PermissionNodeDef): K[]
    requiredViewFor(key: string): K | undefined
    isRequiredView(key: string, selected: ReadonlySet<string>): boolean
    /** Garante que toda ação carregue a visualização do próprio grupo. `*` absorve tudo. */
    normalizePermissionDependencies(selected: Iterable<string>): Array<K | Wildcard>
    /** Remove chaves desconhecidas (mantém `*`) e normaliza dependências. */
    sanitizePermissions(selected: Iterable<string>): Array<K | Wildcard>
    /** Expande seletores (ids de nó, chaves ou `*`) nas chaves de folha. */
    resolveGrants(selectors: readonly (K | N | Wildcard | string)[]): Array<K | Wildcard>
    /** Chaves sensíveis presentes num conjunto (ignora `*`). */
    getSensitiveKeys(selected: Iterable<string>): K[]
    /** Escopos de dados aplicáveis a uma folha. */
    scopesFor(key: string): readonly string[]
}

function collectLeaves(
    nodes: readonly PermissionNodeDef[],
    ancestors: string[],
    inheritedSensitive: boolean,
    inheritedScopes: readonly string[],
    out: Map<string, PermissionMeta>,
): void {
    for (const node of nodes) {
        const sensitive = inheritedSensitive || node.sensitive === true

        if (isPermissionLeaf(node)) {
            if (out.has(node.key)) {
                throw new Error(`@nandobfer/perfix: chave duplicada no catálogo: "${node.key}"`)
            }
            out.set(node.key, {
                key: node.key,
                label: node.label,
                description: node.description,
                sensitive,
                path: [...ancestors, node.label],
                scopes: inheritedScopes,
            })
            continue
        }

        const scopes = node.scopes ?? inheritedScopes
        collectLeaves(node.children, [...ancestors, node.label], sensitive, scopes, out)
    }
}

function collectNodes(nodes: readonly PermissionNodeDef[], out: Map<string, PermissionBranchDef>): void {
    for (const node of nodes) {
        if (isPermissionLeaf(node)) continue
        if (out.has(node.id)) {
            throw new Error(`@nandobfer/perfix: id de grupo duplicado no catálogo: "${node.id}"`)
        }
        out.set(node.id, node)
        collectNodes(node.children, out)
    }
}

function leafKeysOf(node: PermissionNodeDef): string[] {
    if (isPermissionLeaf(node)) return [node.key]
    return node.children.flatMap(leafKeysOf)
}

/**
 * Declara o catálogo. Declare a árvore `as const` para obter a união de chaves tipada:
 *
 * ```ts
 * const TREE = [...] as const satisfies readonly PermissionBranchDef[]
 * export const catalog = defineCatalog(TREE)
 * export type PermissionKey = LeafKeysOf<typeof TREE>
 * ```
 */
export function defineCatalog<const T extends readonly PermissionBranchDef[]>(
    tree: T,
): Catalog<LeafKeysOf<T>, NodeIdsOf<T>> {
    type K = LeafKeysOf<T>
    type N = NodeIdsOf<T>

    const meta = new Map<string, PermissionMeta>()
    collectLeaves(tree, [], false, [], meta)

    const nodes = new Map<string, PermissionBranchDef>()
    collectNodes(tree, nodes)

    const requiredView = new Map<string, string>()
    for (const node of nodes.values()) {
        if (!node.viewKey) continue
        if (!meta.has(node.viewKey)) {
            throw new Error(
                `@nandobfer/perfix: viewKey "${node.viewKey}" do grupo "${node.id}" não é folha do catálogo`,
            )
        }
        for (const key of leafKeysOf(node)) {
            if (key !== node.viewKey && !requiredView.has(key)) requiredView.set(key, node.viewKey)
        }
    }

    const isKnownKey = (key: string): key is K => meta.has(key)

    const requiredViewFor = (key: string): K | undefined => requiredView.get(key) as K | undefined

    const normalizePermissionDependencies = (selected: Iterable<string>): Array<K | Wildcard> => {
        const out = new Set<string>(selected)
        if (out.has(WILDCARD)) return [WILDCARD]

        let changed = true
        while (changed) {
            changed = false
            for (const key of out) {
                const required = requiredView.get(key)
                if (required && !out.has(required)) {
                    out.add(required)
                    changed = true
                }
            }
        }
        return [...out] as Array<K | Wildcard>
    }

    const sanitizePermissions = (selected: Iterable<string>): Array<K | Wildcard> => {
        const known = [...selected].filter((key) => key === WILDCARD || meta.has(key))
        return normalizePermissionDependencies(known)
    }

    const resolveGrants = (selectors: readonly string[]): Array<K | Wildcard> => {
        const out = new Set<string>()
        for (const selector of selectors) {
            if (selector === WILDCARD) {
                out.add(WILDCARD)
                continue
            }
            const node = nodes.get(selector)
            if (node) {
                for (const key of leafKeysOf(node)) out.add(key)
                continue
            }
            if (meta.has(selector)) out.add(selector)
        }
        return normalizePermissionDependencies(out)
    }

    const getSensitiveKeys = (selected: Iterable<string>): K[] => {
        const out: K[] = []
        for (const key of selected) {
            if (key === WILDCARD) continue
            if (meta.get(key)?.sensitive) out.push(key as K)
        }
        return out
    }

    return {
        tree,
        keys: [...meta.keys()] as K[],
        meta: meta as unknown as ReadonlyMap<string, PermissionMeta<K>>,
        nodes,
        isKnownKey,
        getLeafKeys: (node) => leafKeysOf(node) as K[],
        requiredViewFor,
        isRequiredView: (key, selected) => [...selected].some((s) => requiredView.get(s) === key),
        normalizePermissionDependencies,
        sanitizePermissions,
        resolveGrants: resolveGrants as Catalog<K, N>["resolveGrants"],
        getSensitiveKeys,
        scopesFor: (key) => meta.get(key)?.scopes ?? [],
    }
}
