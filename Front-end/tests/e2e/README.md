# E2E de autenticacao

A suite usa Playwright contra a aplicacao real, sem mocks de API. O banco e criado
no volume do Compose e os e-mails de teste recebem um identificador unico por
execucao.

## Execucao reproduzivel

Na raiz do repositorio:

```bash
docker compose down -v --remove-orphans
docker compose up -d --build
cd Front-end
npm ci
npx playwright install chromium
npm run test:e2e
```

O relatorio HTML fica em `Front-end/playwright-report/`; traces, screenshots e
videos de falhas ficam em `Front-end/test-results/`. Ao terminar, remova os
servicos e o volume para eliminar os dados de teste:

```bash
cd ..
docker compose down -v --remove-orphans
```

Para registrar a evidencia, anote no PR a saida de `git rev-parse HEAD`, o sistema
operacional, as versoes de Node, npm, Docker e Playwright, e o resultado de
`npm run test:e2e`.

Os cenarios cobrem cadastro valido, e-mail duplicado, login valido, credenciais
invalidas, acesso a `/inicio`, cookie HttpOnly, ausencia de senha/token em
respostas e Web Storage, header CSRF e logout que expira o cookie. A revogacao
antecipada de uma copia do JWT nao e esperada pelo ADR-0002.
