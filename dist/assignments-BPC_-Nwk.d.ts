import { a as RoleLike } from './permission-set-B6UbcFOx.js';

/**
 * ATRIBUIÇÕES do usuário: quais cargos ele tem (e dados extras definidos pela aplicação, como
 * vínculos com empresas/filiais). As DEFINIÇÕES dos cargos ficam sempre no banco da aplicação
 * (`RoleStore`); só as atribuições podem ficar fora dele.
 *
 * Padrão: atribuições nos metadados do Clerk (`@nandobfer/perfix/clerk`). Opt-out: a aplicação
 * passa um `AssignmentStore` próprio (ex.: coleção no Mongo, como no Smart Desk).
 */

interface Assignment<Extra = unknown> {
    /** Ids dos cargos atribuídos. */
    readonly roles: readonly string[];
    /** Dados extras da aplicação (ex.: `{ empresas: [...] }`). */
    readonly extra?: Extra;
    /**
     * Versão da atribuição (inteiro >= 0), incrementada pela aplicação a cada gravação. Permite
     * detectar uma cópia desatualizada (ex.: claim do token de sessão) — ver
     * `createFreshAssignmentResolver` em `@nandobfer/perfix/clerk`. Ausente = 0.
     */
    readonly version?: number;
}
declare const EMPTY_ASSIGNMENT: Assignment<never>;
interface AssignmentStore<Extra = unknown> {
    /** Atribuição do usuário (id do provedor de identidade). Desconhecido → vazio. */
    get(userId: string): Promise<Assignment<Extra>>;
    /** Substitui a atribuição do usuário. */
    set(userId: string, assignment: Assignment<Extra>): Promise<void>;
    /** Usuários cuja atribuição satisfaz o predicado (listas por cargo/filial). Opcional. */
    list?(predicate?: (assignment: Assignment<Extra>) => boolean): Promise<Array<{
        userId: string;
        assignment: Assignment<Extra>;
    }>>;
}
/** Onde a aplicação guarda as DEFINIÇÕES de cargos. */
interface RoleStore {
    /** Cargos pelos ids (com `posicao` já resolvida). Ids desconhecidos são omitidos. */
    getRoles(ids: readonly string[]): Promise<RoleLike[]>;
}
type ExtraParser<Extra> = (value: unknown) => Extra | undefined;
/**
 * Normaliza um valor desconhecido (metadado, claim, JSON) em atribuição. Formato inválido vira
 * atribuição VAZIA — errar para o lado que tira acesso.
 */
declare function parseAssignment<Extra = unknown>(value: unknown, parseExtra?: ExtraParser<Extra>): Assignment<Extra>;
/** Versão da atribuição; ausente ou inválida = 0. */
declare function assignmentVersion(assignment: {
    readonly version?: number;
} | null | undefined): number;
/** Serializa para JSON puro (sem `undefined`), pronto para metadados. */
declare function serializeAssignment<Extra>(assignment: Assignment<Extra>): {
    roles: string[];
    extra?: Extra;
    version?: number;
};
/** Store em memória (testes e protótipos). */
declare function createMemoryAssignmentStore<Extra = unknown>(initial?: Record<string, Assignment<Extra>>): AssignmentStore<Extra>;
interface AccessControlOptions<Extra> {
    roles: RoleStore;
    /** Store das atribuições. Ausente → obrigatório informar `clerk` (padrão da biblioteca). */
    assignments?: AssignmentStore<Extra>;
}
interface AccessControl<Extra> {
    readonly assignments: AssignmentStore<Extra>;
    /** Atribuição + cargos carregados do usuário. `given` evita reler o store (ex.: claim da sessão). */
    load(userId: string, given?: Assignment<Extra>): Promise<{
        assignment: Assignment<Extra>;
        roles: RoleLike[];
    }>;
}
/**
 * Liga o store de cargos ao store de atribuições. Use `createClerkAccessControl`
 * (`@nandobfer/perfix/clerk`) para o padrão; passe `assignments` para o opt-out.
 */
declare function createAccessControl<Extra = unknown>(options: Required<AccessControlOptions<Extra>>): AccessControl<Extra>;

export { type Assignment as A, type ExtraParser as E, type RoleStore as R, type AssignmentStore as a, type AccessControl as b, type AccessControlOptions as c, EMPTY_ASSIGNMENT as d, assignmentVersion as e, createAccessControl as f, createMemoryAssignmentStore as g, parseAssignment as p, serializeAssignment as s };
