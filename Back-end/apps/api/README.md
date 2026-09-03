# nexoAula API — setup inicial

FastAPI executável com router técnico e configuração centralizada. Não implementa
cadastro, login, regras de negócio ou conexão com banco. PostgreSQL está definido;
a decisão de ORM/migrations continua pendente.

## Ambiente

Use Python **3.11.x**. `requirements.txt` é a fonte única das dependências da API.
As dependências herdadas do PR #2 foram preservadas sem introduzir seu uso no app.
As três dependências adicionadas para configuração/testes também têm versão fixa.
As dependências transitivas novas ainda são resolvidas pelo pip; isto não é um
lock multiplataforma completo.

Pela raiz do monorepo, `./setup.ps1 -Target Backend` (Windows) ou
`bash ./setup.sh --target backend` (Linux/macOS) cria `.venv` nesta pasta e instala
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

Linux/macOS, a partir da raiz:

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

O arquivo `.env` é opcional; os padrões permitem iniciar e testar sem banco.
Se necessário, copie `.env.example` para `.env` manualmente sem sobrescrever um
arquivo existente. Nunca versione `.env` nem segredos.

| Opção | Padrão | Uso |
| --- | --- | --- |
| `PROJECT_NAME` | `nexoAula API` | Título da documentação |
| `VERSION` | `0.1.0` | Versão da API no OpenAPI |

Variáveis de ambiente têm precedência sobre `.env`. O caminho do arquivo é
relativo à API, independentemente do diretório de execução. Valores vazios são
rejeitados pelo Pydantic com o nome do campo. Não há `DATABASE_URL`, tokens ou
credenciais necessárias neste setup.

## Verificação

Dentro desta pasta e com o ambiente ativado:

```bash
python -m pip check
python -m pytest -q
python -m alembic history
```

No Windows, substitua `python` por `.\.venv\Scripts\python.exe` se não ativou o ambiente.
Pytest cobre health, OpenAPI, configuração, scaffold e contrato dos scripts.
O workflow `Backend checks` executa a suíte em Python 3.11 no Windows e Linux;
checks da Vercel validam somente o frontend.

## Alembic legado: migrations adiadas

`alembic.ini` e `alembic/` foram reunidos aqui. `python -m alembic history`
deve terminar sem listar revisões. Não há migration de domínio nem conexão com
banco. O `env.py` bloqueia explicitamente operações de migrations até a decisão
específica, sem SQLite nem escolha nova de ORM. O template legado foi preservado.
Veja [alembic/README](alembic/README).

