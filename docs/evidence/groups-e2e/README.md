# E2E do fluxo central de grupos

## Cenário

`Front-end/tests/e2e/groups-real.spec.ts` executa a jornada com API e PostgreSQL reais:

- cria dois usuários únicos por execução e autentica cada um em um `BrowserContext` separado;
- cria instituição, curso, disciplina, período e turma únicos pela API autenticada;
- prepara o contexto acadêmico pela interface e confirma o perfil após salvar;
- cria um grupo público com entrada mediante aprovação pela interface;
- descobre o grupo com o segundo usuário, solicita entrada e confirma a solicitação pendente após recarregar;
- verifica que a segunda solicitação retorna `409`;
- aprova a participação pelo organizador e confirma no segundo usuário o acesso após recarregar;
- salva capturas do organizador aprovado e da participação persistida.

## Execução

```sh
cd Front-end
npm install
npx playwright install --with-deps chromium
cd ..
docker compose up -d --build
cd Front-end
npx playwright test tests/e2e/groups-real.spec.ts --workers=1
```

O teste não intercepta `/api/v1/**`. O ambiente esperado é `web` em `localhost:3000`,
API em `localhost:8000` e PostgreSQL em `localhost:5432`, conforme `compose.yml`.

## Evidência desta execução

- Commit testado: `d7fb08855da8f9de860df12ed96cf440961e3fb7`
- Ambiente: Linux x86_64 em Codespaces, Docker Compose v5.5.0

Validações estáticas aprovadas:

- `npm run typecheck`
- `npm run lint`

A execução Playwright foi iniciada, mas ficou bloqueada pelo runtime Docker deste
ambiente: o container da API não conseguiu estabelecer conexão TCP com `db:5432`
durante a migração (`psycopg2.OperationalError: connection timed out`). O banco
passou o próprio healthcheck, mas novos containers na bridge também não conseguiram
conectá-lo. Isso deve ser registrado como bug de infraestrutura separado, sem converter
este cenário em teste com mocks.