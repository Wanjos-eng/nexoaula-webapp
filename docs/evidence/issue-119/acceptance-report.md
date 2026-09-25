# Relatório de Aceitação — Issue #119

**Título**: [FINAL][DB+BE+FE] Implementar foto opcional e anexo do plano com storage  
**Histórias**: US04, US07  
**Branch**: `feat/119-storage-avatar-plan`  
**Data da Verificação**: 25/09/2026 (revisão pós-auditoria: 25/09/2026)  
**Ambiente**: PostgreSQL 17 (Docker), Python 3.11, Node 22 / React 19 / Next.js 15  

---

## 1. Resumo da Entrega

A issue #119 implementou a persistência de arquivos desacoplada do PostgreSQL com volume persistente no Docker (`storage_data`), suporte a foto opcional de perfil de usuário com fallback para inicial e anexo opcional de PDF do plano de ensino com regras estritas de autorização e integridade referencial.

### Principais Entregas por Camada:

1. **Banco de Dados & Migrações**:
   - Migração `0015_files_and_storage` criando a tabela `files` conforme o modelo `nexoaula.dbml`.
   - Adicionada foreign key `fk_user_profiles_avatar_file` em `user_profiles.avatar_file_id` com `ON DELETE SET NULL`.
   - Removida a restrição provisória `chk_teaching_plans_manual_source` de `teaching_plans`.
   - Adicionada foreign key `fk_teaching_plans_source_file` em `teaching_plans.source_file_id` com `ON DELETE SET NULL`.
   - Restrição de integridade `chk_files_positive_size` (`size_bytes > 0`), unicidade em `storage_key` e índices em `owner_id` e `purpose`.
   - `alembic check` executado com sucesso ("No new upgrade operations detected").
   - `alembic downgrade -1` seguido de `alembic upgrade head` aprovado sem perda de integridade.
   - **[pós-auditoria]** `nexoaula.dbml` corrigido: `storage_provider default 'local'` (alinhado com migração e ORM).

2. **Storage e Backend**:
   - Volume persistente `storage_data` configurado no `compose.yml` mapeado em `/app/storage`.
   - `LocalStorageService` com geração segura de chaves no servidor (`avatars/{uuid}.ext`, `plans/{uuid}.pdf`), evitando path traversal.
   - Validação por magic bytes (JPEG `\xFF\xD8\xFF`, PNG `\x89PNG\r\n\x1a\n` e PDF `%PDF-`).
   - Limites de tamanho enforced no servidor: fotos até 5 MB; PDFs até 10 MB.
   - Compensação de falhas: remoção de arquivo órfão no storage em caso de erro no banco; preservação do arquivo vigente em caso de falha de upload.
   - Endpoints de avatar para o usuário autenticado (`POST /api/v1/academic/profile/avatar`, `DELETE /api/v1/academic/profile/avatar`, `GET /api/v1/academic/profile/avatar`, `GET /api/v1/users/{userId}/avatar`).
   - Endpoints de anexo para planos de ensino (`POST /api/v1/groups/{groupId}/plans/{planId}/attachment`, `DELETE /api/v1/groups/{groupId}/plans/{planId}/attachment`, `GET /api/v1/groups/{groupId}/plans/{planId}/attachment`).
   - Revalidação contínua de participação: apenas membros ativos realizam download do PDF do plano (não membros, pendentes e usuários com status `left` ou `removed` recebem `403 Forbidden`).
   - **[pós-auditoria]** `ADR-0005-storage-local-volume.md` criado em `docs/decisions/`.

