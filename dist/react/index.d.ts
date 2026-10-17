import * as react from 'react';
import { ReactNode } from 'react';
import { a as RoleLike } from '../permission-set-B6UbcFOx.js';
import { g as ViewAs } from '../view-as-BdEfJN9a.js';
import '../scopes-Y8Ng1aid.js';

/** Estado guardado na aba: o que é simulado + rótulo para a interface (o servidor ignora o rótulo). */
interface ViewAsState {
    viewAs: ViewAs;
    /** Ex.: `{ alvo: "Vendedor", escolha: "Filial Centro" }`. */
    label: {
        alvo: string;
        escolha?: string;
    };
}
declare const VIEW_AS_STORAGE_KEY = "perfix:view-as";
declare const VIEW_AS_TAB_STORAGE_KEY = "perfix:view-as-tab";
/** Estado da aba atual (fora de componentes, ex.: interceptor HTTP). */
declare function readViewAsState(): ViewAsState | null;
/** Valor do cabeçalho `x-perfix-view-as` desta aba: estado codificado ou `none`. */
declare function getViewAsHeaderValue(): string;
/** Id desta aba (criado na primeira leitura). */
declare function getViewAsTabId(): string;
/** Espelha o estado desta aba nos cookies (entrada da aba + aba em foco). */
declare function syncViewAsCookies(state?: ViewAsState | null): void;
interface ViewAsValue {
    state: ViewAsState | null;
    viewAs: ViewAs | null;
    isSimulating: boolean;
    /** Inicia ou troca a simulação. */
    start(state: ViewAsState): void;
    /** Encerra a simulação desta aba (limpa estado e cookie). */
    stop(): void;
}
type ViewAsChangeKind = "inicio" | "troca" | "fim";
interface ViewAsProviderProps {
    children: ReactNode;
    /** Chamado DEPOIS de gravar o novo estado (limpar cache, reconectar tempo real, navegar...). */
    onChange?(change: {
        kind: ViewAsChangeKind;
        previous: ViewAsState | null;
        next: ViewAsState | null;
    }): void;
}
declare function ViewAsProvider({ children, onChange }: ViewAsProviderProps): react.JSX.Element;
/** Não lança fora do provider: devolve o estado neutro (sem simulação). */
declare function useViewAs(): ViewAsValue;

interface PermissionsValue {
    /** Permissões efetivas (chaves e/ou `*`). */
    readonly permissions: ReadonlySet<string>;
    readonly roles: readonly RoleLike[];
    /** Escopos restritos pelos cargos ativos do usuário. */
    readonly restrictedScopes: readonly string[];
    readonly loading: boolean;
    can(key: string): boolean;
    canAny(keys: readonly string[]): boolean;
    canAll(keys: readonly string[]): boolean;
    readonly isAdmin: boolean;
    /** A aba está simulando outro cargo/usuário (`ViewAsProvider`). */
    readonly isSimulating: boolean;
    /** Quem está logado tem o coringa de verdade (pode simular), mesmo durante a simulação. */
    readonly realIsAdmin: boolean;
}
interface PermissionsProviderProps {
    permissions: Iterable<string> | null | undefined;
    roles?: readonly RoleLike[];
    restrictedScopes?: readonly string[];
    loading?: boolean;
    /**
     * Coringa REAL de quem está logado. Informe quando `permissions` já for o conjunto simulado
     * vindo do servidor. Ausente = `permissions` contém `*`.
     */
    realIsAdmin?: boolean;
    children: ReactNode;
}
declare function PermissionsProvider({ permissions, roles, restrictedScopes, loading, realIsAdmin, children, }: PermissionsProviderProps): react.JSX.Element;
declare function usePermissions(): PermissionsValue;
interface CanProps {
    permission?: string;
    any?: readonly string[];
    all?: readonly string[];
    fallback?: ReactNode;
    children: ReactNode;
}
/** Renderiza `children` só quando o usuário possui a(s) permissão(ões). */
declare function Can({ permission, any, all, fallback, children }: CanProps): react.JSX.Element;

export { Can, type CanProps, PermissionsProvider, type PermissionsProviderProps, type PermissionsValue, VIEW_AS_STORAGE_KEY, VIEW_AS_TAB_STORAGE_KEY, type ViewAsChangeKind, ViewAsProvider, type ViewAsProviderProps, type ViewAsState, type ViewAsValue, getViewAsHeaderValue, getViewAsTabId, readViewAsState, syncViewAsCookies, usePermissions, useViewAs };
