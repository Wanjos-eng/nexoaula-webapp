# Armazenamento e Anexos de Arquivos (Storage Architecture)

Este documento descreve a arquitetura de armazenamento persistente, isolamento de segurança e manipulação de arquivos (avatares e anexos de plano de ensino) implementada no nexoAula (Issue #119, US04 e US07).

---

## 1. Princípios e Estratégia de Persistência

1. **Separação de Metadados e Binários**:
   - Binários de arquivos **nunca** são armazenados diretamente no banco de dados relacional (sem binários `BYTEA` ou `base64` no PostgreSQL).
   - A tabela `files` armazena exclusivamente metadados estruturados: tamanho em bytes, MIME type, propósito (`file_purpose`), proprietário (`owner_id`), nome original do arquivo, chave interna de armazenamento (`storage_key`), checksum SHA-256 e timestamps.

2. **Storage Mínimo Não Efêmero**:
   - O armazenamento de arquivos no ambiente Docker utiliza o volume persistente nomeado `storage_data`, mapeado no contêiner da API em `/app/storage` (configurado via variável de ambiente `STORAGE_PATH`).
   - Não depende de filesystem efêmero do contêiner; dados sobrevivem ao reinício de contêineres e máquinas.
   - A interface de serviço (`app.core.storage.LocalStorageService`) encapsula o sistema de arquivos local de forma extensível, permitindo substituição futura por adaptadores compatíveis com S3/GCS sem impacto na camada de negócio.

3. **Geração Segura de Nomes e Caminhos no Servidor**:
   - Os nomes de caminhos físicos e chaves de armazenamento são estritamente gerados no servidor usando UUIDv4 e partições por propósito (`avatars/{uuid}.ext`, `plans/{uuid}.pdf`).
   - Nomes de arquivos fornecidos pelo cliente (`original_filename`) são sanitizados e guardados apenas para exibição e no cabeçalho `Content-Disposition` no momento do download.
   - Previne ataques de path traversal (`../`) e sobrescritas maliciosas.

---

## 2. Validações e Limites de Conteúdo

1. **Validação de Conteúdo (Magic Bytes)**:
   - Não confia cegamente no cabeçalho `Content-Type` enviado pelo cliente.
   - **Avatares**: Máximo de 5 MB (`5 * 1024 * 1024` bytes). Magic bytes validados contra assinaturas reais de JPEG (`\xFF\xD8\xFF`) e PNG (`\x89PNG\r\n\x1a\n`).
   - **Planos de Ensino**: Máximo de 10 MB (`10 * 1024 * 1024` bytes). Magic bytes validados contra o cabeçalho PDF (`%PDF-`).

2. **Compensação de Falha e Preservação de Arquivos Vigentes**:
   - Durante upload ou substituição, o novo arquivo só é persistido e apontado no banco após gravação física e commit com sucesso.
   - Se ocorrer falha na gravação do storage, o registro no banco não é alterado e o arquivo anterior permanece vigente.
   - Se ocorrer falha no banco de dados após a gravação do arquivo no storage, o novo arquivo físico recém-gravado é removido de forma compensatória, evitando arquivos órfãos.
   - Em caso de substituição ou remoção bem-sucedida, o arquivo antigo tem seu registro excluído e o binário físico no storage é expurgado.

---

## 3. Autorização e Acesso Seguro

1. **Foto de Perfil (Avatar)**:
   - Usuário autenticado só pode enviar, substituir ou remover a sua própria foto de perfil (`/api/v1/academic/profile/avatar` ou `/api/v1/users/me/avatar`).
   - A remoção restaura imediatamente a foto padrão (fallback das iniciais do nome na interface).
   - Visualização pública do avatar via `/api/v1/users/{user_id}/avatar` permite exibição em cards de membros e perfis da comunidade.

2. **Anexo do Plano de Ensino (PDF)**:
   - Apenas organizadores ativos (dono ou moderador com `canManage`) podem anexar, substituir ou remover o arquivo PDF do plano (`/api/v1/groups/{group_id}/plans/{plan_id}/attachment`).
   - Apenas membros ativos do grupo (`is_active_member`) podem fazer o download privado do documento.
   - Usuários não autenticados, não membros, pendentes de aprovação ou que saíram/foram removidos do grupo recebem código HTTP `403 Forbidden` na tentativa de download.
   - Não existem URLs públicas permanentes de anexos de planos de ensino.
   - O aviso obrigatório `"Aviso: Este anexo serve como fonte complementar de consulta. O cronograma manual continua independente."` é renderizado tanto na visualização de membros quanto na de organizadores.

---

## 4. Endpoints da API

| Método | Caminho | Autorização | Propósito |
|---|---|---|---|
| `POST` | `/api/v1/academic/profile/avatar` | Usuário logado | Upload / substituição do avatar (JPEG/PNG até 5 MB) |
| `DELETE` | `/api/v1/academic/profile/avatar` | Usuário logado | Remoção do avatar e retorno ao avatar padrão |
| `GET` | `/api/v1/academic/profile/avatar` | Usuário logado | Download / exibição do próprio avatar |
| `GET` | `/api/v1/users/{user_id}/avatar` | Público / Membros | Download / exibição do avatar de qualquer perfil |
| `POST` | `/api/v1/groups/{group_id}/plans/{plan_id}/attachment` | Dono / Moderador ativo | Upload / substituição do PDF do plano (até 10 MB) |
| `DELETE` | `/api/v1/groups/{group_id}/plans/{plan_id}/attachment` | Dono / Moderador ativo | Remoção do anexo do plano |
| `GET` | `/api/v1/groups/{group_id}/plans/{plan_id}/attachment` | Membro ativo | Download autorizado do anexo PDF com Content-Disposition |
