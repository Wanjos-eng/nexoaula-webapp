# Encontros — regras e verificação da issue #116

## Regras de acesso e transições

- Somente membros ativos consultam encontros; criar, editar e cancelar exige organizador/moderador ativo e grupo ativo.
- Registrar resultado exige que o criador ainda seja organizador/moderador ativo. Remoção, saída ou rebaixamento revogam essa permissão.
- Criação e mudança de início exigem data futura. Horários têm fuso e, quando informado, fim posterior ao início.
- `scheduled` e `postponed` aceitam edição e interesse/confirmação/desistência até o fim (ou início, se não houver fim). `cancelled` e `completed` bloqueiam essas alterações.
- Cancelamento preserva o encontro e as participações. Repetir o cancelamento é idempotente. Um encontro já `completed` não pode ser cancelado.
- `attended` é uma declaração individual de presença, disponível a partir do início em encontro não cancelado, inclusive depois de `completed`. Não modifica o encontro. Repetir a declaração conserva uma única participação por pessoa/encontro.
- Resultado `completed` só é aceito após o fim; adiamento exige novos horários futuros. Cancelamento ou conclusão encerram as transições do encontro.
- O contador representa participações com estado `confirmed`; o estado individual é exibido separadamente.
- Links externos aceitam apenas HTTP(S). Local obrigatório não pode conter somente espaços.
- `channelId` permanece opcional/nulo até a integração com canais: IDs sem vínculo verificável são rejeitados.
- As rotas de encontros aplicam o mesmo controle CSRF e `Cache-Control: no-store` dos módulos autenticados existentes.

## Verificação reproduzível

Usar Python 3.11, Node 22/24 e PostgreSQL migrado. Executar backend e navegador em bancos separados ou sequencialmente: fixtures históricas de usuários limpam tabelas com `TRUNCATE ... CASCADE`.

```sh
# Back-end/apps/api, com DATABASE_URL apontando para um banco exclusivo de testes
python -m alembic upgrade head
python -m pytest -q
python -m alembic check
python -m alembic downgrade -1
python -m alembic upgrade head

# Front-end, com a aplicação e API reais em execução para Playwright
npm run typecheck
npm test -- --maxWorkers=2
npx playwright test tests/e2e/meetings-real.spec.ts --workers=1
```

`tests/integration/community/test_meetings.py` cobre duas pessoas, idempotência, calendário/cancelamento, presença temporal, organizador removido/rebaixado, grupo inativo, entradas inválidas, assuntos e CSRF. O workflow PostgreSQL executa esses testes tanto na atualização inicial quanto após reconstruir o banco.

`meetings.test.tsx` cobre presença após conclusão, bloqueio de presença futura/cancelada e erros de API dentro do diálogo. A jornada Playwright cria, recarrega, confirma duas vezes, edita e cancela pela interface usando duas sessões reais e verifica o calendário.
