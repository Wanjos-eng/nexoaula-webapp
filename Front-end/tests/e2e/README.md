# E2E — Autenticação e Fluxo de Negócio

A suíte usa Playwright contra a aplicação real, sem mocks de API. O banco é criado
no volume do Compose e os e-mails de teste recebem um identificador único por
execução.

## Execução reproduzível

Na raiz do repositório:

```bash
docker compose down -v --remove-orphans
docker compose up -d --build
cd Front-end
npm ci
npx playwright install chromium
npm run test:e2e
```

O relatório HTML fica em `Front-end/playwright-report/`; traces, screenshots e
vídeos de falhas ficam em `Front-end/test-results/`. Ao terminar, remova os
serviços e o volume para eliminar os dados de teste:

```bash
cd ..
docker compose down -v --remove-orphans
```

Para registrar a evidência, anote no PR a saída de `git rev-parse HEAD`, o sistema
operacional, as versões de Node, npm, Docker e Playwright, e o resultado de
`npm run test:e2e`.

## auth.spec.ts — Autenticação

Cenários: cadastro válido, e-mail duplicado, login válido, credenciais
inválidas, acesso a `/inicio`, cookie HttpOnly/SameSite, ausência de senha/token
em respostas e Web Storage, sessão ausente com resposta 401, header CSRF e
logout que expira o cookie. O atributo Secure é desativado apenas no ambiente
HTTP local; a verificação HTTPS permanece coberta pelos testes de integração da
API. A revogação antecipada de uma cópia do JWT não é esperada pelo ADR-0002.

## business-flow.spec.ts — Fluxo de negócio simulado

Cobre a jornada de publicação, descoberta, inscrição, duplicidade, cancelamento
e lotação, além do smoke da área gratuita de grupos. O teste usa usuários e dados
únicos, executa contra a aplicação real e não usa `page.route` nem mocks de API.
Também verifica o aviso de simulação, a comissão demonstrativa e a ausência de
campos financeiros reais.

### Cenários cobertos

| Teste | Descrição |
|-------|-----------|
| `publica, encontra, inscreve, cancela e verifica lotação` | Jornada feliz completa: tutor publica sessão → estudante encontra → simula inscrição → cancela → sessão volta a ter vaga |
| `recusa uma segunda inscrição ativa na mesma sessão` | Duplicidade: segunda inscrição na mesma sessão retorna alerta de inscrição ativa |
| `não expõe credenciais ou campos financeiros reais` | Verifica ausência de campos `pix`, `cpf`, `cartão` no form e de dados sensíveis nas respostas de API |

### Artefatos

Os artefatos ficam em `Front-end/playwright-report/` e
`Front-end/test-results/`. No PR, registre o commit, ambiente, versões de Node,
npm, Docker e Playwright e o resultado de:

```bash
npm run test:e2e -- tests/e2e/business-flow.spec.ts
```

### Dependência conhecida

A integração persistida das rotas de marketplace está em revisão. A execução
final deve ser repetida contra PostgreSQL após essa integração estar disponível.
