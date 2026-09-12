# nexoAula API — setup inicial

FastAPI executável com router técnico, configuração centralizada, migration,
persistência de usuário/perfil, cadastro e login HTTP protegido por bcrypt,
sessão JWT em cookie HttpOnly, consulta de usuário atual e logout. PostgreSQL, SQLAlchemy 2 e Alembic estão
integrados no recorte inicial.

A decisão está documentada no
[ADR-0003](../../../docs/decisions/ADR-0003-persistence.md). A primeira migration
cria somente `users`, `user_profiles` e `auth_tokens`; os demais módulos do DBML
continuam fora deste recorte.

O mecanismo JWT em cookie `HttpOnly` do primeiro fluxo foi definido no
[ADR-0002](../../../docs/decisions/ADR-0002-authentication.md). O cadastro não
emite JWT nem cookie; somente o login cria o estado autenticado.

## Ambiente

Use Python **3.11.x**. `requirements.txt` é a fonte única das dependências da API.
As dependências herdadas do PR #2 foram preservadas sem introduzir seu uso no app.
As três dependências adicionadas para configuração/testes também têm versão fixa.
As dependências transitivas novas ainda são resolvidas pelo pip; isto não é um
lock multiplataforma completo.

Pela raiz do monorepo, `./setup.ps1 -Target Backend` (Windows) ou
`bash ./setup.sh --target backend` (Linux) cria `.venv` nesta pasta e instala
as dependências. Os scripts não alteram Python/Node globais, não usam sudo e não
criam nem sobrescrevem `.env`. Veja opções no [README principal](../../../README.md).

## Execução manual

Windows (PowerShell), a partir da raiz:

```powershell
cd Back-end/apps/api
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Linux, a partir da raiz:

```bash
cd Back-end/apps/api
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip check
python -m uvicorn app.main:app --reload
```

Com o ambiente ativado, o comando de execução é `python -m uvicorn app.main:app --reload`.
No Windows também é possível ativá-lo com `.\.venv\Scripts\Activate.ps1`;
usar o executável diretamente evita depender da política de ativação do shell.

- Health: <http://127.0.0.1:8000/health> — HTTP 200,
  `{"status":"ok","message":"API is running"}`.
- Cadastro: `POST http://127.0.0.1:8000/api/v1/auth/register` — HTTP 201.
- Swagger: <http://127.0.0.1:8000/docs>.
- OpenAPI: <http://127.0.0.1:8000/openapi.json>.
- ReDoc: <http://127.0.0.1:8000/redoc>.

O health é uma verificação do processo da API, **não** da prontidão de um banco.

## Configuração

O arquivo `.env` é opcional para iniciar o health técnico, mas obrigatório para
comandos que acessam o banco.
Se necessário, copie `.env.example` para `.env` manualmente sem sobrescrever um
arquivo existente. Nunca versione `.env` nem segredos.

| Opção | Padrão | Uso |
| --- | --- | --- |
| `PROJECT_NAME` | `nexoAula API` | Título da documentação |
| `VERSION` | `0.1.0` | Versão da API no OpenAPI |
| `DATABASE_URL` | nenhum | Conexão PostgreSQL exigida por migrations e persistência |
| `ENVIRONMENT` | `production` | `development` explícito permite HTTP local |
| `AUTH_JWT_SECRET` | nenhum | Segredo aleatório de pelo menos 32 bytes para login e validação JWT |
| `AUTH_COOKIE_SECURE` | `true` | `false` permitido somente em `development` |
| `AUTH_ALLOWED_ORIGINS` | `[]` | Lista JSON de origens exatas autorizadas nas mutações |

Variáveis de ambiente têm precedência sobre `.env`. O caminho do arquivo é
relativo à API, independentemente do diretório de execução. Valores vazios de
nome/versão são rejeitados pelo Pydantic. `DATABASE_URL` deve usar PostgreSQL e
nunca é registrada em logs; SQLite é recusado explicitamente.

