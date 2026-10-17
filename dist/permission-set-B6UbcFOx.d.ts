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
declare const WILDCARD: "*";
type Wildcard = typeof WILDCARD;
/** Folha = permissão atômica. `key` é o identificador canônico, por domínio. */
interface PermissionLeafDef {
    readonly key: string;
    readonly label: string;
    readonly description?: string;
    /** Só concedível por quem já a possui (piso sobre a hierarquia). */
    readonly sensitive?: boolean;
}
/** Nó intermediário: módulo (raiz) ou subgrupo. Profundidade arbitrária. */
interface PermissionBranchDef {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    /** Torna sensíveis todas as folhas abaixo. */
    readonly sensitive?: boolean;
    /** Folha que precisa acompanhar qualquer outra ação deste grupo. */
    readonly viewKey?: string;
    /**
     * Escopos de dados (definidos pela aplicação com `defineScopes`) que valem para as
     * folhas deste grupo. Herdado pelos subgrupos; um subgrupo pode redeclarar.
     */
    readonly scopes?: readonly string[];
    readonly children: readonly PermissionNodeDef[];
}
type PermissionNodeDef = PermissionLeafDef | PermissionBranchDef;
declare function isPermissionLeaf(node: PermissionNodeDef): node is PermissionLeafDef;
type ExtractLeafKeys<T> = T extends readonly unknown[] ? ExtractLeafKeys<T[number]> : T extends {
    readonly children: infer C;
} ? ExtractLeafKeys<C> : T extends {
    readonly key: infer K;
} ? K extends string ? K : never : never;
type ExtractNodeIds<T> = T extends readonly unknown[] ? ExtractNodeIds<T[number]> : T extends {
    readonly id: infer I;
    readonly children: infer C;
} ? (I extends string ? I : never) | ExtractNodeIds<C> : never;
/** União das chaves de folha de uma árvore declarada `as const`. */
type LeafKeysOf<T> = ExtractLeafKeys<T>;
/** União dos ids de módulo/subgrupo de uma árvore declarada `as const`. */
type NodeIdsOf<T> = ExtractNodeIds<T>;
interface PermissionMeta<K extends string = string> {
    readonly key: K;
    readonly label: string;
    readonly description?: string;
    readonly sensitive: boolean;
    /** Caminho de rótulos até a folha ("Administração › Cargos › Edição"). */
    readonly path: readonly string[];
    /** Escopos de dados aplicáveis à folha (herdados do grupo). */
    readonly scopes: readonly string[];
}
interface Catalog<K extends string = string, N extends string = string> {
    readonly tree: readonly PermissionBranchDef[];
    /** Todas as chaves, na ordem da árvore. */
    readonly keys: readonly K[];
    readonly meta: ReadonlyMap<string, PermissionMeta<K>>;
    readonly nodes: ReadonlyMap<string, PermissionBranchDef>;
    isKnownKey(key: string): key is K;
    getLeafKeys(node: PermissionNodeDef): K[];
    requiredViewFor(key: string): K | undefined;
    isRequiredView(key: string, selected: ReadonlySet<string>): boolean;
    /** Garante que toda ação carregue a visualização do próprio grupo. `*` absorve tudo. */
    normalizePermissionDependencies(selected: Iterable<string>): Array<K | Wildcard>;
    /** Remove chaves desconhecidas (mantém `*`) e normaliza dependências. */
    sanitizePermissions(selected: Iterable<string>): Array<K | Wildcard>;
    /** Expande seletores (ids de nó, chaves ou `*`) nas chaves de folha. */
    resolveGrants(selectors: readonly (K | N | Wildcard | string)[]): Array<K | Wildcard>;
    /** Chaves sensíveis presentes num conjunto (ignora `*`). */
    getSensitiveKeys(selected: Iterable<string>): K[];
    /** Escopos de dados aplicáveis a uma folha. */
    scopesFor(key: string): readonly string[];
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
declare function defineCatalog<const T extends readonly PermissionBranchDef[]>(tree: T): Catalog<LeafKeysOf<T>, NodeIdsOf<T>>;

/**
 * Conjuntos de permissão (modelo de cargos do Discord, como no Smart Desk).
 *
 * Um usuário tem um ou mais CARGOS; o acesso efetivo é a UNIÃO das permissões dos cargos
 * ATIVOS. Não existe permissão avulsa no usuário.
 *
 * Módulo ISOMÓRFICO: as funções recebem os cargos já carregados (documentos), nunca ids.
 */

/**
 * Posição de um cargo fora da lista da hierarquia. Vai para o PÉ, nunca para o topo —
 * errar para o lado que tira poder.
 */
declare const POSICAO_AUSENTE: number;
/** O mínimo que esta biblioteca precisa saber de um cargo. */
interface RoleLike {
    readonly id: string;
    readonly slug: string;
    readonly nome: string;
    readonly cor?: string;
    /** Índice na lista da hierarquia — 0 é o topo, menor vence. */
    readonly posicao: number;
    /** Somente `false` revoga o cargo (ausente = ativo). */
    readonly ativo?: boolean;
    /** Escopos de dados que o cargo restringe (definidos pela aplicação). */
    readonly escopos?: readonly string[];
    readonly permissoes: readonly string[];
}
/** Documento cru de cargo (Mongo `.lean()` ou JSON da API). */
interface RoleRowLike {
    _id?: unknown;
    id?: unknown;
    slug?: string;
    nome?: string;
    cor?: string;
    posicao?: number;
    ativo?: boolean;
    escopos?: readonly string[];
    permissoes?: readonly string[];
}
declare function toRoleLike(row: RoleRowLike): RoleLike;
type EffectivePermissions = ReadonlySet<string>;
/** Conjunto efetivo = união das permissões dos cargos ativos. `*` fica literal. */
declare function expandPermissions(cargos?: readonly RoleLike[]): EffectivePermissions;
/** Interseção de dois conjuntos efetivos (usada para "ver como"). `*` = todas. */
declare function intersectPermissions(a: EffectivePermissions, b: EffectivePermissions): EffectivePermissions;
declare function hasPermission(effective: EffectivePermissions, key: string): boolean;
declare function hasAnyPermission(effective: EffectivePermissions, keys: readonly string[]): boolean;
declare function hasAllPermissions(effective: EffectivePermissions, keys: readonly string[]): boolean;
declare function isWildcard(effective: EffectivePermissions): boolean;
/** Cargos ordenados pela hierarquia — o mais alto primeiro. */
declare function resolveUserRoles<R extends RoleLike>(cargos?: readonly R[]): R[];
type PermissionNodeState = "checked" | "indeterminate" | "unchecked";
declare function getNodeState(catalog: Catalog, node: PermissionNodeDef, selected: ReadonlySet<string>): PermissionNodeState;
/** Marca ou desmarca um nó e toda a sua descendência, normalizando dependências. */
declare function toggleNode(catalog: Catalog, node: PermissionNodeDef, selected: ReadonlySet<string>, next: boolean): Set<string>;
declare function countNodeLeaves(catalog: Catalog, node: PermissionNodeDef, selected: ReadonlySet<string>): {
    marked: number;
    total: number;
};
/** Filtra a árvore por texto, preservando os ancestrais dos nós que casam. */
declare function filterPermissionNodes(nodes: readonly PermissionNodeDef[], query: string): PermissionNodeDef[];

export { type Catalog as C, type EffectivePermissions as E, type LeafKeysOf as L, type NodeIdsOf as N, POSICAO_AUSENTE as P, type RoleRowLike as R, WILDCARD as W, type RoleLike as a, type PermissionBranchDef as b, type PermissionLeafDef as c, type PermissionMeta as d, type PermissionNodeDef as e, type PermissionNodeState as f, type Wildcard as g, countNodeLeaves as h, defineCatalog as i, expandPermissions as j, filterPermissionNodes as k, getNodeState as l, hasAllPermissions as m, hasAnyPermission as n, hasPermission as o, intersectPermissions as p, isPermissionLeaf as q, isWildcard as r, resolveUserRoles as s, toRoleLike as t, toggleNode as u };
