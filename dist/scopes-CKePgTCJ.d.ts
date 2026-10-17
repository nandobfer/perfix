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

/**
 * Escopos de dados GENERALIZADOS (row-level security definido pela aplicação).
 *
 * Substitui o escopo fixo de filial do Smart Desk. A aplicação:
 *  1. declara as dimensões com `defineScopes` (ex.: `filial`, `carteira`);
 *  2. marca, nos grupos do catálogo, quais escopos valem para as folhas (`scopes`);
 *  3. guarda em cada cargo os escopos que ele restringe (`escopos: string[]`);
 *  4. fornece os VALORES de cada escopo para o usuário no contexto (resolvedores).
 *
 * Regras:
 *  - Sem a permissão de visualização ⇒ `{ allowed: false }` (não vê nada).
 *  - Combinação entre cargos ativos: `restrictive` (padrão) — basta um cargo restringir;
 *    `permissive` — só restringe se TODOS os cargos ativos restringirem.
 *  - Escopo restrito com lista vazia ⇒ nenhum dado, nunca global.
 *  - Escopo não declarado pela folha é ignorado.
 *
 * A biblioteca NÃO monta consultas: a aplicação traduz o resultado em filtros.
 * Módulo ISOMÓRFICO.
 */

type ScopeCombine = "restrictive" | "permissive";
interface ScopeDef {
    readonly label: string;
    readonly description?: string;
    readonly combine?: ScopeCombine;
}
type ScopeDefs<S extends string = string> = {
    readonly [K in S]: ScopeDef;
};
interface ScopeRegistry<S extends string = string> {
    readonly defs: ScopeDefs<S>;
    readonly names: readonly S[];
    isKnownScope(name: string): name is S;
    /** Remove nomes desconhecidos e duplicados, na ordem da declaração. */
    sanitize(names: Iterable<string>): S[];
}
declare function defineScopes<const D extends Record<string, ScopeDef>>(defs: D): ScopeRegistry<Extract<keyof D, string>>;
/** Valor de escopo; `null` representa "sem valor" (ex.: item sem responsável). */
type ScopeValue = string | null;
type ScopeDimension = 
/** Não restrito: vê tudo nessa dimensão. */
{
    readonly kind: "global";
}
/** Restrito aos valores listados (lista vazia = nada). */
 | {
    readonly kind: "values";
    readonly values: readonly ScopeValue[];
};
type ScopeResult<S extends string = string> = {
    readonly allowed: false;
} | {
    readonly allowed: true;
    readonly dimensions: Readonly<Partial<Record<S, ScopeDimension>>>;
};
/** Escopos que os cargos ativos restringem, aplicando a combinação de cada dimensão. */
declare function restrictedScopes<S extends string>(registry: ScopeRegistry<S>, roles: readonly RoleLike[]): S[];
interface ComputeScopeInput<S extends string> {
    catalog: Catalog;
    registry: ScopeRegistry<S>;
    roles: readonly RoleLike[];
    effective: EffectivePermissions;
    /** Folha de visualização do recurso consultado. */
    viewKey: string;
    /** Valores já resolvidos para cada escopo restrito aplicável. */
    values: Readonly<Partial<Record<S, readonly ScopeValue[]>>>;
}
/** Versão síncrona: recebe os valores já resolvidos. */
declare function computeScope<S extends string>(input: ComputeScopeInput<S>): ScopeResult<S>;
type ScopeResolver<Ctx> = (ctx: Ctx) => Promise<readonly ScopeValue[]> | readonly ScopeValue[];
type ScopeResolvers<S extends string, Ctx> = {
    readonly [K in S]: ScopeResolver<Ctx>;
};
interface ResolveScopeInput<S extends string, Ctx> extends Omit<ComputeScopeInput<S>, "values"> {
    resolvers: ScopeResolvers<S, Ctx>;
    ctx: Ctx;
}
/** Versão assíncrona: chama os resolvedores apenas dos escopos restritos e aplicáveis. */
declare function resolveScope<S extends string, Ctx>(input: ResolveScopeInput<S, Ctx>): Promise<ScopeResult<S>>;
/** `true` quando o escopo não permite ver nada — atalho para curto-circuitar a consulta. */
declare function isEmptyScope(result: ScopeResult): boolean;
/** `true` quando um valor passa numa dimensão (útil para checar um registro já carregado). */
declare function matchesDimension(dim: ScopeDimension | undefined, value: ScopeValue): boolean;
/** `true` quando um registro (valores por escopo) está dentro do escopo resolvido. */
declare function isWithinScope<S extends string>(result: ScopeResult<S>, record: Readonly<Partial<Record<S, ScopeValue>>>): boolean;

export { hasPermission as A, intersectPermissions as B, type Catalog as C, isEmptyScope as D, type EffectivePermissions as E, isPermissionLeaf as F, isWildcard as G, isWithinScope as H, matchesDimension as I, resolveScope as J, resolveUserRoles as K, type LeafKeysOf as L, restrictedScopes as M, type NodeIdsOf as N, toRoleLike as O, POSICAO_AUSENTE as P, toggleNode as Q, type RoleRowLike as R, type ScopeCombine as S, WILDCARD as W, type RoleLike as a, type ComputeScopeInput as b, type PermissionBranchDef as c, type PermissionLeafDef as d, type PermissionMeta as e, type PermissionNodeDef as f, type PermissionNodeState as g, type ResolveScopeInput as h, type ScopeDef as i, type ScopeDefs as j, type ScopeDimension as k, type ScopeRegistry as l, type ScopeResolver as m, type ScopeResolvers as n, type ScopeResult as o, type ScopeValue as p, type Wildcard as q, computeScope as r, countNodeLeaves as s, defineCatalog as t, defineScopes as u, expandPermissions as v, filterPermissionNodes as w, getNodeState as x, hasAllPermissions as y, hasAnyPermission as z };
