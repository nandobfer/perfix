# Perfix — @nandobfer/perfix

Biblioteca de permissionamento whitelabel, derivada de `Sipal-Projetos/sipal-permissions` v0.4.0 (commit `4f11178`). Preserva a licença **UNLICENSED**; a disponibilidade pública não concede uma licença de código aberto. Recria o modelo do Smart Desk (catálogo em árvore,
cargos, união de cargos, coringa `*`, hierarquia, chaves sensíveis) de forma genérica e
acrescenta **escopos de dados generalizados**: vários escopos, definidos pela aplicação.

Sem dependências em runtime. React é peer opcional (só para `@nandobfer/perfix/react`).
Não conhece banco, framework nem provedor de identidade.

## Distribuição (sem registry)

- O `dist/` compilado é **versionado** no repositório; cada versão é uma tag `vX.Y.Z`.
- Consumo por dependência git:

  ```json
   { "dependencies": { "@nandobfer/perfix": "git+https://github.com/nandobfer/Perfix.git#v0.2.0" } }
  ```

- Sem `NPM_TOKEN`, `.npmrc`, GitHub Packages ou deploy key: o repositório público é consumido via HTTPS.
- Para testar uma mudança antes da tag, no projeto consumidor: `pnpm link ../caminho/perfix`
  (nunca versione o link).

### Como publicar uma versão

1. `pnpm lint && pnpm typecheck && pnpm test`
2. Atualize `version` no `package.json`.
3. `pnpm build` e **versione o `dist/`** no mesmo commit (o CI falha se o `dist/` estiver
   desatualizado).
4. `git tag vX.Y.Z && git push --follow-tags`
5. No consumidor, troque a tag da dependência.

## Pontos de entrada

| Import | Conteúdo |
|---|---|
| `@nandobfer/perfix` | catálogo, conjuntos de permissão, posições, hierarquia, guardas puras, escopos, "visualizar como" (`resolveViewAs`, interseções, transporte) |
| `@nandobfer/perfix/server` | `createGuards` (`requirePermission`, `requireAnyPermission`, `requireScope`) e `PermissionError` (401/403) |
| `@nandobfer/perfix/react` | `PermissionsProvider`, `usePermissions`, `Can`, `ViewAsProvider`, `useViewAs`, `getViewAsHeaderValue` |

## Uso

### 1. Catálogo

```ts
import { defineCatalog, type LeafKeysOf, type PermissionBranchDef } from "@nandobfer/perfix"

const TREE = [
    {
        id: "funil",
        label: "Funil",
        viewKey: "funnel.view",          // exigida por qualquer outra folha do grupo
        scopes: ["filial", "carteira"],  // escopos que valem para as folhas (herdado)
        children: [
            { key: "funnel.view", label: "Visualizar" },
            { key: "funnel.move", label: "Mover cards" },
        ],
    },
    {
        id: "admin",
        label: "Administração",
        sensitive: true,                 // só concede quem já possui
        children: [{ key: "roles.edit", label: "Editar cargos" }],
    },
] as const satisfies readonly PermissionBranchDef[]

export const catalog = defineCatalog(TREE)
export type PermissionKey = LeafKeysOf<typeof TREE>
```

O catálogo oferece `keys`, `meta`, `requiredViewFor`, `normalizePermissionDependencies`,
`sanitizePermissions`, `resolveGrants` (expande ids de grupo), `getSensitiveKeys` e `scopesFor`.

### 2. Escopos

```ts
import { defineScopes } from "@nandobfer/perfix"

export const scopes = defineScopes({
    filial: { label: "Filial" },                              // restrictive (padrão)
    carteira: { label: "Carteira" },
    regiao: { label: "Região", combine: "permissive" },
})
```

- Cada cargo guarda `escopos: string[]` — os escopos que ele **restringe**.
- `restrictive`: basta um cargo ativo restringir (restrição vence). `permissive`: só restringe
  se todos os cargos ativos restringirem.
- `resolveScope` / `computeScope` devolvem `{ allowed: false }` (sem a permissão de ver) ou
  `{ allowed: true, dimensions }`, com cada dimensão `{ kind: "global" }` ou
  `{ kind: "values", values }`. Lista vazia = nenhum dado (`isEmptyScope`), nunca global.
- Escopo não declarado pela folha é ignorado.
- A biblioteca **não monta consultas**: a aplicação traduz `dimensions` em filtros.
- `isWithinScope(result, { filial, carteira })` checa um registro já carregado.

### 3. Guardas de servidor

```ts
import { createGuards, isPermissionError } from "@nandobfer/perfix/server"

const guards = createGuards({
    catalog,
    getAuth: async () => /* { roles, effective } ou null */,
    scopes: {
        registry: scopes,
        resolvers: {
            filial: (ctx) => ctx.filiais,
            carteira: (ctx) => [ctx.userId, null],
            regiao: (ctx) => ctx.regioes,
        },
    },
})

await guards.requirePermission("funnel.move")            // lança PermissionError 401/403
const { scope } = await guards.requireScope("funnel.view", ctx)
```

### 4. UI

```tsx
<PermissionsProvider permissions={me.permissions} roles={me.roles}>
    <Can permission="funnel.move">…</Can>
</PermissionsProvider>
```

Guardas de UI são experiência; a autoridade é sempre a guarda do servidor.

### 4.1 Visualizar como (simular cargo ou usuário)

Headless: a biblioteca traz a regra, o transporte e o estado da aba; a aplicação desenha o seletor.

- **Quem simula**: só quem tem o coringa `*` (`canSimulate`). O servidor revalida a cada requisição.
- **Modos** (`ViewAs`): `{ tipo: "cargo", roleId, escolhas? }` — um cargo ativo, com o valor
  escolhido para escopos que o simulador informa (ex.: `{ filial: id }`) — ou
  `{ tipo: "usuario", userId }` — as atribuições exatas de outro usuário ativo.
