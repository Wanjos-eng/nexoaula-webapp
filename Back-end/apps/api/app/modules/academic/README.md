# Contexto acadêmico — issue #30

Catálogo autenticado de instituição, curso, disciplina, período e turma. Essas
referências servem à criação e descoberta de grupos. Consultar o catálogo não dá
acesso a PD, aulas, conteúdo ou registros pessoais de qualquer grupo.

## Contrato

Prefixo `/api/v1/academic`:

| Rota | Métodos | Uso |
| --- | --- | --- |
| `/profile` | GET, PATCH | Perfil do próprio usuário: institutionId, courseId, bio |
| `/institutions` | GET, POST | Instituição manual, nome, shortName opcional e timezone IANA |
| `/courses` | GET, POST | Curso de uma instituição; não é sinônimo de disciplina |
| `/subjects` | GET, POST | Disciplina de catálogo de uma instituição |
| `/academic-terms` | GET, POST | Período com datas válidas dentro da instituição |
| `/class-sections` | GET, POST | Turma com disciplina e período da mesma instituição |

Listas usam `limit` (1–100, padrão 50), `offset` e ordenação estável por nome/rótulo
e UUID. `institutionId` filtra cursos, disciplinas, períodos e turmas;
`subjectId` filtra turmas. As rotas retornam somente catálogo, nunca membros/PD.

Para começar com banco vazio: criar uma instituição, um curso opcional, uma
disciplina e um período; então criar a turma com os IDs devolvidos. Consultas GET
permitem reutilizar as referências já cadastradas. Todos os estudantes ativos
podem cadastrar contexto manual compartilhado; não há integração institucional,
cadastro de docentes/horários nem mecanismo de aprovação de catálogo neste recorte.

Interesses livres podem ser descritos na `bio` existente; uma lista estruturada
de interesses continua fora do recorte, sem tabela nova. PATCH diferencia campo
ausente (preservar) de null (limpar). Ao limpar/trocar instituição, limpar ou
trocar também o curso se ele deixar de ser compatível. Cursos inexistentes ou de
outra instituição são recusados na API e pelas FKs. Users mantém propriedade da
persistência de perfil através de `profile_access`, usando a mesma transação.

JWT em cookie HttpOnly conforme ADR-0002; a conta precisa continuar ativa e não
excluída. Mutações exigem JSON, `X-NexoAula-CSRF: 1` e Origin autorizado (Referer
somente como fallback), rejeitando cross-site. Respostas usam no-store. A API usa
401 para sessão inválida, 403 para CSRF, 404 para referência inexistente, 409 para
duplicidade, 422 para validação e 503 para persistência indisponível. `detail` é
texto nos erros de domínio ou lista sanitizada nos erros de payload.

## Alinhamento com o modelo aprovado

Não há enroll/follow de turma nem PD pessoal. A US31 foi conciliada para acesso
ao contexto do grupo por participação ativa. A API de grupos é responsabilidade
das #31/#32; a #30 não conclui a US31.

A revision compartilhada `0003_enrollments` permanece intacta no histórico.
`0004_academic_context` remove a tabela avulsa, cria courses e as FKs acadêmicas do
perfil. Se encontrar inscrições antigas ou referências de perfil que precisam de
conciliação, interrompe antes das alterações, sem apagar/limpar dados silenciosamente.
Nesse caso é necessária uma migração de dados revisada para aquele ambiente.
Downgrade restaura a estrutura anterior, mas não recupera dados de cursos removidos
e só deve ser executado em PostgreSQL descartável. A cadeia completa é testada no CI.

## Validação

Com Python 3.11 e PostgreSQL descartável configurado, na API:

```sh
python -m alembic upgrade head
python -m pytest -q tests/integration/academic tests/test_academic_group_migration.py
python -m alembic check
```

Os testes HTTP usam cadastro/login reais, o serviço e o repository SQLAlchemy,
com savepoints dentro de uma transação revertida por cenário. Os testes de borda
CSRF rodam também sem banco. O CI executa ambos antes e depois dos rollbacks.
