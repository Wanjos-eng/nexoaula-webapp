# ADR-0002: Autenticação do primeiro fluxo web

- **Status:** Aceita — decisão do proprietário em 2026-09-07
- **Data:** 2026-09-07
- **Issue:** [#19 — Definir mecanismo de autenticação do primeiro fluxo](https://github.com/Wanjos-eng/nexoaula-webapp/issues/19)

## Contexto

O primeiro fluxo funcional do nexoAula precisa integrar cadastro e login entre o
Next.js e o FastAPI. O produto atual é uma plataforma web acadêmica, ainda sem
cliente móvel, federação de identidade ou requisito de encerrar remotamente todas
as sessões. O modelo mantém credenciais próprias em `users.password_hash` e usa
`auth_tokens` apenas para tokens de uso único de verificação e recuperação.

O backend já possui `python-jose`, mas a presença da dependência não constituía
uma decisão. Também não existe tabela de sessões. O proprietário decidiu priorizar
um mecanismo simples para a disciplina e aceitar a limitação temporária de
revogação, com possibilidade de evolução posterior.

## Critérios considerados

- integração simples entre Next.js e FastAPI;
- nenhum token de autenticação acessível ao JavaScript do navegador;
- nenhum segredo ou credencial versionado;
- proteção explícita contra CSRF e redução do impacto de XSS;
- comportamento previsível de expiração e logout;
- compatibilidade com o deploy web e o desenvolvimento local;
- possibilidade de evoluir sem reescrever migrations ou histórico Git.

## Alternativas avaliadas

### Sessão opaca persistida no servidor

Permite revogação imediata, inventário de dispositivos e logout global. Exigiria
uma tabela `auth_sessions` e ampliaria a primeira migration. É a evolução preferida
se o produto precisar de controle real de sessões, mas não foi escolhida para o
primeiro fluxo acadêmico.

### JWT em cookie `HttpOnly`

É a alternativa escolhida. Não exige estado adicional no banco e aproveita a
dependência já presente no FastAPI. O cookie reduz a exposição a roubo por XSS,
mas exige defesa contra CSRF. O logout remove o cookie do navegador; uma cópia já
obtida do JWT continua válida até a expiração.

### Bearer JWT em `localStorage` ou `sessionStorage`

Foi rejeitado. Qualquer JavaScript executado na origem poderia ler e exfiltrar o
token. O frontend não deve receber o JWT no corpo da resposta nem montar o header
`Authorization` a partir de armazenamento web.

### Provedor externo de identidade

Clerk, Auth0 e alternativas semelhantes reduzem parte da implementação, mas
introduzem dependência de terceiro e mudam o fluxo atual de credenciais próprias.
Podem ser reavaliados se surgirem requisitos de login social, SSO ou operação em
produção; não serão usados no primeiro fluxo.

## Decisão

Adotar um **JWT de acesso curto, assinado pelo FastAPI e transportado apenas em
cookie `HttpOnly`**.

### Emissão e validação

- algoritmo fixo no código: `HS256`; o decoder aceita exclusivamente esse
  algoritmo e nunca confia no `alg` recebido sem uma lista permitida;
- chave: `AUTH_JWT_SECRET`, gerada fora do repositório com pelo menos 256 bits e
  carregada como segredo de ambiente;
- validade absoluta: **30 minutos**, sem renovação deslizante e sem refresh token
  neste primeiro fluxo;
- tolerância máxima de relógio: 30 segundos;
- claims obrigatórias: `sub` com o UUID do usuário, `iss` (`nexoaula-api`), `aud`
  (`nexoaula-web`), `iat`, `nbf`, `exp` e `jti` aleatório;
- perfil, e-mail, papéis e permissões não entram no JWT. A API carrega o usuário
  atual pelo `sub` e confirma que a conta permanece ativa e não excluída;
- assinatura, issuer, audience, expiração e claims obrigatórias são validados em
  toda requisição protegida. Falhas retornam `401` sem revelar detalhes internos.

O token autentica a identidade, não autoriza ações sozinho. Cada módulo consulta
as regras e o estado atuais; papéis mutáveis não ficam congelados no JWT.

### Cookie e transporte

Em HTTPS, o cookie se chama `__Host-nexoaula_session` e usa:

```text
Secure; HttpOnly; SameSite=Lax; Path=/
```

Não há atributo `Domain`, e `Max-Age`/`Expires` não ultrapassam o `exp` do JWT. Em
desenvolvimento HTTP local, usa-se o nome `nexoaula_session`, sem `Secure`, somente
quando o ambiente for explicitamente `development`. Configurações publicadas
falham se tentarem desabilitar `Secure`.

O navegador acessa a API por uma rota de mesma origem, como `/api`, encaminhada ao
FastAPI pelo frontend ou pela infraestrutura. O proxy não decodifica nem duplica o
JWT. Não usar `SameSite=None` nem CORS aberto como atalho para hospedar frontend e
API em sites não relacionados. Se o deploy não puder oferecer mesma origem, a
topologia deve ser decidida antes da integração.

O JWT nunca é retornado em JSON, URL ou log e nunca é armazenado em
`localStorage`, `sessionStorage` ou estado persistido do React.

### CSRF

Como o navegador envia cookies automaticamente, toda operação autenticada que
altera estado deve:

1. usar somente `POST`, `PUT`, `PATCH` ou `DELETE`; nenhum `GET` altera estado;
2. aceitar JSON e rejeitar content types simples não previstos;
3. exigir o header `X-NexoAula-CSRF: 1` do cliente web;
4. validar `Origin` contra uma allowlist exata; usar `Referer` apenas como fallback
   e rejeitar a requisição se ambos estiverem ausentes;
5. rejeitar `Sec-Fetch-Site: cross-site` quando o header estiver presente;
6. nunca combinar credenciais com `Access-Control-Allow-Origin: *`.

`SameSite=Lax` é defesa adicional, não substitui essas verificações. Login,
logout e demais mutações usam a mesma política. A aplicação deve incluir
`Vary: Origin, Sec-Fetch-Site` quando a resposta depender desses headers.

### XSS

`HttpOnly` impede a leitura direta do cookie, mas não impede um script malicioso
de agir em nome do usuário. O frontend deve manter escaping padrão do React,
evitar HTML não confiável, aplicar Content Security Policy quando a integração for
publicada e não persistir segredos. O backend continua validando autorização e
entrada em cada operação.

## Contrato HTTP afetado

| Operação | Resultado relevante |
| --- | --- |
| `POST /api/v1/auth/register` | `201`; cria a conta, não autentica automaticamente e nunca retorna senha/hash |
| `POST /api/v1/auth/login` | `200`; define os cookies e retorna somente a representação pública do usuário |
| `GET /api/v1/auth/me` | `200` com usuário público ou `401`; `Cache-Control: no-store` |
| `POST /api/v1/auth/logout` | `204`; expira os cookies com os mesmos atributos usados na criação |

Cadastro e login também usam `Cache-Control: no-store`. Credenciais inválidas
recebem uma mensagem genérica, sem confirmar a existência do e-mail. O cliente
trata `401` como sessão ausente ou expirada, limpa apenas seu estado público e
redireciona para o login sem tentar ler o cookie.

## Expiração, logout e limitação aceita

Não há refresh automático. Após 30 minutos, o usuário autentica novamente. Logout
remove o cookie no navegador, mas não cria denylist: um JWT copiado antes do
logout pode ser usado até expirar. Essa limitação foi aceita para o projeto da
disciplina e deve aparecer nos testes e na documentação, sem ser apresentada
como revogação completa.

A troca de `AUTH_JWT_SECRET` invalida todos os JWTs emitidos. A operação deve ser
coordenada; o segredo não aparece em logs. Bloqueio ou exclusão de conta continua
efetivo porque a API consulta o usuário em requisições protegidas.

## Ameaças e mitigação mínima

| Ameaça | Mitigação do primeiro fluxo | Risco residual |
| --- | --- | --- |
| Roubo por XSS | Cookie `HttpOnly`, sem Web Storage, CSP e escaping | XSS ainda pode enviar ações enquanto estiver ativo |
| CSRF | `SameSite=Lax`, header próprio, Origin/Referer e Fetch Metadata | Configuração incorreta de proxy/origens pode bloquear ou expor chamadas |
| Token adulterado | HS256 fixo, segredo forte e validação de claims | Vazamento do segredo permite forjar tokens até a rotação |
| Replay após logout | expiração curta e consulta de conta ativa | Cópia do token vale por no máximo 30 minutos |
| Permissão desatualizada | nenhum papel no JWT; autorização consulta estado atual | A consulta ao banco é necessária em rotas protegidas |

## Impacto nas próximas issues

- [#21](https://github.com/Wanjos-eng/nexoaula-webapp/issues/21): não cria
  `auth_sessions`; `auth_tokens` continua reservado a verificação/recuperação.
- [#23](https://github.com/Wanjos-eng/nexoaula-webapp/issues/23): cadastro não
  gera JWT nem login automático.
- [#24](https://github.com/Wanjos-eng/nexoaula-webapp/issues/24): implementa
  emissão, validação, `/me`, logout e cookies conforme este ADR.
- [#25](https://github.com/Wanjos-eng/nexoaula-webapp/issues/25): cliente usa
  `/api` de mesma origem, cookies automáticos e o header CSRF; não manipula token.
- [#26](https://github.com/Wanjos-eng/nexoaula-webapp/issues/26): após cadastro,
  encaminha para login sem persistir credenciais.
- [#27](https://github.com/Wanjos-eng/nexoaula-webapp/issues/27): login passa a
  depender apenas do cookie e `/me` para restaurar o estado público.

## Consequências e evolução

### Benefícios

- não amplia a primeira migration com estado de sessão;
- reduz exposição do token a JavaScript;
- mantém o primeiro fluxo pequeno e compatível com o prazo acadêmico;
- deixa contrato e controles mínimos explícitos para backend, frontend e deploy.

### Custos e riscos

- não existe revogação individual ou logout global;
- o usuário precisa autenticar novamente após a expiração;
- frontend e API precisam de uma rota de mesma origem no navegador;
- cookies exigem defesa CSRF que um bearer token em header não exigiria da mesma
  forma.

Se o produto exigir sessões longas, múltiplos dispositivos, revogação imediata,
aplicativo móvel, SSO ou login social, um novo ADR deve avaliar sessão opaca ou
access token curto com refresh rotativo persistido. A evolução acrescenta uma
migration; não reutiliza `auth_tokens` com semântica incompatível e não reescreve
revisions já compartilhadas.

## Referências

- [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/rfc7519/)
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP — JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
