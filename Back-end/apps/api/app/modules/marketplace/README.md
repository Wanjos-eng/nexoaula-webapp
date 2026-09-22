# Tutoria simulada — ofertas e inscrições (#39 / #40)

Implementa US21/US23/US24/US27/US28 sobre a migration #38 e a ADR-0004. O núcleo acadêmico
continua gratuito. Nenhuma cobrança, credenciamento real ou coleta financeira.

## Contrato HTTP

Prefixo `/api/v1/marketplace`. Todas as rotas exigem conta ativa e cookie de sessão.
Campos usam **snake_case**, conforme o contrato da ADR. Respostas incluem
`simulated: true` e `notice: "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica."`.
OpenAPI em `/openapi.json` e documentação interativa em `/docs`.

| Método e caminho | Comportamento |
| --- | --- |
| GET `/tutor` | Perfil próprio; `null` se ainda não ativado |
| POST `/tutor/activate` | Ativa/retoma; body opcional com headline e bio profissionais |
| DELETE `/tutor/deactivate` | Pausa sem alterar conta/perfil acadêmico |
| POST `/sessions` | Cria rascunho; retorna 201 |
| GET `/sessions/mine?limit=20&offset=0` | Ofertas próprias, inclusive canceladas; limite 1–100 |
| PATCH `/sessions/{id}` | Edita apenas rascunho próprio e revalida o conjunto |
| POST `/sessions/{id}/publish` | draft → scheduled, somente antes do início |
| DELETE `/sessions/{id}` | scheduled → cancelled, somente antes do início |
| GET `/sessions?subject_id=UUID&topic=limites&starts_after=2030-01-01T00:00:00Z&limit=20&offset=0` | Busca literal por título/descrição, disciplina e início; somente ofertas futuras publicadas de tutores e contas ativos |
| GET `/sessions/{id}` | Detalhe disponível, quantidade de inscritos, vagas e comissão calculada pelo servidor |
| POST `/sessions/{id}/enroll` | Confirma inscrição e recibo na mesma transação; 201 |
| DELETE `/sessions/{id}/enroll` | Cancela inscrição própria antes do início; preserva recibo e libera vaga |
| GET `/bookings/mine?limit=20&offset=0&session_id=UUID` | Histórico próprio com recibos, inclusive cancelamentos; filtro de sessão opcional |

Mutações exigem `Content-Type: application/json`, `X-NexoAula-CSRF: 1` e `Origin`
autorizada (Referer aceito como fallback), **inclusive DELETE sem body**.
Respostas usam `Cache-Control: no-store`. Identidade, status e timestamps não são
aceitos do cliente. Campos desconhecidos são rejeitados.

Exemplo sintético de criação (substituir UUID pela disciplina do catálogo e usar
uma data futura; a turma é opcional):

```json
{
  "subject_id": "00000000-0000-0000-0000-000000000001",
  "title": "Limites e derivadas",
  "description": "Revisão de funções contínuas",
  "modality": "online",
  "external_url": "https://example.test/sessao",
  "starts_at": "2030-10-20T14:00:00-03:00",
  "ends_at": "2030-10-20T15:00:00-03:00",
  "capacity": 5,
  "price_cents": 2500,
  "currency": "BRL"
}
```

## Regras e limites

- Ativação é idempotente e retomada preserva headline/bio omitidos. Perfil suspenso
  não pode se reativar nem trocar suspensão por pausa.
- Criar/editar/publicar exige perfil profissional ativo. Pausar conserva ofertas
  e inscrições; o responsável pausado/suspenso ainda pode cancelar compromissos.
- Cancelar oferta também cancela inscrições confirmadas na mesma transação,
  preservando os recibos demonstrativos completed. Nenhum reembolso é processado.
- Somente rascunho é editável: após publicação, agenda/preço/capacidade não mudam.
  Repetir publicação/cancelamento ou sair de estado terminal retorna 409.
- Datas exigem fuso explícito, término posterior ao início e início futuro.
  Publicação e cancelamento consultam novamente o relógio após adquirir o bloqueio.
- Capacidade é inteiro positivo; preço é inteiro não negativo em centavos BRL,
  ambos limitados ao INTEGER do PostgreSQL. Sessão gratuita é válida.
