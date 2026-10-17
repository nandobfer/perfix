# Perfix — guia de desenvolvimento

Leia `README.md`, a entrada afetada em `src/` e seus testes em `__tests__/`.

- Biblioteca whitelabel independente; origem: `Sipal-Projetos/sipal-permissions`, tag v0.4.0. Preserve a procedência e a licença UNLICENSED; repositório público não significa licença de código aberto.
- Núcleo puro, isomórfico, TypeScript strict e sem dependências de runtime. Sem `any`, `@ts-ignore`, framework, banco ou vocabulário de domínio.
- React é peer opcional, apenas na entrada `/react`. Adapters usam interfaces mínimas, não SDKs.
- Negue acesso na dúvida: cargo inativo/desconhecido não concede; escopo restrito vazio nunca vira global; simulação nunca amplia acesso real.
- Catálogo, persistência, identidade, telas e regras do aplicativo pertencem ao consumidor. Regras genéricas pertencem ao Perfix.
- Implementar → documentar no README → testar com Vitest em `__tests__/`. Segurança exige casos negativos.
- Distribuição Git por tags imutáveis em `nandobfer/Perfix`; `dist/` versionado. Sem registry, prepare/postinstall ou links locais versionados.
- Cada commit incrementa a versão SemVer. Alterar `src/` exige atualizar `dist/` com build explicitamente autorizado. Entradas públicas precisam de exports types/import/default e documentação.
- Builds, suíte completa, commits e publicação dependem da autorização do usuário. Nunca alterar os repositórios de origem.
