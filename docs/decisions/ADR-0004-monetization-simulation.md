# ADR-0004: Recorte da monetização simulada — Sessões de Tutoria

- **Status:** Aceita
- **Data:** 2026-09-12
- **Issue:** [#37 — Definir recorte da monetização simulada](https://github.com/Wanjos-eng/nexoaula-webapp/issues/37)
- **Desbloqueadas:** [#38](https://github.com/Wanjos-eng/nexoaula-webapp/issues/38) · [#39](https://github.com/Wanjos-eng/nexoaula-webapp/issues/39) · [#40](https://github.com/Wanjos-eng/nexoaula-webapp/issues/40) · [#41](https://github.com/Wanjos-eng/nexoaula-webapp/issues/41)

## Contexto

A disciplina exige um incremento coerente com uma hipótese de monetização demonstrável no navegador. A decisão registrada na [#11](https://github.com/Wanjos-eng/nexoaula-webapp/issues/11) estabelece que:

- O **núcleo acadêmico é gratuito e não será bloqueado** por nenhuma lógica de planos ou limites premium.
- A monetização futura está vinculada à **atuação profissional de tutores** (sessões, materiais, credenciamento).
- **Nenhum pagamento, dado bancário, cartão ou chave Pix real** pode ser usado ou coletado.

O documento de hipótese de negócio produzido pela equipe identificou corretamente o modelo de tutor como fonte de receita, mas não desceu ao nível técnico necessário para implementação. Esta decisão define o recorte executável.

## Decisão: recorte mínimo vertical — Sessão de Tutoria Simulada

O único fluxo de negócio a ser implementado nesta Sprint é a **jornada de sessão de tutoria simulada**, composta por:

1. Qualquer usuário autenticado pode **ativar seu perfil profissional** (US21).
2. O tutor cria, edita e publica uma **oferta de sessão** contextualizada por disciplina (US23).
3. O estudante autenticado busca sessões publicadas e **simula a inscrição** (US24 / US27).
4. O sistema gera um **recibo demonstrativo** com valor, comissão e aviso explícito de que não há pagamento real (US28).

### Por que este recorte e não outro

| Alternativa descartada | Motivo |
|---|---|
| Materiais autorais (PDFs, cadernos) | Requer `files` e lógica de upload não implementados; escopo da #22/#26 — roadmap |
| Assinatura de comunidade privada | Contradiz a regra da #11 de núcleo acadêmico gratuito sem bloqueio artificial de grupos |
| Credenciamento real de tutor | Processo burocrático fora do prazo acadêmico de 7 semanas |
| Publicidade contextual | Sem tabelas físicas previstas para esta sprint |

## Modelo de dados do recorte

O modelo lógico completo já está definido no [DBML oficial](../diagrams/nexoaula.dbml). Esta decisão **não altera o DBML**; apenas declara quais tabelas o recorte da Sprint utiliza e quais permanecem no roadmap.

### Tabelas a migrar na #38

```
tutor_profiles          — ativação opcional de papel profissional
tutor_subjects          — disciplinas declaradas pelo tutor
tutor_sessions          — oferta de sessão com agenda, capacidade e preço demonstrativo
session_topics          — tópicos de conteúdo da sessão (opcional, adicionar se viável)
session_bookings        — inscrição simulada, uma linha por tentativa
transactions            — registro demonstrativo do valor e comissão
```

### Tabelas que **não** entram no recorte

```
tutor_credentials       — credenciamento formal (roadmap)
tutor_subject_topics    — especialização em tópicos (roadmap)
materials               — materiais autorais com arquivo (roadmap)
material_topics         — tópicos de materiais (roadmap)
reviews                 — avaliações (depende de attended, sprint posterior)
```

### Campos-chave e regras de integridade

**`tutor_profiles`**
- `user_id` FK → `users.id` (PK, sem duplicidade)
- `status`: `active | paused | suspended` — padrão `active` na ativação
- Ativação não exige credenciamento. A flag `tutor_profiles` existir é suficiente para o recorte simulado.

**`tutor_sessions`**
- `price_cents INTEGER NOT NULL` — valor em centavos BRL, `>= 0`; exibido como demonstrativo
- `currency CHAR(3) NOT NULL DEFAULT 'BRL'`
- `status`: `draft → scheduled → completed | cancelled`
- `capacity INTEGER NOT NULL, CHECK capacity > 0`
- `modality`: `online | in_person | hybrid` — com CHECK de campos obrigatórios por modalidade
- `ends_at > starts_at` garantido por CHECK
- Somente `status = 'scheduled'` aceita inscrições. Transição de `scheduled → completed` é responsabilidade de rotina futura; no recorte atual pode ser feita manualmente ou por endpoint de moderação.

**`session_bookings`**
- `status`: `reserved → confirmed → attended | cancelled | no_show`
- No recorte simulado: inscrição inicia em `confirmed` imediatamente (sem etapa de aprovação manual).
- Cancelamento antes do início: `status = 'cancelled'`, `cancelled_at = now()`.
- Índice de expressão `uq_session_bookings_non_cancelled` impede inscrição duplicada ativa: a validação de capacidade e duplicidade DEVE usar `SELECT ... FOR UPDATE` ou serialização de transação.

**`transactions`**
- Gerada automaticamente junto com `session_bookings` no momento da inscrição simulada.
- `status = 'completed'` imediatamente — sem gateway de pagamento.
- `amount_cents = tutor_sessions.price_cents` (snapshot histórico).
- `commission_cents = ROUND(amount_cents * 0.15)` — take rate fixo de **15%** da plataforma.
- **Nenhum campo bancário, PIX, CPF, cartão ou conta é armazenado.**
- A resposta da API deve conter campo `simulated: true` e texto `"Nenhum pagamento foi processado."`.

## Regras de negócio e estados

### Estados da oferta (`tutor_session_status`)

```
draft ──► scheduled ──► completed
                └──► cancelled
```

- Somente o próprio tutor pode alterar o estado da sua sessão.
- Uma sessão `cancelled` não aceita novas inscrições.
- Uma sessão `completed` encerra o fluxo; inscrições existentes ficam em `confirmed`.

### Estados da inscrição (`session_booking_status`)

```
reserved ──► confirmed ──► attended   (tutor registra presença)
         │              └──► no_show
         └──► cancelled               (aluno cancela antes do início)
```

- No recorte simulado, `reserved` é transitório e imediato: inscrição passa direto para `confirmed`.
- Reinserção permitida se a sessão ainda estiver `scheduled` e houver vaga (nova linha, preservando o cancelamento anterior).

### Cálculo de comissão demonstrativo

| Campo | Valor |
|---|---|
| `amount_cents` | Snapshot do `price_cents` da sessão no momento da inscrição |
| `commission_cents` | `ROUND(amount_cents * 0.15)` |
| Taxa | **15% fixo** para o recorte acadêmico |
| Líquido do tutor (exibição) | `amount_cents - commission_cents` |

O cálculo é puramente demonstrativo. Nenhum repasse financeiro ocorre.

## Contratos de API (guia para #39 e #40)

### Módulo: `marketplace` — localização `Back-end/apps/api/app/modules/marketplace/`

#### #39 — Perfil profissional e oferta de sessão

```
POST   /api/v1/marketplace/tutor/activate          → ativa tutor_profiles para o usuário autenticado
DELETE /api/v1/marketplace/tutor/deactivate         → pausa (status=paused) sem remover conta

POST   /api/v1/marketplace/sessions                 → cria sessão (status=draft)
GET    /api/v1/marketplace/sessions/mine            → lista sessões do tutor autenticado
PATCH  /api/v1/marketplace/sessions/{id}            → edita rascunho
POST   /api/v1/marketplace/sessions/{id}/publish    → draft → scheduled
DELETE /api/v1/marketplace/sessions/{id}            → scheduled → cancelled
```

#### #40 — Busca e inscrição simulada

```
GET    /api/v1/marketplace/sessions                 → lista sessões scheduled (filtro: subject_id, starts_after)
GET    /api/v1/marketplace/sessions/{id}            → detalhe público da sessão
POST   /api/v1/marketplace/sessions/{id}/enroll     → cria session_booking + transaction simulada
DELETE /api/v1/marketplace/sessions/{id}/enroll     → cancela inscrição ativa (cancelled_at = now())
GET    /api/v1/marketplace/bookings/mine            → histórico de inscrições do aluno autenticado
```

#### Schema de resposta da inscrição simulada

```json
{
  "booking_id": "uuid",
  "session_id": "uuid",
  "status": "confirmed",
  "simulated": true,
  "notice": "Nenhum pagamento foi processado. Esta é uma demonstração acadêmica.",
  "transaction": {
    "id": "uuid",
    "amount_cents": 2500,
    "commission_cents": 375,
    "currency": "BRL",
    "status": "completed",
    "simulated": true
  }
}
```

## Contrato para o Frontend (#41)

### O que o FE deve implementar

1. **Vitrine de Sessões** (`/sessoes`) — lista sessões `scheduled`, com filtro por disciplina.
2. **Detalhe da Sessão** (`/sessoes/[id]`) — informações completas + botão "Simular Inscrição".
3. **Fluxo de Inscrição Simulada** — modal ou página com:
   - Resumo da sessão e valor demonstrativo
   - Cálculo de comissão (15%) visível
   - Aviso explícito e proeminente: *"Esta é uma simulação acadêmica. Nenhum pagamento real será cobrado."*
   - Botão de confirmação
4. **Recibo Pós-Inscrição** — exibe `transaction.amount_cents`, `commission_cents` e `notice`.
5. **Painel do Tutor** — permite ativar perfil, criar e publicar sessões.
6. **Minhas Inscrições** (`/sessoes/minhas`) — histórico de bookings do estudante.

### O que o FE **não deve** implementar

- Formulário com campo de chave Pix, CPF, cartão ou conta bancária de qualquer tipo.
- Upload de arquivos PDF ou materiais.
- Sistema de avaliação por estrelas.
- Qualquer aparência que indique ao usuário que um pagamento real está sendo ou foi realizado.

### Localização no repositório

```
Front-end/src/app/(app)/sessoes/           — rotas públicas de busca
Front-end/src/app/(app)/sessoes/[id]/      — detalhe e inscrição
Front-end/src/app/(app)/tutor/             — painel do tutor
Front-end/src/modules/marketplace/        — componentes e lógica
Front-end/src/lib/marketplace.service.ts  — client HTTP do módulo
```

## Fora do escopo desta decisão

- `materials`, `material_topics` — roadmap
- `tutor_credentials`, `tutor_subject_topics` — roadmap
- `reviews` — sprint posterior, dependente de `status = 'attended'`
- Publicidade, credenciamento externo, planos institucionais

## Impacto nas issues dependentes

| Issue | Ação |
|---|---|
| [#38 — DB migration](https://github.com/Wanjos-eng/nexoaula-webapp/issues/38) | Migrar `tutor_profiles`, `tutor_subjects`, `tutor_sessions`, `session_bookings`, `transactions`; deixar `materials`, `reviews` e `tutor_credentials` no roadmap |
| [#39 — BE perfil e oferta](https://github.com/Wanjos-eng/nexoaula-webapp/issues/39) | Implementar endpoints de ativação de tutor e CRUD de sessão conforme contratos acima |
| [#40 — BE busca e inscrição](https://github.com/Wanjos-eng/nexoaula-webapp/issues/40) | Implementar busca paginada e fluxo de `enroll` com transação simulada e comissão de 15% |
| [#41 — FE jornada de sessão](https://github.com/Wanjos-eng/nexoaula-webapp/issues/41) | Implementar vitrine, detalhe, inscrição simulada e painel do tutor conforme seção "Contrato para o Frontend" |

## Consequências

### Benefícios

- Fluxo vertical demonstrável ponta a ponta sem dado financeiro real.
- Alinhado ao DBML oficial já revisado e aprovado.
- Desbloqueia #38, #39, #40 e #41 com contratos explícitos.
- Recorte cabe em uma Sprint e pode ser apresentado no Demo Day.

### Custos e limitações aceitas

- `tutor_session_status` não possui transição automática para `completed`; o tutor ou a equipe precisa atualizar manualmente para o recorte acadêmico.
- Não há sistema de avaliação neste recorte; `reviews` fica para sprint posterior.
- A comissão de 15% é fixa e definida no backend; nenhuma interface de configuração é exposta.

## Referências

- [DBML oficial](../diagrams/nexoaula.dbml) — tabelas `tutor_profiles`, `tutor_sessions`, `session_bookings`, `transactions`
- [data-model.md](../architecture/data-model.md) — seções "Avaliação do tutor e reinscrição" e "Arquitetura e recortes"
- [Issue #11](https://github.com/Wanjos-eng/nexoaula-webapp/issues/11) — decisão de monetização vigente
- [ADR-0002](./ADR-0002-authentication.md) — autenticação JWT que protege os endpoints do marketplace
- [ADR-0003](./ADR-0003-persistence.md) — SQLAlchemy + Alembic para as migrations do #38
