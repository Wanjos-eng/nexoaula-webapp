# Community — configuração de grupos

O módulo cria, consulta e atualiza grupos de estudo, além de controlar descoberta
e participação sem apagar o histórico das solicitações.
Todas as rotas exigem uma sessão válida de usuário ativo. `POST` e `PATCH`
também exigem JSON, `X-NexoAula-CSRF: 1` e uma origem configurada em
`AUTH_ALLOWED_ORIGINS`.

| Rota | Sucesso | Regras principais |
| --- | --- | --- |
| `POST /api/v1/groups` | `201` | Disciplina existente; turma opcional da mesma disciplina; cria owner ativo na mesma transação. |
| `GET /api/v1/groups/{id}` | `200` | Retorna a configuração persistida a usuário autenticado. |
| `PATCH /api/v1/groups/{id}` | `200` | Somente o owner ativo pode alterar a configuração. |
| `GET /api/v1/groups` | `200` | Lista apenas grupos públicos e ativos; filtra por disciplina/código, período e assunto. |
| `POST /api/v1/groups/{id}/join` | `201` | Entrada imediata em grupo aberto ou criação de solicitação pendente; convite é recusado. |
| `PATCH /api/v1/groups/{id}/members/{userId}` | `200` | Owner/moderador ativo aprova, recusa ou remove; owner não pode ser removido. |

Exemplo de criação:

```json
{
  "name": "Cálculo I — listas",
  "description": "Revisão semanal",
  "rules": "Respeitar horários e registrar dúvidas antes do encontro.",
  "visibility": "public",
  "joinPolicy": "approval_required",
  "disciplineId": "00000000-0000-0000-0000-000000000001",
  "offeringId": null
}
```

`name`, `visibility` e `joinPolicy` podem ser omitidos no `PATCH`, mas não
aceitam `null`. `description` e `rules` aceitam `null` para limpeza explícita.
Pedidos guardam `pending`, `approved`, `rejected` ou `cancelled`, com responsável,
data e nota da decisão. Há no máximo um pedido pendente por usuário/grupo. A
remoção marca o vínculo como `removed`, com data e responsável, e uma nova entrada
reativa a mesma associação. Capacidade é conferida antes de entrada ou aprovação.

Erros de contexto retornam `400`, falta de autenticação retorna `401`, falta de
permissão retorna `403`, grupo ausente retorna `404`, conflito de estado/capacidade
retorna `409`, payload inválido retorna `422` e falha de persistência retorna `503`.
Respostas do módulo usam `Cache-Control: no-store`.

## Leituras para a interface (#33 e #34)

- `GET /api/v1/groups/mine?offset=0&limit=20`: grupos do usuário com participação ativa, incluindo privados/não listados.
- `GET /api/v1/groups/{id}/participation`: `status`, `role`, `canManage` e `memberCount` para a sessão atual.
- `GET /api/v1/groups/{id}/members?pending=false&offset=0&limit=20`: participantes ativos; `pending=true` consulta pedidos pendentes. Apenas organizadores ativos podem consultar, sem exposição de emails.

Os endpoints exigem sessão e preservam 404 para grupos privados inacessíveis. As listagens limitam `limit` a 100 e ordenam os resultados de modo estável. A remoção não apaga histórico pessoal.
