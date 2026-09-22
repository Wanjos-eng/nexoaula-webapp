# API de planos e cronograma

Todas as rotas exigem sessão. Mutações também exigem `Content-Type:
application/json`, `X-NexoAula-CSRF: 1` e origem autorizada, inclusive publicação
e DELETE. A participação ativa é consultada em cada operação; pedidos pendentes,
saída e remoção não concedem leitura. Escritas exigem owner ou moderator ativo.

## Contrato

Prefixo de grupo: `/api/v1/groups/{group_id}`.

- `POST /topics`: `{"customTitle":"Limites"}` ou `{"subjectTopicId":"uuid"}`.
  A referência de catálogo deve pertencer à disciplina do grupo.
- `GET /topics`: assuntos locais do grupo.
- `POST /plans`: cria rascunho versionado, com `lessons` opcional. O servidor
  determina criador, grupo e próxima versão sob lock transacional do grupo.
- `GET /plans?offset=0&limit=20`: histórico, em ordem decrescente de versão.
- `PATCH /plans/{plan_id}`: substitui a lista `lessons` de um rascunho em uma
  transação. O campo é obrigatório; `[]` remove todas as aulas do rascunho.
- `POST /plans/{plan_id}/publish`: publica o rascunho e arquiva a versão vigente
  atomicamente, persistindo autor e instante. Versões antigas não podem substituir
  uma mais recente. Planos publicados ou arquivados são imutáveis nesta API.
- `POST /lessons`: adiciona aula ao plano mais recente, que precisa ser rascunho.
- `PATCH /lessons/{lesson_id}` e `DELETE /lessons/{lesson_id}`: alteram apenas
  aulas de rascunhos do próprio grupo. `description: null` limpa a descrição.
- `GET /lessons`: cronograma publicado vigente; `plan_id` permite consultar uma
  versão específica do próprio grupo, inclusive o histórico.

As rotas originais `POST /teaching-plans` e `GET /teaching-plans/latest` continuam
disponíveis. `latest` retorna a versão mais recente, inclusive um rascunho, ou
`null`; não significa o plano publicado vigente.

A aula usa `title`, `description`, `scheduledAt` (ISO 8601 com fuso obrigatório)
e `topicIds` (IDs de assuntos do próprio grupo, sem duplicatas). Respostas usam
camelCase; horários de aulas são normalizados para UTC. O frontend converte para
o fuso de apresentação. Aula prevista não registra presença nem aula realizada.
`sourceFileId` só aceita null até a entrega de arquivos #119.

## Calendário do usuário

`GET /api/v1/groups/me/lessons` agrega apenas planos publicados de grupos com
participação ativa. Não exige matrícula acadêmica adicional. Aceita `start`
inclusivo, `end` exclusivo (ambos com fuso), `period=past|future`, `offset` e
`limit` (1–100). O relógio UTC do servidor define passado/futuro. Ordenação por
horário e ID mantém a paginação estável. Sem resultados, retorna `[]`.

## Erros

- 401: sessão ausente/inválida.
- 403: participação ou papel insuficiente, ou proteção CSRF inválida.
- 404: grupo, plano ou aula inexistente/inacessível; UUID de outro grupo não
  permite alterar nem publicar conteúdo.
- 409: assunto já vinculado, edição de plano publicado ou publicação obsoleta.
- 422: título vazio, fuso ausente, campos obrigatórios nulos, tópicos inválidos,
  repetidos ou de outro grupo, anexo ainda indisponível, intervalo inválido.
- 503: falha de persistência; a unidade de trabalho reverte a transação.

Testes em `tests/integration/community/test_teaching_plans.py` exercitam HTTP e
PostgreSQL migrado, publicação/histórico, isolamento, rollback, aprovação/entrada,
remoção/saída, campos inválidos, UTC, sessão e CSRF.
