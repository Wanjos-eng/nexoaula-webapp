# Produção Cloudflare

- Frontend: `nexoaula-web`, pasta `Front-end`, branch `main`.
- Backend: `nexoaula-api`, pasta `Back-end/apps/api`, branch `main`.
- Supabase: `nexoaula-production` (`pyuyhfxntauvihouzdrb`).
- Hyperdrive: `nexoaula-production`, binding `HYPERDRIVE`; cache desabilitado
  para preservar leitura após escrita em autenticação e chat.

O navegador usa `/api/*` na origem do frontend. `Front-end/worker.ts` encaminha
essas requisições pelo service binding `API`, preservando corpo, cookies,
Origin e headers CSRF. As demais páginas usam o handler vinext. O rewrite do
Next continua disponível para Docker e desenvolvimento local.

O backend recebe `ENVIRONMENT`, `AUTH_COOKIE_SECURE`, `AUTH_ALLOWED_ORIGINS`
e o secret `AUTH_JWT_SECRET` antes de importar a aplicação. A conexão vem do
Hyperdrive; nenhuma senha de banco deve ser salva neste repositório.

O login PostgreSQL exclusivo `nexoaula_api` não é superusuário e não tem
`BYPASSRLS`, `CREATEDB` ou `CREATEROLE`. Tem CRUD nas tabelas da aplicação,
uso das sequências e policies `nexoaula_backend_access` restritas a esse role.
A autorização de usuários e grupos é executada pela API. Esses privilégios
não se estendem aos roles públicos `anon` e `authenticated`. RLS permanece
habilitado. Novas tabelas precisam de grants e policies equivalentes para o
backend. A tabela de controle `alembic_version` não é acessível por esse role.

`find_additional_modules` deve permanecer habilitado para incluir `app/`.
A validação no GitHub verifica que os módulos principais existem no bundle.
Um build verde não substitui os testes públicos de `/health`, `/api/health`,
cadastro, login, `/api/v1/auth/me`, grupos, canais, mensagens e logout.
