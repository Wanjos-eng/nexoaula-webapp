# ADR-0003: Persistência e migrations no backend

- **Status:** Proposta — aguarda revisão da equipe
- **Data:** 2026-09-05
- **Issue:** [#20 — Validar ORM e estratégia de migrations](https://github.com/Wanjos-eng/nexoaula-webapp/issues/20)

## Contexto

O nexoAula usa FastAPI, terá PostgreSQL e segue uma arquitetura modular/em
camadas. O projeto acadêmico possui equipe pequena e prazo curto. O setup inicial
já trouxe SQLAlchemy, Alembic e o driver `psycopg2-binary`, mas manteve o ambiente
de migrations bloqueado para que a presença dessas dependências não fosse tratada
como decisão arquitetural aprovada.

A primeira entrega de banco deve implementar somente o recorte de identidade da
[#21](https://github.com/Wanjos-eng/nexoaula-webapp/issues/21). Ela não autoriza
transformar todo o DBML em modelos ou migrations.

## Forças consideradas

- manter o modelo PostgreSQL revisado rastreável em código;
- reduzir conceitos e ferramentas diferentes para uma equipe pequena;
- permitir FKs entre módulos sem criar microsserviços ou bancos separados;
- produzir migrations revisáveis e reversíveis em desenvolvimento;
- não armazenar credenciais no repositório;
- testar o DDL no mesmo SGBD usado pelo produto, sem fallback SQLite;
- preservar uma evolução incremental por recorte funcional.

## Alternativas avaliadas

### SQLAlchemy 2 + Alembic

É a combinação proposta. Possui integração direta entre modelos, metadata e
autogenerate, sem impedir migrations escritas ou revisadas manualmente. As
dependências já estão fixadas no backend, o que reduz mudança e tempo de adoção.

### SQLModel + Alembic

Reduz parte da repetição entre modelos de validação e persistência, mas aproxima
contratos HTTP do schema do banco e adiciona uma camada que a equipe ainda não
usa. Não há ganho suficiente para o primeiro recorte.

### SQLAlchemy Core ou SQL manual + Alembic

Oferece controle explícito do SQL, porém exige mais mapeamento manual para os
fluxos CRUD previstos. SQL específico continua permitido dentro de migrations
quando necessário, como no índice funcional de e-mail.

### Migrações sem ORM

Ferramentas centradas apenas em SQL são viáveis, mas introduziriam outra cadeia
de ferramentas e deixariam sem solução o mapeamento dos objetos da aplicação.
Não são escolhidas para o prazo atual.

## Decisão proposta

Adotar:

1. **SQLAlchemy 2**, usando o estilo declarativo tipado com `Mapped` e
   `mapped_column`, para os modelos de persistência.
2. **Alembic** como ferramenta única de versionamento do schema PostgreSQL.
3. **PostgreSQL como único banco suportado** nas migrations. SQLite não será usado
   como substituto em desenvolvimento ou testes de migration.
4. O driver síncrono já fixado no backend durante o primeiro recorte. A adoção de
   I/O assíncrono pode ser reavaliada com evidência de necessidade, sem misturar
   essa mudança à primeira migration.

Essa decisão torna aceita a combinação de ferramentas quando este ADR for
aprovado e mesclado. Enquanto estiver com status `Proposta`, o scaffold permanece
bloqueado e a #21 não deve ser tratada como concluída.

## Organização no monorepositório

```text
Back-end/apps/api/
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
└── app/
    ├── core/config.py
    ├── db/
    │   ├── base.py
    │   ├── metadata.py
    │   └── session.py
    └── modules/
        └── <modulo>/
            └── infrastructure/models.py
```

- Cada módulo é responsável por seus modelos de persistência.
- Todos herdam de uma única `Base`, com uma única `MetaData` e convenção estável
  para nomes de PKs, FKs, índices, uniques e checks.
- `app/db/metadata.py` importa explicitamente os modelos liberados para migration.
  O Alembic usa a metadata agregada; importar um módulo não autoriza migrar todo o
  DBML.
- Camadas de domínio e aplicação não dependem diretamente do Alembic. Outros
  módulos consomem interfaces públicas, não repositories internos.

## Configuração e segurança

- `DATABASE_URL` é obrigatória somente para comandos que acessam o banco.
- O valor vem de variável de ambiente ou de `.env` local ignorado pelo Git. O
  `.env.example` contém apenas um exemplo sem credenciais reais.
- A URL não fica em `alembic.ini`, não possui fallback SQLite e não deve ser
  registrada em logs ou mensagens de erro.
- Configuração ausente ou com um dialeto diferente de PostgreSQL interrompe a
  migration antes de abrir conexão.
- A aplicação poderá continuar iniciando o health técnico sem banco enquanto as
  rotas funcionais ainda não dependerem dele.

## Fluxo de migrations

1. Alterar somente os modelos pertencentes ao recorte da issue.
2. Gerar uma revisão candidata com `alembic revision --autogenerate` quando
   aplicável.
3. Revisar manualmente nomes, tipos PostgreSQL, defaults, índices, FKs, deleções,
   upgrade e downgrade. Autogenerate não é aceito como prova de correção.
4. Executar `upgrade head`, `downgrade <base>` e novo `upgrade head` em PostgreSQL
   descartável e vazio.
5. Executar `alembic check` e inspeções específicas das constraints do recorte.
6. Anexar os comandos/resultados ao Pull Request.

Uma revision já compartilhada ou aplicada não deve ser reescrita. A correção usa
uma nova migration. Downgrade destrutivo é permitido somente em banco local,
descartável ou CI; ambientes compartilhados usam coordenação e estratégia
forward-only.

## Estratégia de testes

- O CI inicia um PostgreSQL descartável e aguarda o health do serviço.
- A suíte parte de banco vazio e comprova upgrade/downgrade/upgrade.
- Testes inspecionam tabelas, colunas, tipos, constraints e índices exigidos pela
  issue, inclusive regras específicas do PostgreSQL.
- Testes de metadata sem conexão podem complementar a suíte, mas não substituem o
  teste de migration real.
- Dados usados são sintéticos e não persistem após o job.

## Consequências

### Benefícios

- modelos tipados próximos aos módulos que os possuem;
- um histórico central e ordenado de schema;
- nomes previsíveis tornam downgrade e revisão mais seguros;
- validação no PostgreSQL reduz diferenças escondidas por SQLite;
- crescimento incremental preserva o escopo de cada Sprint.

### Riscos e mitigação

- **Acoplamento pela metadata única:** limitar imports ao agregador e manter as
  dependências entre módulos explícitas.
- **Autogenerate incompleto:** revisão manual e inspeção do schema são obrigatórias.
- **Migration que funciona só em banco vazio:** futuras alterações precisam ser
  testadas também com o estado imediatamente anterior.
- **Sessões síncronas bloqueando endpoints assíncronos:** usar endpoints síncronos
  para esse acesso no primeiro recorte e reavaliar o driver se medições mostrarem
  necessidade.

## Condições de revisão

Reavaliar esta decisão se testes mostrarem inadequação do driver, se o volume ou a
concorrência exigirem I/O assíncrono, se a metadata agregada se tornar um gargalo
organizacional ou se houver necessidade comprovada de outra ferramenta. A revisão
deve ocorrer por novo ADR e migrations aditivas, sem reescrever o histórico
compartilhado.

