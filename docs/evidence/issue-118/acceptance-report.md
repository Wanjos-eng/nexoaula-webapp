# Rascunho de aceitação do MVP de tutoria simulada

Issue: #118
Data: 2026-09-24
Status: rascunho para execução integrada

## Escopo

US21, US23, US24, US27 e US28: perfil de tutor, publicação de sessão, busca,
inscrição, cancelamento, histórico e recibo demonstrativos.

## Casos de teste

| ID | Caso | Resultado esperado | Evidência |
| --- | --- | --- | --- |
| AT-01 | Tutor ativa o perfil e publica uma oferta | Oferta persistida como `scheduled` e visível na vitrine | E2E `business-flow.spec.ts` |
| AT-02 | Estudante busca e abre uma oferta publicada | API retorna sessão, disciplina, tutor e lotação atuais | `GET /api/v1/marketplace/sessions` |
| AT-03 | Estudante se inscreve | Booking confirmado e recibo com snapshot de preço e comissão de 15% | teste backend `test_enrollment.py` |
| AT-04 | Segunda inscrição ativa na mesma sessão | Servidor retorna `409` sem duplicar booking ou transação | teste backend e E2E |
| AT-05 | Sessão lotada | Servidor retorna `409` e não aceita nova inscrição | teste backend `test_capacity_is_decided_by_server` |
| AT-06 | Estudante cancela antes do início | Booking permanece no histórico como `cancelled` e a vaga é liberada | teste backend e UI `/sessoes/minhas` |
| AT-07 | Nova sessão após recarga | Oferta e booking continuam disponíveis pela API, sem Web Storage | E2E integrado |
| AT-08 | Dados financeiros reais | Nenhum campo, credencial ou meio de pagamento real é aceito/exibido | E2E `não expõe credenciais ou campos financeiros reais` |
| AT-09 | Falha da API | UI exibe mensagem retornada pelo servidor e permite nova tentativa | testes unitários do marketplace |

## Verificações automatizadas locais

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado anteriormente.
- `npx vitest run src/__tests__/marketplace-session-flow.test.tsx`: 7 testes aprovados.
- `npx vitest run src/modules/marketplace/marketplace.api.test.ts`: 1 teste aprovado.
- `python -m compileall`: aprovado para o módulo e testes marketplace.
- `git diff --check`: aprovado.

## Execução pendente no ambiente integrado

Executar com PostgreSQL real, dependências Python instaladas e migrações aplicadas:

```powershell
cd Back-end/apps/api
python -m alembic upgrade head
python -m pytest -q tests/integration/marketplace tests/unit/marketplace
python -m alembic check

cd ../../../Front-end
npm run test:e2e -- tests/e2e/business-flow.spec.ts
```

Registrar no relatório final o commit, versões de Node/npm/Python/Docker/
Playwright, `DATABASE_URL`, resultado dos comandos e os artefatos gerados.
