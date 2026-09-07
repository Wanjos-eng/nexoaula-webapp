# nexoAula API — setup inicial

FastAPI executável com router técnico, configuração centralizada e persistência
inicial de identidade. Ainda não implementa cadastro, login ou regras de negócio.
PostgreSQL, SQLAlchemy 2 e Alembic estão integrados no recorte da Issue #21.

A decisão está documentada no
[ADR-0003](../../../docs/decisions/ADR-0003-persistence.md). A primeira migration
cria somente `users`, `user_profiles` e `auth_tokens`; os demais módulos do DBML
continuam fora deste recorte.

O mecanismo JWT em cookie `HttpOnly` do primeiro fluxo foi definido no
[ADR-0002](../../../docs/decisions/ADR-0002-authentication.md). Nenhum endpoint,
segredo ou cookie real é criado por este documento.

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

As colunas opcionais `avatar_file_id`, `institution_id` e `course_id` são
preservadas em `user_profiles`, mas suas FKs dependem de tabelas de Media e
Academic ainda fora do recorte. Elas serão criadas pelas migrations responsáveis.
O downgrade é destrutivo e só deve ser testado em banco descartável. Veja
[alembic/README](alembic/README).

