# Ambiente integrado de demonstracao

Este procedimento sobe o frontend Next.js, a API FastAPI e o PostgreSQL com
Docker Compose. Ele foi pensado para uma maquina limpa e usa apenas valores
ficticios de desenvolvimento. Nao use essas credenciais fora do ambiente local.

## Pre-requisitos

- Docker Desktop (Windows) ou Docker Engine com Docker Compose (Linux);
- portas `3000`, `8000` e `5432` livres, ou portas alternativas definidas pelas
  variaveis `WEB_PORT`, `API_PORT` e `POSTGRES_PORT`;
- Docker iniciado e acessivel pelo usuario atual.

O setup de dependencias local continua disponivel em `setup.ps1` e `setup.sh`,
mas nao e necessario para executar a demonstracao em containers.

## Subir e verificar

Na raiz do repositorio, Windows PowerShell:

```powershell
.\scripts\demo.ps1 up
.\scripts\demo.ps1 check
```

Linux ou Git Bash:

```bash
bash ./scripts/demo.sh up
bash ./scripts/demo.sh check
```

`up` e idempotente: ele reutiliza containers e o volume `postgres_data`. A
ordem e controlada pelo Compose: API espera o PostgreSQL ficar saudavel; web
espera a API ficar saudavel. O `check` confirma:

- PostgreSQL com `pg_isready`;
- API em `http://127.0.0.1:8000/health`;
- frontend em `http://127.0.0.1:3000`.

Abra o frontend em <http://127.0.0.1:3000>. As chamadas do navegador usam
`/api` na mesma origem; o rewrite server-side do Next.js encaminha para a API
interna em `http://api:8000`. A URL interna nao deve ser usada pelo navegador.

Para acompanhar os ultimos logs:

```powershell
.\scripts\demo.ps1 logs
```

```bash
bash ./scripts/demo.sh logs
```

## Encerrar e limpar

Para encerrar preservando os dados locais:

```powershell
.\scripts\demo.ps1 down
```

```bash
bash ./scripts/demo.sh down
```

Nao use `docker compose down --volumes` em um ambiente que contenha dados que
precisem ser mantidos. Esse comando remove definitivamente o banco local e so
deve ser usado para reiniciar uma demonstracao descartavel:

```bash
docker compose down --volumes
```

## Configuracao sem segredos

Os arquivos [Front-end/.env.example](../../Front-end/.env.example) e
[Back-end/apps/api/.env.example](../../Back-end/apps/api/.env.example) documentam
as variaveis para execucao manual. O Compose usa valores publicos e ficticios
por padrao e nao exige `.env` para a demonstracao.

Para trocar portas temporariamente:

```powershell
$env:WEB_PORT = '3001'
$env:API_PORT = '8001'
$env:POSTGRES_PORT = '5433'
.\scripts\demo.ps1 up
```

As variaveis de banco devem ser definidas antes da primeira criacao do volume.
Uma senha com caracteres reservados em uma URL PostgreSQL precisa ser codificada
antes de ser usada em `DATABASE_URL`; para o fluxo local padrao, mantenha os
valores ficticios fornecidos pelo Compose.

## Seed

O RC atual nao precisa de seed para iniciar ou executar o smoke test. Nao ha
credenciais reais nem dados de estudantes versionados. Quando um seed ficticio
for necessario para uma demonstracao, ele deve ser executado explicitamente,
apos o `check`, e ser idempotente; o boot nao deve inserir dados silenciosamente.

## Diagnostico

- `port is already allocated`: altere a variavel da porta correspondente e
  repita `up`, ou encerre o processo que ocupa a porta.
- `Cannot connect to the Docker daemon`: inicie o Docker Desktop/Engine e repita.
- API `unhealthy`: execute `./scripts/demo.sh logs api` ou
  `docker compose logs api`; falhas de migration aparecem no inicio do log.
- DB `unhealthy`: execute `docker compose logs db`; confira porta, volume e
  credenciais usadas na primeira inicializacao.
- web `unhealthy`: execute `docker compose logs web`; confirme que a build
  terminou e que `API_BASE_URL` aponta para `http://api:8000` dentro do Compose.
- `check` falha depois de trocar credenciais: as variaveis de inicializacao do
  PostgreSQL nao alteram um volume existente. Preserve o volume e ajuste a
  configuracao para os valores originais, ou descarte conscientemente o volume.

Em qualquer falha, `docker compose ps` mostra o estado e
`docker compose logs --tail=100` preserva o contexto imediato do diagnóstico.
