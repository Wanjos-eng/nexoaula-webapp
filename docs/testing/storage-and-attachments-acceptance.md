# Foto de Perfil e Anexo de Plano de Ensino com Storage — Regras e Verificação da Issue #119

## Regras de Acesso, Persistência e Segurança

- **Armazenamento e Separação**:
  - Binários de imagem e PDF **nunca** residem no banco de dados PostgreSQL (sem `BYTEA` ou `base64`).
  - Metadados, relacionamentos e chaves de armazenamento residem na tabela `files` com integridade referencial (`ON DELETE SET NULL` em `user_profiles.avatar_file_id` e `teaching_plans.source_file_id`).
  - O volume nomeado persistente `storage_data` garante persistência física entre reinícios de contêineres e deploy em `/app/storage`.
  - Nomes de arquivo no disco são chaves geradas pelo servidor (UUIDv4 particionado por propósito); nomes originais de arquivo são sanitizados.

- **Avatar do Usuário (US04)**:
  - O usuário autenticado altera exclusivamente a sua própria foto de perfil (`/api/v1/academic/profile/avatar` ou `/api/v1/users/me/avatar`).
  - Formatos aceitos: JPEG e PNG, validados por assinatura de bytes (magic bytes). Limite máximo de 5 MB.
  - Remover a foto restaura o avatar padrão (fallback de inicial na interface).
  - Falha durante o upload preserva intacta a foto anterior vigente.

- **Anexo do Plano de Ensino (US07)**:
  - Somente organizadores/moderadores ativos (`canManage`) podem anexar, substituir ou remover o arquivo PDF do plano (`/api/v1/groups/{groupId}/plans/{planId}/attachment`).
  - Formato aceito: PDF validado por magic bytes `%PDF-`. Limite máximo de 10 MB.
  - Download privado autorizado exclusivamente para membros ativos do grupo. Não-membros, solicitações pendentes e membros que saíram ou foram removidos recebem `403 Forbidden`.
  - Não expõe URLs públicas ou permanentes de anexos do plano de ensino.
  - Aviso obrigatório e visível na interface: `"Aviso: Este anexo serve como fonte complementar de consulta. O cronograma manual continua independente."`

## Verificação Reproduzível

### 1. Migrações e Banco de Dados (PostgreSQL Real)
```sh
cd Back-end/apps/api
python -m alembic check
python -m pytest tests/test_files_migration.py tests/test_teaching_plan_migration.py tests/test_identity_migration.py tests/test_migration_scaffold.py -v
python -m alembic downgrade -1
python -m alembic upgrade head
```

### 2. Suíte Backend
```sh
cd Back-end/apps/api
python -m pytest tests/integration/academic/test_avatar.py tests/integration/community/test_plan_attachments.py -v
python -m pytest
```

### 3. Frontend
```sh
cd Front-end
npm run typecheck
npm test src/lib/api/client.test.ts src/modules/groups/storage-attachments.test.tsx
npm test
```