- Online exige URL HTTP(S), presencial exige local, híbrida exige ambos.
  URLs com credenciais são rejeitadas; o backend não visita o link informado.
- Disciplina precisa existir, e turma opcional deve pertencer a ela. O módulo
  Academic fornece uma interface pública de contexto na mesma transação.
  A oferta registra a declaração tutor/disciplina atomicamente.
- Bloqueios seguem a ordem perfil → oferta para serializar pausa/publicação e
  mudanças concorrentes de estado. As inscrições seguem a mesma ordem.
- Erros: 401 sem sessão/conta ativa; 403 autorização/CSRF/perfil; 404 oferta ausente;
  409 estado/conflito; 422 payload/contexto/agenda; 503 indisponibilidade de banco.

Inscrição bloqueia perfil e oferta na mesma ordem das operações do tutor e revalida
status, relógio, duplicidade e vagas após adquirir o bloqueio. Duas conexões não
podem ocupar a última vaga. O tutor não pode se inscrever na própria oferta.
POST/DELETE de inscrição aceitam body vazio ou `{}`; identidade e valores são do
servidor e campos enviados pelo cliente são rejeitados. Vaga esgotada, duplicidade
ou oferta indisponível retornam 409; inscrição própria ausente retorna 404.

Uma reinscrição cria nova tentativa e novo recibo; o anterior permanece no histórico.
Preço é um snapshot em centavos BRL, com comissão de 15% arredondada para o centavo
mais próximo (meio centavo arredonda para cima). Cálculo inteiro evita diferenças de
ponto flutuante e concorda com o CHECK PostgreSQL. Cancelar não representa reembolso:
o recibo demonstrativo permanece `completed` e `simulated: true`.

Exemplo de resposta de inscrição (identificadores sintéticos, demais timestamps
omitidos nesta amostra; contrato completo no OpenAPI):

```json
{
  "booking_id": "00000000-0000-0000-0000-000000000010",
  "session_id": "00000000-0000-0000-0000-000000000020",
  "status": "confirmed",
  "simulated": true,
  "notice": "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica.",
  "transaction": {
    "id": "00000000-0000-0000-0000-000000000030",
    "amount_cents": 2500,
    "commission_cents": 375,
    "currency": "BRL",
    "status": "completed",
    "simulated": true
  }
}
```

As telas `/tutor`, `/tutor/nova-sessao`, `/sessoes`, `/sessoes/{id}` e
`/sessoes/minhas` usam `marketplace.api.ts` e o cliente HTTP compartilhado:
`/v1/marketplace` → `/api/v1/marketplace` pelo proxy de mesma origem.
`API_BASE_URL` configura a origem do backend no servidor Next.js. Não há persistência
financeira em localStorage/sessionStorage nem botão de sucesso/falha fictício.
Disciplinas usam UUIDs do catálogo. Recarga lê novamente o PostgreSQL; erros de rede
não são apresentados como lista vazia. O detalhe restaura a inscrição do usuário
pelo histórico e o recibo usa os valores recebidos, nunca recalculados pelo frontend.

Conclusão manual/moderação, presença, avaliações, materiais e tópicos estruturados
continuam fora deste recorte. Não há alteração de schema nesta issue.

## Validação

Com PostgreSQL descartável e `DATABASE_URL`, em `Back-end/apps/api`:

```sh
python -m alembic upgrade head
python -m pytest -q tests/integration/marketplace tests/unit/marketplace
python -m pytest -q
python -m alembic check
```

Testes HTTPX/TestClient exercitam PostgreSQL real com rollback por teste, contratos,
CSRF, isolamento de responsável, JWT/conta inativa, modalidades, atualização parcial,
limites, estados e preservação de perfil acadêmico/recibo. A CI executa a integração
no workflow de migrations, além dos testes independentes de banco em Linux/Windows.


O teste `Front-end/tests/e2e/business-flow.spec.ts` cria contas independentes de tutor
e estudantes, publica pela interface, inscreve outro usuário, recarrega detalhe e
histórico, verifica duplicidade/lotação, cancela e reinscreve. Usa API/PostgreSQL
reais, sem interceptar respostas ou simular a persistência.
