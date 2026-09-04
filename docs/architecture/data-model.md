# Modelagem de dados do nexoAula — revisão orientada ao grupo

Status: revisão do modelo aceita por Wanjos-eng em 04/09/2026, após revisão conjunta com o assistente. Por decisão expressa do proprietário, essa validação substitui o critério de revisão por outro integrante da #7. Não é autorização para executar migrations de todos os módulos.

- [Modelo oficial no Notion](https://app.notion.com/p/3c9bb0fde01f806db3f3f09dc5a2d944).
- [DBML revisado](../diagrams/nexoaula.dbml).
- [Issue #7 — revisão do modelo](https://github.com/Wanjos-eng/nexoaula-webapp/issues/7).
- [Issue #12 — versionamento documental](https://github.com/Wanjos-eng/nexoaula-webapp/issues/12).

O [PR #80](https://github.com/Wanjos-eng/nexoaula-webapp/pull/80) foi reaberto para conciliar a contribuição original com o modelo revisado no Notion. Este ajuste é documental: não altera o banco da aplicação nem escolhe ORM, autenticação ou storage.

## Regra central confirmada pelo proprietário

O **grupo possui seu próprio PD/plano de ensino, conteúdo, aulas e correções**. Dois grupos da mesma turma mantêm planos e correções independentes. O aluno não acompanha turmas ou planos de forma avulsa: precisa participar ativamente do grupo para acessar o PD e os dados originados nele.

A presença/falta é **individual e privada, ligada ao aluno e à aula**, não diretamente ao grupo e não compartilhada entre participantes. O grupo é obtido pela aula e determina a autorização de acesso. Não existe PD pessoal separado.

- `teaching_plans.group_id` define a origem do plano e a unicidade de versão/publicação é por grupo.
- `scheduled_lessons` e `lesson_occurrences` usam o mesmo group_id sob FKs compostas, sem cruzamento entre grupos, mesmo da mesma turma.
- `student_lesson_attendance` continua com chave aluno + ocorrência. Não recebe group_id.
- `student_topic_progress`, já previsto no modelo, referencia o conteúdo disponibilizado pelo grupo (`group_topics.id`), não uma turma ou tópico global avulso. É registro individual; não adiciona um novo painel de PD pessoal.
- `user_class_sections` foi removida do modelo lógico porque representava acompanhamento de turma sem grupo. Nenhuma tabela ou dado real foi apagado.

## Aula realizada, presença e correções

PREVISTO é o plano e suas aulas planejadas. REALIZADO registra o resultado da aula. O registro individual do aluno não modifica nenhuma dessas camadas.

- Apenas uma ocorrência `held`, efetivamente encerrada e já passada, permite presença/falta.
- Aula prevista/futura/em andamento, cancelada ou adiada não recebe presença. Uma linha `cancelled/postponed` documenta o cancelamento/adiamento; não declara que houve aula.
- `held` exige início e fim reais, com fim não posterior a `created_at`. Esse timestamp deve ser gerado pelo servidor; não aceitar um valor futuro fornecido pelo cliente. O backend também verifica o relógio atual.
- A FK com discriminador `occurrence_status = held` impede presença em uma ocorrência cancelada/adiada.
- Correção cria uma ocorrência sucessora. A antiga nunca conta nos totais atuais se houver sucessora, mesmo que continue marcada como held no histórico.
- Se a sucessora continua sendo uma aula efetivamente realizada e passada, copiar automaticamente o registro individual, preservando a origem. Não sobrescrever um lançamento que o aluno já tenha feito no destino.
- Se a sucessora cancela/adia a aula, o registro antigo fica somente no histórico; não criar presença na aula cancelada nem antecipar presença na nova data.
- `student_attendance_adjustments` guarda snapshot anterior, origem/destino, resultado e aviso individual ainda não visto. Resultado `invalidated` não equivale a presença válida. O fluxo é transacional e idempotente; não há envio de e-mail ou serviço de notificações implementado nesta revisão.

As tabelas continuam em **45**: saiu `user_class_sections` e entrou o histórico/aviso individual `student_attendance_adjustments`.

## Avaliação do tutor e reinscrição

- Avaliação de tutoria exige participação: reserva `attended`, com data e registrador correspondente ao tutor responsável. Compra ou inscrição, por si sós, não bastam.
- `reviews` referencia a participação sob FK de status attended e corresponde à reserva da transação por FK composta. Uma avaliação por participação evita duplicá-la através de diferentes tentativas de transação.
- Autor e tutor avaliado continuam derivados da transação/reserva; o cliente não escolhe uma identidade arbitrária.
- Avaliação de material continua separada da participação em tutoria, sob o alvo material da transação. Não pode ser usada para contornar a regra de participação.
- O backend ainda valida encontro concluído/passado, comprador autenticado e transação simulada completed. A FK do registrador não substitui autorização do tutor no endpoint.
- Após cancelar antes do início, o aluno pode se inscrever novamente se houver vaga. Cada tentativa usa nova linha, preservando o cancelamento. Índice por expressão impede duas inscrições não canceladas simultâneas.
- Reembolso real, pagamento real e suas políticas não foram implementados nem aprovados por este ajuste.

## Integridade e limites de responsabilidade

Garantias presentes no SQL exportado:

- Contexto institucional e disciplina/turma por FKs compostas; contexto de planos/aulas por grupo.
- Conteúdo de `group_topics` pertencente à disciplina do grupo; progresso aponta a um conteúdo existente naquele contexto.
- Resposta a outra mensagem do mesmo canal, sem autorresposta; encontro aponta somente para canal do próprio grupo.
- Unicidade por expressão CASE: plano publicado por grupo, no máximo um owner ativo, solicitação pending por aluno/grupo, inscrição não cancelada por aluno/encontro e transação completed por reserva.
- FKs simples SET NULL e compostas NO ACTION preservam vínculos opcionais de respostas/encontros sem anular o canal/grupo obrigatório. Exclusões foram testadas apenas em banco descartável.
- `class_section_teachers.starts_on` obrigatório e `ends_on` opcional.

Obrigações do backend/migrations, **não garantidas apenas pelo DBML**:

1. Toda leitura/escrita/download do PD exige membro ativo do grupo de origem, inclusive importação, aulas, tópicos e correções. A busca pública de grupos não deve expor o PD. Ter conhecido um UUID não concede acesso.
2. Presença, progresso, snapshots e avisos só são acessíveis ao próprio aluno. Não há acesso avulso a eles após sair do grupo; retenção/anonimização continua uma política a definir. FK comprova existência, não autorização.
3. Consultar apenas ocorrências vigentes e realizadas nos totais atuais; recusar escrita em aula futura, cancelada, adiada ou superada. Relógio e timestamps de auditoria vêm do servidor.
4. Correção e transferência verificam ancestralidade e mesmo grupo, geram snapshots no servidor, preservam histórico, não duplicam avisos e não sobrescrevem registro do aluno. Processar cadeia de correções com bloqueio/serialização adequada.
5. Impedir ciclos de planos/ocorrências/respostas, exigir versão-base menor e preservar conteúdo publicado. CHECK de autorreferência impede A→A, não A→B→A. Identidade/canal/alvo das respostas são imutáveis.
6. Um grupo precisa ter pelo menos um owner ativo. O índice impede dois, mas não impede zero. Criação/transferência são transacionais.
7. Validar conteúdos de aulas/canais/encontros/materiais/sessões contra a disciplina pai; especialidade do tutor exige tutor_subjects correspondente.
8. Validar capacidade e início em transação para inscrições, autorização da presença do tutor e elegibilidade das avaliações. Proteger alvos e snapshots de transações contra alteração retroativa.
9. Atualizar updated_at explicitamente e validar e-mail, URL, timezone IANA, MIME e permissões dos arquivos.

Esses controles devem usar as interfaces públicas dos módulos; FKs entre módulos não autorizam acesso direto a repositories internos. Notas DBML são contrato/documentação, não triggers nem políticas RLS implantadas.

## Arquitetura e recortes

Monorepo: Next.js em `Front-end/`, FastAPI modular/em camadas em `Back-end/apps/api/`, PostgreSQL. Módulos lógicos não significam microsserviços.

| Classificação | Recorte |
| --- | --- |
| CORE | Identity, Media, catálogo Academic, planos/aulas por grupo, registros individuais sobre essas aulas/conteúdos e Community básica |
| NEXT | Importação assistida, correções colaborativas, histórico/aviso individual dos ajustes e encontros comunitários gratuitos |
| MONETIZATION | Tutor/credenciamento, materiais, encontros de tutoria, reservas, transações simuladas e avaliações |
| FUTURE | Publicidade, sem tabelas físicas nesta revisão |

CORE não significa implementar tudo na mesma Sprint. Não há dependência de UNIVASF/SIGA nem limitação artificial das funções gratuitas.

## Validação reproduzível

Ferramentas isoladas em `tools/data-model`, com versões e lockfile próprios, sem dependências adicionadas ao frontend/backend. Execute da raiz:

```sh
npm ci --prefix tools/data-model --ignore-scripts
node scripts/validate-data-model.cjs tools/data-model
node scripts/render-data-model.cjs --check
```

No PowerShell, usar npm.cmd se a política bloquear npm.ps1. O script usa apenas PostgreSQL/WASM em memória, sem URL de conexão, dados reais ou persistência. Cada cenário sofre rollback.

Resultado: **45 tabelas, 102 FKs, 57 CHECKs, 108 verificações aprovadas**, das quais **8 exercitam consultas de referência de autorização/visibilidade**. As outras 100 verificam estrutura e cenários de constraints/histórico. Há **8 sondagens** que demonstram obrigações não impostas pelo DBML sozinho. Elas não são escondidas nem contadas como bloqueios já implementados.

Parser DBML v2 10.1.1; PGlite 0.5.8 com PostgreSQL 18.3. Essa versão é da ferramenta de teste, não decisão de versão de produção. Não valida API real, múltiplas conexões, RLS, notificações automáticas ou renderização visual no dbdiagram.io.

## Pendências de governança

A revisão conjunta com o proprietário foi aceita como conclusão da #7 em 04/09/2026, por instrução expressa de Wanjos-eng. Trata-se de uma exceção registrada ao critério de revisão por outro integrante; não há aprovação atribuída a terceiros. Migrations e funcionalidades não foram declaradas concluídas.

Ainda abertas: governança de topics, papéis de publicação/correção, saída/transferência de owner, credenciamento/comissão, retenção/anonimização e efeitos de reembolso simulado sobre avaliações existentes. Implementar só o recorte da issue correspondente.

Referências técnicas: [sintaxe DBML](https://dbml.dbdiagram.io/docs/), [constraints PostgreSQL](https://www.postgresql.org/docs/current/ddl-constraints.html) e [índices por expressão](https://www.postgresql.org/docs/current/indexes-expressional.html).
