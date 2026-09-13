# Community — configuração de grupos

O módulo cria, consulta e atualiza a configuração básica de grupos de estudo.
Todas as rotas exigem uma sessão válida de usuário ativo. `POST` e `PATCH`
também exigem JSON, `X-NexoAula-CSRF: 1` e uma origem configurada em
`AUTH_ALLOWED_ORIGINS`.

| Rota | Sucesso | Regras principais |
| --- | --- | --- |
| `POST /api/v1/groups` | `201` | Disciplina existente; turma opcional da mesma disciplina; cria owner ativo na mesma transação. |
| `GET /api/v1/groups/{id}` | `200` | Retorna a configuração persistida a usuário autenticado. |
| `PATCH /api/v1/groups/{id}` | `200` | Somente o owner ativo pode alterar a configuração. |

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
Erros de contexto retornam `400`, falta de autenticação retorna `401`, edição
sem permissão retorna `403`, grupo ausente retorna `404`, payload inválido
retorna `422` e falha de persistência retorna `503`. Respostas do módulo usam
`Cache-Control: no-store`.
