# Integração com a API

Cliente HTTP compartilhado para comunicação com o backend FastAPI.

## Arquitetura

O frontend consome a API por **mesma origem** (`/api`), encaminhada ao FastAPI
via rewrite do Next.js (ver `next.config.ts`). Essa decisão segue o
[ADR-0002](../../../docs/decisions/ADR-0002-authentication.md).

## Uso

```ts
import { apiClient, ApiError } from "@/lib/api";

// GET — leitura, sem CSRF
const { data } = await apiClient.get<User>("/v1/auth/me");

// POST — mutação, envia header X-NexoAula-CSRF: 1 automaticamente
await apiClient.post("/v1/auth/login", {
  body: { email, password },
});

// DELETE
await apiClient.del("/v1/auth/logout");
```

## Tratamento de erros

```ts
import { apiClient, ApiError, NetworkError, TimeoutError } from "@/lib/api";

try {
  const { data } = await apiClient.get<User>("/v1/auth/me");
} catch (error) {
  if (error instanceof ApiError) {
    // Erro HTTP (4xx, 5xx) — error.status, error.body
  }
  if (error instanceof NetworkError) {
    // Falha de rede — offline, DNS, conexão recusada
  }
  if (error instanceof TimeoutError) {
    // Requisição excedeu o timeout
  }
}
```

## Segurança

- **Não** monta header `Authorization` — autenticação via cookie HttpOnly
- **Não** lê token — cookie é transportado automaticamente pelo navegador
- **Não** persiste credenciais — sem `localStorage`/`sessionStorage`
- `credentials: "same-origin"` em todas as chamadas
- Header CSRF enviado apenas em mutações (`POST`, `PUT`, `PATCH`, `DELETE`)
