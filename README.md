# nexoAula

> Plataforma para formação de grupos de estudo baseados em compatibilidade de disciplina e horário.

## Visão do Produto
Para estudantes universitários que precisam organizar os estudos e encontrar colegas com objetivos e horários compatíveis, o **nexoAula** é um WebApp que conecta alunos através de grupos de estudo vinculados a disciplinas específicas, permitindo o acompanhamento de cronograma e progresso pessoal.

Estado atual: frontend demonstrativo navegável e API em setup técnico, ainda sem
autenticação, persistência ou integração funcional com o frontend.

## Estrutura do Monorepo

```text
/
├── Back-end/apps/api/  # FastAPI, configuração, testes e Alembic adiado
├── Front-end/
├── docs/
├── shared/
├── setup.ps1          # Setup do monorepo no Windows
├── setup.sh           # Setup do monorepo no Linux/macOS ou Git Bash
└── README.md
```


## Stack Tecnológica
| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js (React) |
| Backend | FastAPI (Python) |
| Banco de Dados | PostgreSQL |
| Documentação | Swagger/OpenAPI + ADRs |

## Preparar o ambiente

Instale Python **3.11.x** e Node.js **22.13+ na linha 22.x** ou **24.x**, com npm.
Os scripts verificam essas versões; não executam instaladores globais, `sudo`,
alterações de PATH ou cópia de `.env`.

Na raiz, no PowerShell:

```powershell
.\setup.ps1 -Check
.\setup.ps1
.\setup.ps1 -Target Backend -PythonExecutable 'C:\caminho\python.exe'
.\setup.ps1 -Target Frontend
```

Linux/macOS ou Git Bash:

```bash
bash ./setup.sh --check
bash ./setup.sh
bash ./setup.sh --target backend --python /caminho/python3.11
bash ./setup.sh --target frontend
```

No Bash, `--python` também pode ser definido por `PYTHON_EXECUTABLE`. Todos os
caminhos são resolvidos pelo local do script, inclusive quando chamado pelo
caminho absoluto a partir de outra pasta. `-Check`/`--check` somente verifica
pré-requisitos, sem instalar dependências. Erros de versão, arquivo ausente,
instalação ou `pip check` encerram com código diferente de zero, sem anunciar sucesso.

A API usa exclusivamente `Back-end/apps/api/requirements.txt` e cria o ambiente
em `Back-end/apps/api/.venv`. Um ambiente existente de outra versão é rejeitado;
revise-o e recrie-o manualmente, sem apagar ambientes automaticamente.
O frontend usa `npm ci` e exige o `package-lock.json` versionado.

## Como executar o projeto (local)

**Backend no Windows**, após o setup:

```powershell
cd Back-end/apps/api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Backend no Linux/macOS**, após o setup:

```bash
cd Back-end/apps/api
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

Abra [health](http://127.0.0.1:8000/health) ou [Swagger](http://127.0.0.1:8000/docs).
O health não depende de banco. Configuração, instalação manual, testes e adiamento
do Alembic estão no [README da API](Back-end/apps/api/README.md).
PostgreSQL está definido; a decisão de ORM/migrations continua pendente. O scaffold
legado foi preservado dentro da API, sem configurar conexão nem migration de domínio.


**Frontend**, em outro terminal:
```bash 
cd Front-end
npm ci
npm run dev
```

**Links Úteis:**

[Quadro do Projeto (GitHub Projects)](https://github.com/users/Wanjos-eng/projects/7/views/1)

## Contribuição

Não faça commits diretos na `main`. Use uma branch, submeta PR vinculado à issue e
aguarde a revisão exigida. Nunca versione senhas, tokens ou arquivos `.env`;
somente exemplos sem segredos. Consulte [CONTRIBUTING.md](CONTRIBUTING.md).

* 📚 **[Documentação de Arquitetura e Banco de Dados](docs/architecture/README.md)**