# nexoAula

> Plataforma para formação de grupos de estudo baseados em compatibilidade de disciplina e horário.

## Visão do Produto
Para estudantes universitários que precisam organizar os estudos e encontrar colegas com objetivos e horários compatíveis, o **nexoAula** conecta alunos através de grupos vinculados a disciplinas. Cada grupo possui seu próprio plano de ensino, aulas e correções; presença/falta é um registro individual ligado à aula realizada. Não há acompanhamento de PD avulso fora dos grupos.

Estado atual: frontend demonstrativo navegável e API com migration e persistência
inicial de usuário/perfil, ainda sem autenticação HTTP ou integração funcional
com o frontend.

## Estrutura do Monorepo

```text
/
├── Back-end/apps/api/  # FastAPI, configuração, testes e Alembic adiado
├── Front-end/
├── compose.yml         # PostgreSQL local para desenvolvimento e testes
├── docs/
├── shared/
├── setup.ps1          # Setup do monorepo no Windows
├── setup.sh           # Setup do monorepo no Linux ou Git Bash
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

Linux ou Git Bash:

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

Veja [sistemas validados, permissões, solução de falhas e testes de
reexecução](docs/environment/setup.md). Os scripts não exigem administrador/sudo.
macOS e Cygwin não são suportados nesta validação; WSL não tem evidência específica.

## Como executar o projeto (local)

**PostgreSQL**, na raiz do monorepositório e com o Docker em execução:

```bash
docker compose up -d --wait
docker compose ps
```

O Compose inicia somente o banco. Ele usa valores públicos de desenvolvimento e
mantém os dados em volume local; não reutilize essas credenciais fora da máquina
de desenvolvimento. Consulte os comandos de conexão, configuração, parada e
[cuidados com o volume](docs/environment/postgresql-local.md).

**Backend no Windows**, após o setup:

```powershell
cd Back-end/apps/api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**Backend no Linux**, após o setup:

```bash
cd Back-end/apps/api
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

Abra [health](http://127.0.0.1:8000/health) ou [Swagger](http://127.0.0.1:8000/docs).
O health não depende de banco. Configuração, instalação manual e migrations estão
no [README da API](Back-end/apps/api/README.md).
PostgreSQL, SQLAlchemy 2 e Alembic foram definidos no
[ADR-0003](docs/decisions/ADR-0003-persistence.md). A migration inicial libera
somente `users`, `user_profiles` e `auth_tokens`; os demais módulos continuam
pendentes e serão adicionados incrementalmente.
O JWT em cookie `HttpOnly` para o primeiro fluxo web foi definido no
[ADR-0002](docs/decisions/ADR-0002-authentication.md); os endpoints ainda não
foram implementados.


**Frontend**, em outro terminal:
```bash 
cd Front-end
npm ci
npm run dev
```

**Links Úteis:**

[Quadro do Projeto (GitHub Projects)](https://github.com/users/Wanjos-eng/projects/7/views/1)

## Documentação técnica

- [Arquitetura, módulos e recortes de entrega](docs/architecture/README.md).
- [Modelagem revisada e validação](docs/architecture/data-model.md).
- [Diagramas gerados do DBML](docs/diagrams/README.md).
- [Decisões arquiteturais](docs/decisions/).

## Contribuição

Não faça commits diretos na `main`. Use uma branch, submeta PR vinculado à issue e
aguarde a revisão exigida. Nunca versione senhas, tokens ou arquivos `.env`;
somente exemplos sem segredos. Consulte [CONTRIBUTING.md](CONTRIBUTING.md).
