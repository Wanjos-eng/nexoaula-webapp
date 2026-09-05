# Arquitetura do nexoAula

Monorepositório com Next.js em `Front-end/`, FastAPI em `Back-end/apps/api/` e PostgreSQL. O backend segue arquitetura modular/em camadas, não microsserviços. Veja o [ADR-0001](../decisions/ADR-0001-monorepo.md).

O frontend atual é uma demonstração navegável com mocks. O setup da API e a documentação do modelo não significam autenticação, persistência ou integração funcional já concluídas.

## Regra central do produto

Cada grupo possui seu próprio PD/plano de ensino, conteúdo, aulas e correções. Grupos da mesma turma não compartilham automaticamente essas informações. Acesso ao PD exige participação ativa no grupo; não existe acompanhamento avulso de turma ou PD pessoal.

PREVISTO (`teaching_plans` / `scheduled_lessons`), REALIZADO (`lesson_occurrences`) e registro individual (`student_lesson_attendance` / `student_topic_progress`) são camadas distintas. Presença/falta é privada e ligada ao aluno e à aula efetivamente realizada, não um registro compartilhado do grupo. O grupo de origem determina a autorização de acesso.

## Módulos e contratos

| Módulo | Responsabilidade | Limite e colaboração |
| --- | --- | --- |
| Identity | Conta, perfil, tokens e identidade autenticada | Fornece a identidade; não incorpora regras de grupos ou cobrança |
| Media | Metadados/referências de arquivos externos | Não guarda binários no PostgreSQL; acesso ao arquivo do PD exige autorização do grupo |
| Academic | Instituição, curso, disciplina, turma, período e docente | Catálogo de contexto; não representa matrícula oficial ou acompanhamento avulso |
| Academic Planning | Plano próprio do grupo, aulas, conteúdo, correções e registros individuais | Recebe contexto e autorização do grupo; preserva previsto/realizado e privacidade |
| Community | Grupos, membros, entrada, canais, mensagens e encontros gratuitos | Define pertencimento/papéis; integra contexto acadêmico sem assumir regras comerciais |
| Marketplace | Tutores, materiais, sessões, reservas e transações simuladas | Usa identidade e contexto acadêmico; não limita funcionalidades gratuitas |

Routers devem validar o contrato HTTP e delegar o caso de uso; regras ficam em serviços e persistência em repositories. A camada de aplicação coordena autorização e operações entre módulos usando interfaces públicas, sem importar repositories internos de outro módulo. FKs cruzadas não autorizam dependências circulares de implementação.

O frontend consome contratos HTTP/OpenAPI da API, não acessa o banco diretamente. Mocks precisam permanecer explícitos até a integração real. Não criar esqueletos de todos os módulos apenas porque aparecem no roadmap.

## Recortes de entrega

| Recorte | Conteúdo |
| --- | --- |
| CORE | Identity, Media, catálogo Academic, planos/aulas por grupo e registros individuais; grupos, membros, solicitações, canais e mensagens |
| NEXT | Importação assistida de PDF, correções colaborativas e histórico/aviso dos ajustes; encontros comunitários gratuitos |
| MONETIZATION | Perfil profissional, credenciamento, materiais, sessões de tutoria, inscrições, transações simuladas e avaliações |
| FUTURE | Publicidade, ainda sem tabelas físicas |

CORE não significa implementar todas as tabelas nesta Sprint. O núcleo gratuito não recebe limitação artificial de grupos ou membros. PDF não é requisito para cadastrar um plano manualmente; publicidade e integrações institucionais não foram implementadas. Não há dependência de UNIVASF/SIGA.

## Modelo, validação e decisões abertas

- [Guia de modelagem e limites das garantias](data-model.md).
- [DBML textual](../diagrams/nexoaula.dbml) e [diagramas gerados por módulo](../diagrams/README.md).
- [Proposta de persistência e migrations](../decisions/ADR-0003-persistence.md).
- [Fonte oficial no Notion](https://app.notion.com/p/3c9bb0fde01f806db3f3f09dc5a2d944).
- [Revisão da modelagem #7](https://github.com/Wanjos-eng/nexoaula-webapp/issues/7) e [decisão de monetização #11](https://github.com/Wanjos-eng/nexoaula-webapp/issues/11).

A documentação registra as decisões confirmadas e a revisão conjunta aceita por Wanjos-eng em 04/09/2026 como conclusão da #7, em substituição expressa ao critério de outro integrante. Não há aprovação atribuída a terceiros; publicar esta referência não autoriza migrations.

ORM e estratégia concreta de migrations possuem uma proposta na #20, ainda não
aprovada. Provedor de autenticação e storage continuam pendentes. Também exigem
decisão os papéis de publicação/correção, governança de conteúdo, saída de owner,
credenciamento/comissão e retenção/anonimização. Não tratar essas escolhas como
aprovadas antes do merge do ADR correspondente.