- **Nunca vê mais que o real**: `simulatedPermissions` (permissões), `intersectScopeResults`
  (escopos: `global ∩ X = X`, valores em comum, vazio continua vazio) e `intersectAccess`
  (conjuntos como "espaços acessíveis": todos ∩ alguns = alguns).
- **Servidor**: `readViewAs({ header, tabMapCookie, tabCookie })` lê a simulação (cabeçalho
  `x-perfix-view-as` vence o cookie; `none` desliga; valor fora do formato → `invalid: true`, sem
  simulação) e `resolveViewAs({ real, viewAs, loadRole, loadTarget, choiceScopes, checkChoice })`
  devolve `none`, `forbidden` (sem coringa), `invalid` (`ALVO` | `CARGO` | `ESCOLHA`) ou `ok` com o
  sujeito (cargos/extra do alvo), as permissões já intersectadas, o `marker` para auditoria e as
  escolhas pendentes (escopo vazio até escolher).
- **Navegador**: `ViewAsProvider` guarda o estado por aba no `sessionStorage` (sobrevive ao F5,
  acaba ao fechar a aba) e o espelha em dois cookies de sessão: o mapa `{ abaId: ViewAs }`
  (`perfix-view-as`) e a aba em foco (`perfix-view-as-tab`, regravado ao ganhar foco), para
  Server Components. O cliente HTTP envia `getViewAsHeaderValue()` em **toda** requisição (o
  estado ou `none`). `onChange({ kind: "inicio" | "troca" | "fim" })` permite limpar cache,
  reassinar o tempo real e navegar. `PermissionsProvider` ganha `isSimulating` e `realIsAdmin`.

```ts
const result = await resolveViewAs({
    real: { userId, nome, effective },
    viewAs: readViewAs({ header, tabMapCookie, tabCookie }).viewAs,
    loadRole: (id) => roles.getActive(id),
    loadTarget: (id) => users.loadTarget(id),   // { id, nome, ativo, roles, extra }
    choiceScopes: ["filial"],
    checkChoice: (scope, value) => (value ? (valida(value) ? "ok" : "invalid") : "pending"),
})
```

### 5. Hierarquia e concessão

- `getUnassignableRoles(catalog, caller, alvos)`: hierarquia (ninguém atribui cargo acima do
  próprio; empate permitido) + piso das chaves sensíveis. Coringa não é barrado.
- `evaluateRoleAssignment(...)`: valida apenas o delta e protege cargos atuais fora do alcance
  (inclusive referências órfãs).
- `getUngrantableKeys(effective, keys)`: monotonicidade ao definir permissões de um cargo.
- `canManageRole` / `canReorderRole`: definir cargos é exclusivo do coringa; o cargo com
  coringa não é editável.
- `aplicarPosicoes(rows, ordem)`: posição = índice na lista (0 = topo); ausentes vão para o pé.

### 6. Atribuições (store da aplicação)

- **Definições de cargos** ficam sempre no banco da aplicação (`RoleStore.getRoles(ids)`).
- **Atribuições** (`{ roles, extra }`, com `extra` definido pela aplicação — ex.: vínculos com
  empresas) ficam num `AssignmentStore` fornecido pela aplicação. O store é obrigatório:

  ```ts
  import { createAccessControl } from "@nandobfer/perfix"

  const access = createAccessControl({
      roles: meuRoleStore,
      assignments: meuAssignmentStore, // ex.: coleção no banco
  })
  const { assignment, roles } = await access.load(userId)
  await access.assignments.set(userId, { roles: ["admin"], extra })
  ```

  `createMemoryAssignmentStore` serve a testes e protótipos. `list(predicate)` é opcional no
  contrato (listas por cargo/escopo); paginação e cache são responsabilidade do store.
  Formato inválido (`parseAssignment`) vira atribuição vazia — sem acesso.
- **Claims de sessão (opcional)**: se a aplicação injetar a atribuição no token sob uma chave,
  `readAssignmentFromClaims` a lê sem consultar o store; ausente → `null`, e o chamador decide
  reler do store:

  ```ts
  import { readAssignmentFromClaims } from "@nandobfer/perfix"
  const given = readAssignmentFromClaims(sessionClaims) // null → lê do store
  const { assignment, roles } = await access.load(userId, given ?? undefined)
  ```

  A chave padrão é `perfix`; o segundo argumento escolhe outra.
- **Revogação imediata (versão)**: a atribuição aceita `version` (inteiro >= 0; ausente = 0).
  A aplicação incrementa a versão a cada gravação e guarda a versão atual numa fonte lida a cada
  requisição (ex.: o perfil no banco). `createFreshAssignmentResolver` usa a claim enquanto ela
  tiver versão >= a exigida; senão relê do store (cache de 30 s chaveado pela versão):

  ```ts
  import { createFreshAssignmentResolver } from "@nandobfer/perfix"
  const fresh = createFreshAssignmentResolver({ store: access.assignments })
  const { assignment } = await fresh.resolve({ userId, claims: sessionClaims, minVersion: perfil.acessoVersao })
  // ao gravar: versão nova no banco ($inc) + access.assignments.set(id, { ...atribuicao, version })
  ```

  Assim, um acesso retirado deixa de valer na próxima requisição, sem esperar o token renovar.
  `assignmentVersion(a)` devolve a versão (0 quando ausente).

## Fora da biblioteca (fica na aplicação)

Folhas do domínio, escopos concretos e seus resolvedores, cargos iniciais, persistência dos
cargos e das atribuições, formato do `extra` e tradução de escopo em consulta.