## Verificação

Dentro desta pasta e com o ambiente ativado:

```bash
python -m pip check
python -m pytest -q
python -m alembic history
```

No Windows, substitua `python` por `.\.venv\Scripts\python.exe` se não ativou o ambiente.
Pytest cobre health, OpenAPI, configuração, histórico e contrato dos scripts.
O workflow `Backend checks` executa a suíte em Python 3.11 no Windows e Linux;
os testes que inspecionam o schema são ignorados quando não há `DATABASE_URL`.
O workflow `Identity migration checks` usa PostgreSQL real para executar
upgrade, inspeção, `alembic check`, downgrade e novo upgrade. Checks da Vercel
validam somente o frontend.

## Migration inicial de identidade

Inicie o PostgreSQL pela raiz, defina `DATABASE_URL` usando `.env.example` e,
dentro da API, execute:

```bash
python -m alembic upgrade head
python -m alembic current
python -m alembic check
```

O recorte da #29 acrescenta instituições, disciplinas, períodos, turmas, grupos e
membros por meio da revision `0002_academic_groups`. Consulte o
[recorte físico e rollback](../../../docs/architecture/data-model.md#recorte-físico-da-issue-29).
Os testes `tests/test_academic_group_migration.py` exercitam suas restrições em
PostgreSQL, com dados sintéticos revertidos ao final de cada cenário.

As colunas `institution_id` e `course_id` são opcionais; `0004_academic_context`
cria `courses` e as FKs do perfil para instituição/curso. A FK de `avatar_file_id`
para mídia permanece adiada. Consulte o
[contrato acadêmico e migração corretiva](app/modules/academic/README.md).
O downgrade é destrutivo e só deve ser testado em banco descartável. Veja
[alembic/README](alembic/README).

## Persistência de usuário e perfil

O módulo [Users](app/modules/users/README.md) expõe `UserService`, schemas e erros
estáveis. A implementação SQLAlchemy fica isolada em `infrastructure/` e usa uma
unidade de trabalho explícita para commit/rollback. O perfil é opcional e, quando
informado, é criado na mesma transação da identidade.

Os testes unitários do service não exigem banco. Os testes de repository exigem
PostgreSQL migrado e são executados no workflow `Identity migration checks`, com
cobertura dos módulos `users` e `auth`.

## Cadastro

O contrato completo está no [README de Auth](app/modules/auth/README.md) e no
Swagger. Exemplo local, depois de iniciar e migrar o PostgreSQL:

```bash
curl -i http://127.0.0.1:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:8000" \
  -H "X-NexoAula-CSRF: 1" \
  --data '{"fullName":"Lucas Almeida","email":"lucas@example.com","password":"uma-senha-segura"}'
```

O sucesso `201` não contém senha, hash, token ou cookie. O usuário deve seguir
para o login. A validação também não reflete a senha recebida em
respostas de erro.


## Configurar autenticação

Use `.env.example` apenas no desenvolvimento HTTP local. Em ambiente publicado,
configure `ENVIRONMENT=production`, mantenha `AUTH_COOKIE_SECURE=true` e use
somente origens HTTPS exatas em `AUTH_ALLOWED_ORIGINS`. Origem inclui a porta,
sem barra final ou caminho. Não use curingas.

Gere `AUTH_JWT_SECRET` fora do repositório com
`python -c "import secrets; print(secrets.token_urlsafe(32))"` e armazene o valor
no ambiente ou `.env` local ignorado. Não cole esse valor em issues ou logs.
Configuração insegura de cookie ou segredo curto é rejeitada ao carregar a API.
Sem segredo, health continua disponível, mas login/validação de sessão retornam
`503`; sem origens autorizadas, mutações retornam `403`.

Veja os contratos, os exemplos de login/me/logout, a política CSRF e a limitação
de revogação no [README de Auth](app/modules/auth/README.md). O cadastro também
exige os headers CSRF. A integração do frontend continua fora desta entrega.
