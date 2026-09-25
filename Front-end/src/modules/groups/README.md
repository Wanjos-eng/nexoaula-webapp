# Cronograma e contexto acadêmico (#113)

O componente de produção é `GroupDetail`, em `/grupos/[groupId]`. `GroupSchedule`
usa o cliente HTTP compartilhado e os planos versionados da #112:

- `GET/POST /v1/groups/{groupId}/plans`: listar versões ou criar rascunho.
- `PATCH /v1/groups/{groupId}/plans/{planId}`: substituir aulas do rascunho.
- `POST /v1/groups/{groupId}/plans/{planId}/publish`: publicar a versão.
- `GET /v1/groups/me/lessons?start=...&end=...`: aulas publicadas por participação ativa.

Cada aula envia `title`, `description`, `scheduledAt` com fuso e `topicIds`.
O formulário recebe horário local e converte para ISO; preserva os tópicos ao
editar ou criar outra versão. Se a publicação falhar após salvar, a nova tentativa
reutiliza o ID salvo. Membros têm somente leitura do plano publicado; a API
continua responsável por autorizar toda leitura e mutação.

`/disciplinas` e `/calendario` usam grupos de `/groups/mine` e catálogos reais.
Grupos da mesma turma permanecem separados por `groupId`. O calendário carrega
todas as páginas de aulas para as seis semanas visíveis, considera o fuso local
e navega até o ID da aula no grupo. Rotas demonstrativas antigas redirecionam
para as listas reais, sem dados fictícios.

As consultas são invalidadas após mutações de participação, edição e publicação,
ao retornar à janela e ao recarregar explicitamente. Falhas não exibem dados
antigos como se fossem atuais. Sem participação, há descoberta de grupos.
Não foi criado endpoint de saída: remoção usa o contrato de gestão existente.

## Verificação

`schedule.test.tsx` cobre contrato HTTP, permissões na UI, persistência simulada,
erros, repetição segura, paginação e isolamento de grupos. `groups-real.spec.ts`
executa o fluxo com dois usuários, API e PostgreSQL reais na CI: criar, salvar,
recarregar, editar, publicar, aprovar, consultar calendário, detalhar, separar
grupos da mesma turma e remover participação. Também verifica a recusa de
mutação pelo membro (403). Não há mudança de esquema ou migração neste PR.

## Filtros acadêmicos (#121)

A descoberta mantém `subject`, `period` e `topic` textuais e acrescenta seleções
por `subjectId`, `classSectionId`, `teacherId` e `subjectTopicId`. As opções vêm dos
catálogos autenticados, percorrendo todas as páginas. Professor é filtrado pelos
vínculos reais com turmas, incluindo vínculos históricos para períodos anteriores.
Selecionar disciplina, turma ou assunto limpa combinações incompatíveis; não há
opções fictícias quando o catálogo está vazio ou falha.

Criar/configurar grupo permite selecionar os assuntos da disciplina. A criação
ou alteração envia `subjectTopicIds` na mesma transação dos demais campos; na
edição o campo é omitido enquanto a seleção não for alterada. A recarga recupera
`GET /groups/{id}/topics`. Assuntos personalizados são preservados. A API rejeita
remoção de assuntos em uso por aulas, canais, encontros ou progresso e mantém o
formulário disponível para corrigir a seleção.

`discovery.test.tsx` cobre filtros dependentes, configuração e falhas de API.
`discovery-real.spec.ts` verifica a integração com a API e PostgreSQL reais,
incluindo recarga, dois usuários, grupo privado, resposta vazia e recuperação
após uma falha de transporte simulada. Este incremento usa a migração `0013`.
