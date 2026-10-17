import { E as EffectivePermissions, a as RoleLike } from './permission-set-B6UbcFOx.js';
import { c as ScopeDimension, g as ScopeResult } from './scopes-Y8Ng1aid.js';

/**
 * "Visualizar como": simular um CARGO ou um USUÁRIO.
 *
 * Regras:
 *  - Só quem tem o coringa `*` simula (`canSimulate`).
 *  - O contexto efetivo NUNCA vê mais que o real: permissões, escopos e acessos são a
 *    INTERSEÇÃO entre o real de quem simula e o do alvo.
 *  - Escopo restrito com lista vazia continua vazio (nunca global).
 *
 * Também traz o formato de transporte (cabeçalho/cookie) e a validação estrita dele.
 * Módulo ISOMÓRFICO e sem dependências.
 */

/**
 * O que está sendo simulado.
 * - `cargo`: um cargo ativo; `escolhas` traz o valor escolhido para escopos que o cargo restringe
 *   e que a aplicação pede ao simulador (ex.: `{ filial: "<id>" }`).
 * - `usuario`: as atribuições exatas de outro usuário (id do provedor de identidade ou da aplicação).
 */
type ViewAs = {
    readonly tipo: "cargo";
    readonly roleId: string;
    readonly escolhas?: Readonly<Record<string, string>>;
} | {
    readonly tipo: "usuario";
    readonly userId: string;
};
/** Marcador gravado em auditoria e logs durante a simulação. */
interface ViewAsMarker {
    readonly tipo: ViewAs["tipo"];
    readonly alvoId: string;
    readonly alvoNome: string;
    /** Escolhas aplicadas (ex.: `{ filial: "<id>" }`). */
    readonly escolhas?: Readonly<Record<string, string>>;
}
/** Só o coringa simula. */
declare function canSimulate(effective: EffectivePermissions): boolean;
/** Permissões efetivas da simulação = real ∩ união dos cargos ativos do alvo. */
declare function simulatedPermissions(real: EffectivePermissions, roles: readonly RoleLike[]): EffectivePermissions;
/** `global ∩ X = X`; `values ∩ values` = valores em comum (vazio continua vazio). */
declare function intersectScopeDimension(a: ScopeDimension | undefined, b: ScopeDimension | undefined): ScopeDimension | undefined;
/** Interseção de dois escopos resolvidos: só é permitido se os dois permitirem. */
declare function intersectScopeResults<S extends string>(a: ScopeResult<S>, b: ScopeResult<S>): ScopeResult<S>;
/** Acesso a um conjunto de itens (ex.: quais "espaços" o usuário acessa): todos ou alguns. */
type AccessSet = {
    readonly kind: "all";
} | {
    readonly kind: "values";
    readonly values: readonly string[];
};
declare function intersectAccess(a: AccessSet, b: AccessSet): AccessSet;
declare function accessIncludes(access: AccessSet, value: string): boolean;
/** Cabeçalho que o cliente envia em toda requisição (`none` = sem simulação nesta aba). */
declare const VIEW_AS_HEADER = "x-perfix-view-as";
declare const VIEW_AS_NONE = "none";
/** Cookie com o mapa `{ abaId: ViewAs }` (espelho para Server Components). */
declare const VIEW_AS_COOKIE = "perfix-view-as";
/** Cookie com o id da aba em foco. */
declare const VIEW_AS_TAB_COOKIE = "perfix-view-as-tab";
/** Máximo de abas guardadas no cookie (as mais antigas saem). */
declare const VIEW_AS_MAX_TABS = 10;
/** Valida um valor desconhecido; qualquer desvio do formato → `null` (sem simulação). */
declare function parseViewAs(value: unknown): ViewAs | null;
declare function encodeViewAs(viewAs: ViewAs): string;
declare function decodeViewAs(raw: string): ViewAs | null;
type ViewAsTabMap = Readonly<Record<string, ViewAs>>;
declare function encodeViewAsTabMap(map: ViewAsTabMap): string;
/** Mapa de abas do cookie; entradas inválidas são descartadas. */
declare function decodeViewAsTabMap(raw: string | null | undefined): Record<string, ViewAs>;
/** Atualiza a entrada da aba (ou remove com `null`), mantendo no máximo `VIEW_AS_MAX_TABS`. */
declare function updateViewAsTabMap(map: ViewAsTabMap, tabId: string, viewAs: ViewAs | null): Record<string, ViewAs>;
type ViewAsSource = "header" | "cookie" | "none";
interface ReadViewAsInput {
    /** Valor do cabeçalho `x-perfix-view-as` (ausente = `null`). */
    header?: string | null;
    /** Cookie com o mapa de abas. */
    tabMapCookie?: string | null;
    /** Cookie com o id da aba em foco. */
    tabCookie?: string | null;
}
interface ReadViewAsResult {
    source: ViewAsSource;
    viewAs: ViewAs | null;
    /** Havia um valor, mas fora do formato (deve ser registrado em log). */
    invalid: boolean;
}
/**
 * Lê a simulação da requisição. O cabeçalho vence o cookie; cabeçalho `none` desliga a simulação
 * mesmo com cookie (outra aba simulando). Sem cabeçalho, vale a entrada da aba em foco no cookie.
 */
