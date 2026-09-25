# ADR-0005: Storage de Arquivos com Volume Persistente Docker e Abstração de Provider

**Status**: Aceito  
**Data**: 2026-09-27  
**Histórias**: US04, US07  
**Issue**: [#119](https://github.com/Wanjos-eng/nexoaula-webapp/issues/119)

---

## Contexto

A issue #119 requer persistência de fotos de perfil (avatar) e de PDFs de plano de ensino. O PostgreSQL é a única fonte de persistência atual, mas armazenar binários nele viola princípios de separação de responsabilidades, impacta performance e dificulta migração futura para object storage.

Restrições do ambiente:
- Deploy atual: Docker Compose (monorepo + containers locais).
- Sem conta de object storage (S3, GCS) disponível nesta sprint.
- Binário **nunca** deve residir no PostgreSQL (sem `BYTEA` ou `base64`).
- Arquivos devem sobreviver a reinícios de containers.

---

## Decisão

### 1. Armazenamento em dois níveis

| Nível | O que armazena | Onde |
|-------|---------------|------|
| **PostgreSQL** | Metadados do arquivo: `id`, `owner_id`, `purpose`, `storage_provider`, `storage_key`, `original_filename`, `mime_type`, `size_bytes`, `checksum_sha256`, `created_at`, `deleted_at` | Tabela `files` (migração `0015_files_and_storage`) |
| **Filesystem** | Bytes do arquivo | Volume Docker nomeado `storage_data` montado em `/app/storage` |

### 2. Volume persistente Docker

```yaml
# compose.yml
volumes:
  storage_data:
services:
  api:
    volumes:
      - storage_data:/app/storage
    environment:
      STORAGE_PATH: /app/storage
```

O volume **nomeado** garante persistência entre `docker compose down` + `docker compose up`, ao contrário de mounts anônimos ou tmpfs.

### 3. Abstração `StorageService` (Protocol)

`app/core/storage.py` define o Protocol `StorageService` com operações `save`, `read`, `delete`, `exists`, `get_path`. A implementação padrão é `LocalStorageService` (filesystem local), configurada via `settings.STORAGE_PATH`.

O campo `files.storage_provider = 'local'` identifica o provider atual. Uma futura migração para S3/GCS exige apenas:
1. Implementar `S3StorageService` seguindo o mesmo Protocol.
2. Alterar o provider nas novas escritas (sem reescrever registros antigos).
3. Migrar arquivos existentes de forma assíncrona.

### 4. Chaves de storage geradas no servidor

Formato: `{purpose}/{uuid4().hex}{ext}` — ex.: `avatars/a1b2c3d4.jpg`, `plans/e5f6g7h8.pdf`.

- Nomes originais são sanitizados e armazenados em `original_filename` apenas como metadado.
- Path traversal é prevenido por `_resolve_safe_path` que valida que o caminho resolvido é filho de `base_path`.

### 5. Validação por magic bytes (servidor)

| Tipo | Magic bytes | Limite |
|------|------------|--------|
| JPEG | `\xFF\xD8\xFF` | 5 MB (`MAX_AVATAR_SIZE_BYTES`) |
| PNG | `\x89PNG\r\n\x1a\n` | 5 MB |
| PDF | `%PDF-` | 10 MB (`MAX_PLAN_ATTACHMENT_SIZE_BYTES`) |

A validação client-side é um atalho de UX, não uma garantia de segurança.

### 6. Compensação de falha (atomicidade storage ↔ DB)

```
1. Salvar bytes no storage (key gerada)
2. BEGIN transaction:
   a. INSERT INTO files (metadados)
   b. UPDATE user_profiles SET avatar_file_id = novo_id  (ou teaching_plans.source_file_id)
3. COMMIT
   → em caso de erro: DELETE storage[key]  (compensação física)
4. Se havia arquivo anterior: DELETE storage[old_key] após COMMIT bem-sucedido
```

Isso garante que uma falha de DB não deixa arquivo órfão no storage, e uma falha de storage não corrompre o DB.

### 7. Integridade referencial

- `user_profiles.avatar_file_id → files.id ON DELETE SET NULL`
- `teaching_plans.source_file_id → files.id ON DELETE SET NULL`
- `files.owner_id → users.id ON DELETE RESTRICT` (impede exclusão de usuário com arquivos)

---

## Alternativas Consideradas

| Alternativa | Motivo da rejeição |
|-------------|-------------------|
| Armazenar binário em PostgreSQL (`BYTEA`) | Viola requisito explícito da issue; degrada performance; dificulta migração |
| URLs assinadas direto para S3 | Sem credenciais de cloud nesta sprint; adiciona dependência externa |
| Filesystem efêmero no container | Arquivos perdidos a cada `docker compose down`; rejeito pelos critérios de aceite |
| Base64 em coluna `TEXT` | Pior que `BYTEA`; aumenta tamanho em ~33%; ainda viola o requisito de "sem binário no PG" |

---

## Consequências

**Positivas:**
- Binário isolado do DB; backup de storage é independente.
- Abstração permite troca de provider sem reescrever serviços.
- Volumes Docker persistem dados entre reinícios.

**Negativas / Riscos:**
- Storage local não é replicado; em caso de falha de disco, arquivos são perdidos (mitigação futura: S3/GCS).
- Sem CDN; entrega de imagens passa pelo servidor da API.
- Para produção real, `storage_data` deve ser substituído por object storage e a lógica de URL de avatar deve ser atualizada.

---

## Verificação

```sh
# Confirmar que storage sobrevive a reinício
docker compose restart api
# Acessar avatar previamente carregado → deve retornar 200
curl -b cookies.txt http://localhost:8000/api/v1/academic/profile/avatar
```

Critério formal: `test_avatar_lifecycle_upload_replace_delete` e `test_organizer_attaches_and_downloads_plan_pdf` em ambiente com `DATABASE_URL` real.
