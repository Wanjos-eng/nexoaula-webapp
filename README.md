# nexoAula

O nexoAula é um WebApp acadêmico para organizar disciplinas, grupos de estudo, encontros e o progresso individual dos estudantes.

## Estado atual

O projeto está na **Sprint 1**. O objetivo desta fase é produzir um protótipo navegável do fluxo de criação e participação em grupos de estudo, acompanhado das definições iniciais de arquitetura, dados, repositório e backlog. Itens ainda em elaboração não são considerados concluídos.

## Estrutura do monorepositório

```text
.
|-- Front-end/             # Aplicação web (Next.js, ainda não inicializada)
|-- Back-end/              # API (FastAPI, ainda não inicializada)
|-- shared/                # Futuros componentes ou contratos compartilhados
|-- docs/
|   |-- decisions/         # Registros de decisões de arquitetura (ADRs)
|   `-- sprints/           # Planejamento e evidências por Sprint
`-- .github/               # CODEOWNERS e template de Pull Request
```

O projeto utilizará inicialmente um monorepositório. Essa decisão poderá ser revisada caso surja uma necessidade técnica ou organizacional real.

## Tecnologias definidas

- Frontend: Next.js.
- Backend: FastAPI (Python).
- Banco de dados: PostgreSQL.
- Arquitetura: modular/em camadas.

Nenhum framework ou dependência foi inicializado neste commit.

## Decisões registradas

- A importação do plano de ensino em PDF foi adiada para a Sprint 2 ou 3 e poderá ser avaliada como recurso premium.
- A organização inicial será em monorepositório; a decisão está registrada em [`docs/decisions/ADR-0001-monorepo.md`](docs/decisions/ADR-0001-monorepo.md).
- O repositório está privado nesta fase inicial, conforme a configuração solicitada. Uma eventual mudança para público depende de decisão explícita e de avaliação de segurança.

## Decisões pendentes

- Delimitação dos módulos e das camadas internas.
- Estratégia de autenticação e autorização.
- ORM, migrações e convenções detalhadas do banco de dados.
- Contrato inicial da API.
- Estratégia de testes, integração contínua e futuros status checks.
- Hospedagem e processo de implantação.
- Escopo, modelo e viabilidade do possível recurso premium.

Esses pontos não devem ser tratados como aprovados até que a equipe registre uma decisão.

## Fluxo de contribuição

1. Escolha uma história, tarefa ou issue.
2. Crie uma branch curta a partir da `main`.
3. Faça commits pequenos e descritivos.
4. Abra um Pull Request que referencie o trabalho correspondente.
5. Aguarde a revisão exigida e resolva as conversas antes do merge.

Commits e pushes diretos na `main` são proibidos após a inicialização do repositório. Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) para conhecer todas as regras.

## Segurança

Nunca versione senhas, tokens, chaves, credenciais ou arquivos `.env`. Use arquivos `.env.example` apenas com nomes de variáveis e valores fictícios seguros.

