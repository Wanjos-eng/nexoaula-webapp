# nexoAula / EstudaJunto

> Plataforma para formação de grupos de estudo baseados em compatibilidade de disciplina e horário.

## Visão do Produto
Para estudantes universitários que precisam organizar os estudos e encontrar colegas com objetivos e horários compatíveis, o **nexoAula** é um WebApp que conecta alunos através de grupos de estudo vinculados a disciplinas específicas, permitindo o acompanhamento de cronograma e progresso pessoal.

## Estrutura do Monorepo
/
├── Back-end/
├── apps/
│ └── web/ 
├── docs/ 
├── shared/ 
├── alembic/
└── README.md 


## Stack Tecnológica
| Camada | Tecnologia |
| :--- | :--- |
| Frontend | Next.js (React) |
| Backend | FastAPI (Python) |
| Banco de Dados | PostgreSQL |
| Documentação | Swagger/OpenAPI + ADRs |

## Como executar o projeto (local)

**Backend:**
```bash 
cd Back-end
python -m venv venv
source venv/bin/activate  # No Windows use: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload


**Frontend:**
```bash
cd apps/web
npm install
npm run dev
