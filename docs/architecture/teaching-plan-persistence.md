# Persistência do plano manual

A revisão 0008 cria o catálogo `topics` / `subject_topics`, os assuntos do grupo,
os planos e as aulas previstas. Duas instâncias de grupo da mesma turma mantêm
versões e assuntos independentes. FKs compostas impedem misturar grupo, disciplina,
plano, aula e assunto.

O contrato incremental mantém os nomes de atributos introduzidos pelo PR:
`creator_id` (criador), `plan_id` (plano), `scheduled_at` (início previsto),
`lesson_id` e `group_topic_id` (associação ao assunto local). Esses nomes diferem
dos equivalentes documentais `created_by`, `teaching_plan_id`, `planned_start_at`
e `scheduled_lesson_id`. O vínculo da aula usa o assunto local para preservar o
isolamento entre grupos. `custom_title` permite conteúdo manual, exclusivamente
como alternativa ao assunto do catálogo; o assunto sempre pertence à disciplina
do grupo. Este recorte não implementa importação assistida ou cadeia de revisões.

`status`, `published_by` e `published_at` persistem publicação rastreável. Só pode
haver um plano publicado por grupo. A publicação e o arquivamento precisam ocorrer
na mesma transação; a API é responsável pela autorização.

`source_file_id` referencia a tabela `files` (revisão 0015_files_and_storage / #119)
com `ON DELETE SET NULL`. O anexo serve como fonte complementar de consulta e o
cadastro manual do cronograma continua independente. Planos sem anexo mantêm `source_file_id` nulo.

Para aplicar: `python -m alembic upgrade head`. Para reverter apenas este recorte:
`python -m alembic downgrade 0007_marketplace_simulation`. O downgrade remove os
seis novos conjuntos de dados, preservando identidade, catálogo acadêmico, grupos
e marketplace. Exporte dados de planejamento antes de reverter um banco em uso.

Verificação: `python -m pytest -q tests/test_teaching_plan_migration.py` com
`DATABASE_URL` de PostgreSQL migrado, seguida de `python -m alembic check`.
