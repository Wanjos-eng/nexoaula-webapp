# Módulo Auth

O módulo Auth coordena os contratos HTTP de autenticação sem criar uma identidade
paralela. Ele consome somente a interface pública de `app.modules.users`; acesso
ao SQLAlchemy e controle transacional continuam encapsulados pelo módulo Users.

## Cadastro disponível

`POST /api/v1/auth/register` recebe:

```json
{
  "fullName": "Lucas Almeida",
  "email": "lucas@example.com",
  "password": "uma-senha-segura"
}
```

- nome: de 3 a 120 caracteres após normalização dos espaços;
- e-mail: sintaxe válida, limitado a 320 caracteres e normalizado por Users;
- senha: de 8 a 72 caracteres e no máximo 72 bytes, limite seguro do bcrypt;
- campos desconhecidos são rejeitados.

A senha é recebida como `SecretStr`, transformada em bcrypt antes de atravessar a
fronteira de Users e nunca aparece na representação pública, em erros de
validação ou na documentação de resposta. O cadastro cria o perfil mínimo com o
nome na mesma transação da identidade.

O sucesso retorna `201` e apenas `id`, `email`, `fullName` e `createdAt`.
Duplicidade retorna `409`, entrada inválida retorna `422` e indisponibilidade de
persistência retorna `503`. As respostas não são armazenáveis em cache.

Conforme o ADR-0002, cadastro não emite JWT, não cria cookie e não autentica
automaticamente. Login, sessão, recuperação de senha, aceite de termos e
confirmação de senha não fazem parte deste endpoint.

## Login, sessão e logout (#24)

| Método e rota | Sucesso | Erros |
| --- | --- | --- |
| `POST /api/v1/auth/login` | `200`, usuário público e cookie | `401`, `403`, `422`, `503` |
| `GET /api/v1/auth/me` | `200`, usuário público atual | `401`, `503` |
| `POST /api/v1/auth/logout` | `204`, cookie expirado, mesmo sem sessão válida | `403` |

Login recebe `email` e `password`; não aceita campos extras. O e-mail é
normalizado por Users. A senha não é normalizada nem truncada: aceita de 1 a 72
caracteres, no máximo 72 bytes; credenciais incorretas retornam `401` genérico.
O cadastro mantém sua exigência de pelo menos 8 caracteres.

Login e `/me` retornam somente `id`, `email`, `fullName`, `createdAt`.
`fullName` é nulo quando a identidade não possui perfil, possibilidade já
suportada por Users. E-mail inexistente, senha incorreta, conta inativa ou excluída
recebem a mesma mensagem. O caminho de usuário inexistente também verifica um
hash bcrypt fictício. Hash e senha nunca aparecem no JSON público.

A assinatura aceita somente HS256, com `iss=nexoaula-api`, `aud=nexoaula-web`,
`sub` UUID, `jti` aleatório e tempos `iat`, `nbf`, `exp`. A validade absoluta é
30 minutos, com tolerância de relógio de até 30 segundos na validação. Não há
renovação deslizante, refresh, tabela de sessão ou denylist. `/me` consulta Users
a cada requisição e rejeita contas bloqueadas/excluídas após a emissão.

O cookie HTTPS é `__Host-nexoaula_session`, `Secure`, `HttpOnly`, `SameSite=Lax`,
`Path=/`, sem `Domain`; expiração e Max-Age não ultrapassam o JWT. HTTP local usa
`nexoaula_session`, sem Secure, somente com `ENVIRONMENT=development` explícito.
O logout repete os atributos do cookie e o expira. Uma cópia anterior do JWT
continua válida até expirar: não existe logout global ou revogação individual.

## CSRF e cache

Todas as mutações de Auth, **incluindo cadastro, login e logout**, exigem:

- `Content-Type: application/json` (logout pode enviar `{}`);
- `X-NexoAula-CSRF: 1`;
- `Origin` na allowlist exata `AUTH_ALLOWED_ORIGINS`, ou origem do `Referer`
  somente quando `Origin` estiver ausente;
- `Sec-Fetch-Site` diferente de `cross-site`, quando presente.

Requisições fora da política retornam `403` antes de consultar o banco.
Todas as respostas de Auth, inclusive erros de validação e CSRF, usam
`Cache-Control: no-store` e `Vary: Origin, Referer, Sec-Fetch-Site`.
O cliente web deve acessar `/api` pela mesma origem; nenhum CORS aberto foi
adicionado. O proxy de mesma origem pertence à integração frontend.
O OpenAPI documenta os headers CSRF e o cookie de autenticação. No Swagger,
informe `X-NexoAula-CSRF: 1` e configure a origem local na allowlist; o navegador
controla Origin/Referer e transporta o cookie automaticamente.

## Exemplo HTTP local

Configure o ambiente da API conforme seu `.env.example`, gere o segredo fora do
repositório e inicie o PostgreSQL migrado e a API. Os dados abaixo são sintéticos.

```bash
curl -i http://127.0.0.1:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:8000' \
  -H 'X-NexoAula-CSRF: 1' \
  -c /tmp/nexoaula-cookies \
  --data '{"email":"lucas@example.com","password":"uma-senha-segura"}'

curl -i http://127.0.0.1:8000/api/v1/auth/me -b /tmp/nexoaula-cookies

curl -i http://127.0.0.1:8000/api/v1/auth/logout \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://127.0.0.1:8000' \
  -H 'X-NexoAula-CSRF: 1' \
  -b /tmp/nexoaula-cookies -c /tmp/nexoaula-cookies --data '{}'
```

O arquivo de cookies é uma credencial local temporária; remova-o após o teste e
não o versione. Não registre o JWT em logs nem o copie para Web Storage.