3. **Frontend**:
   - `apiClient`: suporte transparente a `FormData` para uploads multipart sem quebrar requisições JSON nem sobrescrever `Content-Type`, preservando headers de segurança e CSRF (`X-NexoAula-CSRF: 1`).
   - `AcademicProfile`: visualização de foto de perfil com fallback para inicial; upload, troca e remoção de foto com validação visual e preservação do estado anterior em caso de erro.
   - `GroupSchedule`: card de anexo oficial em PDF exibindo nome do arquivo, tamanho formatado e o aviso obrigatório: *"Aviso: Este anexo serve como fonte complementar de consulta. O cronograma manual continua independente."*; botão de download para membros ativos; controles de anexo, substituição e remoção para organizadores com `canManage`.
   - **[pós-auditoria]** Mensagens de erro client-side alinhadas com o backend: `"O tamanho da foto excede o limite de 5 MB."`, `"Formato de arquivo inválido. O plano exige um arquivo PDF."` e `"O anexo excede o limite permitido de 10 MB."`.

---

## 2. Evidências de Teste e Aceite

### Backend (Python + PostgreSQL Real)
- **Migrações e Constraints**:
  - `tests/test_files_migration.py`: 9 testes passando (tabela `files`, constraints, foreign keys, cascade/restrict, unicidade).
  - `tests/test_teaching_plan_migration.py`: 12 testes passando.
  - `tests/test_identity_migration.py`: 5 testes passando.
  - `tests/test_migration_scaffold.py`: 1 teste passando (cadeia linear de migrações 0001 a 0015).
- **Serviços e Rotas HTTP**:
  - `tests/integration/academic/test_avatar.py`: 2 testes passando (ciclo de vida completo: upload PNG, download, substituição por JPEG, remoção com 404 subsequente, validação de magic bytes e rejeição de > 5 MB).
  - `tests/integration/community/test_plan_attachments.py`: 4 testes passando (anexo por organizador, download por membro ativo, revalidação com 403 para não membro, left e removed, substituição, remoção e validação de magic bytes PDF).
- **Suíte Completa**:
  - `python -m pytest`: 425 testes passando em 136s.

### Frontend (Vitest + TypeScript)
- **Testes Unitários e de Integração**:
  - `src/lib/api/client.test.ts`: 25 testes passando (incluindo tratamento de `FormData` e CSRF).
  - `src/modules/groups/storage-attachments.test.tsx`: **4 testes passando** (avatar com fallback e upload/remoção, rejeição > 5 MB, anexo de PDF com aviso complementar, substituição e remoção, e rejeição > 10 MB) — verificado em 25/09/2026 após alinhamento de mensagens.
  - `npm test`: 25 suites de teste passando, 182 testes no total.
  - `npm run typecheck`: TypeScript aprovado com 0 erros (verificado em 25/09/2026).
  - `npm run lint`: arquivos alterados/criados sem erros de lint.

### Ambiente Docker (25/09/2026)
- `docker compose up -d`: todos os 3 containers em estado **healthy** (db, api, web).
- Volume `storage_data` ativo e mapeado em `/app/storage` no container da API.

---

## 3. Critérios de Aceite Verificados

| Critério de Aceite | Status | Evidência |
|---|---|---|
| Foto e PDF sobrevivem ao reinício do ambiente (storage não efêmero) | APROVADO | Volume `storage_data` montado em `/app/storage` no `compose.yml`; containers healthy em 25/09/2026 |
| Usuário só altera própria foto | APROVADO | Rota vinculada ao `current_user` autenticado; testado em `test_avatar.py` |
| Organizador só altera anexo do grupo autorizado | APROVADO | Verificação de `can_manage_group`; membros comuns recebem `403` em `test_plan_attachments.py` |
| Remover foto restaura avatar padrão | APROVADO | DELETE zera `avatar_file_id` e frontend exibe inicial de fallback |
| Falha de upload não apaga foto/plano anterior | APROVADO | Transações atômicas e compensação física no storage; testado no front e back |
| Não membro/pendente/removido não baixa plano pelo ID | APROVADO | Revalidação dinâmica no download; `test_download_revalidates_membership` |
| Arquivo inválido/tamanho excedido recebe erro claro | APROVADO | Magic bytes e checagem de tamanho geram erro 422 descritivo; mensagens alinhadas entre frontend e backend |
