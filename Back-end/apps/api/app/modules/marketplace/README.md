# Tutoria simulada — perfil e ofertas (#39)

Implementa US21/US23 sobre a migration #38 e a ADR-0004. O núcleo acadêmico
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
  mudanças concorrentes de estado. As inscrições da #40 devem seguir a mesma ordem.
- Erros: 401 sem sessão/conta ativa; 403 autorização/CSRF/perfil; 404 oferta ausente;
  409 estado/conflito; 422 payload/contexto/agenda; 503 indisponibilidade de banco.

Busca, inscrição, lotação concorrente e recibos de inscrição são a #40. Conclusão
manual/moderação, presença, avaliações, materiais e tópicos estruturados continuam
fora deste recorte. Não há alteração do schema nesta issue.

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