declare function readViewAs(input: ReadViewAsInput): ReadViewAsResult;
interface ViewAsTarget<Extra> {
    id: string;
    nome: string;
    /** Usuário ativo (desativado, excluído ou convite pendente → `false`). */
    ativo: boolean;
    /** Cargos atribuídos ao alvo (inativos são ignorados). */
    roles: readonly RoleLike[];
    extra?: Extra;
}
/** `ok`: escolha válida; `pending`: falta escolher (escopo vazio até escolher); `invalid`: rejeita. */
type ViewAsChoiceCheck = "ok" | "pending" | "invalid";
interface ResolveViewAsInput<Extra> {
    real: {
        userId: string;
        nome: string;
        effective: EffectivePermissions;
    };
    viewAs: ViewAs | null;
    /** Cargo ATIVO pelo id, ou `null`. */
    loadRole(roleId: string): Promise<RoleLike | null>;
    /** Alvo pelo id, ou `null` (excluído/desconhecido). */
    loadTarget(userId: string): Promise<ViewAsTarget<Extra> | null>;
    /** Escopos cujo valor o simulador escolhe ao simular cargo (ex.: `["filial"]`). */
    choiceScopes?: readonly string[];
    /** Valida a escolha de um escopo (ex.: filial ativa e da empresa atual). */
    checkChoice?(scope: string, value: string | undefined): Promise<ViewAsChoiceCheck> | ViewAsChoiceCheck;
}
type ViewAsRejection = "ALVO" | "CARGO" | "ESCOLHA";
interface ViewAsSubject<Extra> {
    tipo: ViewAs["tipo"];
    /** Id de quem é o "dono" dos itens (alvo ou o próprio simulador ao simular cargo). */
    id: string;
    nome: string;
    roles: RoleLike[];
    /** Atribuição extra do alvo (só ao simular usuário). */
    extra?: Extra;
}
type ViewAsResolution<Extra> = {
    status: "none";
} | {
    status: "forbidden";
} | {
    status: "invalid";
    motivo: ViewAsRejection;
} | {
    status: "ok";
    viewAs: ViewAs;
    subject: ViewAsSubject<Extra>;
    effective: EffectivePermissions;
    marker: ViewAsMarker;
    /** Escopos restritos que ainda aguardam a escolha (escopo vazio até lá). */
    pendingChoices: string[];
};
/**
 * Revalida tudo a cada requisição: simulador com `*`, alvo ativo, cargo ativo e escolhas.
 * Nunca amplia: as permissões devolvidas já são a interseção com as reais.
 */
declare function resolveViewAs<Extra = unknown>(input: ResolveViewAsInput<Extra>): Promise<ViewAsResolution<Extra>>;

export { type AccessSet as A, resolveViewAs as B, simulatedPermissions as C, updateViewAsTabMap as D, type ReadViewAsInput as R, VIEW_AS_COOKIE as V, type ReadViewAsResult as a, type ResolveViewAsInput as b, VIEW_AS_HEADER as c, VIEW_AS_MAX_TABS as d, VIEW_AS_NONE as e, VIEW_AS_TAB_COOKIE as f, type ViewAs as g, type ViewAsChoiceCheck as h, type ViewAsMarker as i, type ViewAsRejection as j, type ViewAsResolution as k, type ViewAsSource as l, type ViewAsSubject as m, type ViewAsTabMap as n, type ViewAsTarget as o, accessIncludes as p, canSimulate as q, decodeViewAs as r, decodeViewAsTabMap as s, encodeViewAs as t, encodeViewAsTabMap as u, intersectAccess as v, intersectScopeDimension as w, intersectScopeResults as x, parseViewAs as y, readViewAs as z };
