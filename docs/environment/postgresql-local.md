# PostgreSQL local com Docker Compose

O `compose.yml` da raiz inicia somente o banco PostgreSQL necessário ao
desenvolvimento da API. Frontend e backend continuam sendo executados pelos seus
próprios comandos. A primeira migration libera somente o recorte de identidade;
os demais módulos serão adicionados incrementalmente.

## Pré-requisitos

- Docker Desktop no Windows ou Docker Engine com o plugin Compose no Linux;
- portas liberadas para containers locais;
- nenhum PostgreSQL usando a porta escolhida.

Os comandos não exigem administrador depois que o Docker estiver instalado e
funcionando para o usuário atual. No Windows, abra o Docker Desktop e aguarde o
Engine ficar disponível antes de executar o Compose.

## Iniciar e verificar

Na raiz do monorepositório:

```bash
docker compose up -d --wait
docker compose ps
docker compose exec -T db pg_isready -U nexoaula -d nexoaula
```

O primeiro comando cria o volume, inicia o serviço `db` e aguarda o healthcheck.
Executá-lo novamente é seguro: o container e o volume existentes são
reutilizados.

Os padrões locais são:

| Configuração | Valor de desenvolvimento |
| --- | --- |
| Imagem | `postgres:17-alpine` |
| Host a partir do Windows/Linux | `localhost` |
| Host a partir de outro container no Compose | `db` |
| Porta | `5432` |
| Banco | `nexoaula` |
| Usuário | `nexoaula` |
| Senha | `nexoaula_local` |

Esses valores são públicos, servem somente para desenvolvimento local e não
podem ser reutilizados em produção ou ambientes compartilhados.

## Conexão da API

Para executar as migrations e os futuros acessos da API, a URL local é:

```text
postgresql+psycopg2://nexoaula:nexoaula_local@localhost:5432/nexoaula
```

Copie o exemplo da API para `.env` somente na sua máquina ou exporte a variável no
terminal. Não inclua a URL real em código nem faça commit de `.env`. O health
técnico da API continua funcionando sem banco; migrations exigem a URL.

## Sobrescrever valores locais

O Compose lê as variáveis `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` e
`POSTGRES_PORT` do ambiente. Exemplo temporário no PowerShell para contornar uma
porta 5432 ocupada:

```powershell
$env:POSTGRES_PORT = '5433'
docker compose up -d --wait
```

No Bash:

```bash
POSTGRES_PORT=5433 docker compose up -d --wait
```

Ao mudar banco, usuário ou senha depois da primeira inicialização, use um volume
novo ou faça a alteração dentro do PostgreSQL. As variáveis de inicialização não
reescrevem automaticamente um banco já persistido.

## Parar e limpar

Para parar e remover o container e a rede, preservando os dados:

```bash
docker compose down
```

Para acompanhar logs:

```bash
docker compose logs -f db
```

`docker compose down --volumes` apaga definitivamente o banco local. Use esse
comando somente quando desejar reiniciar um ambiente descartável e depois de
confirmar que não há dados úteis. Os scripts do projeto nunca o executam no
ambiente do desenvolvedor.

## Falhas comuns

- `docker: command not found`: instale o Docker Desktop/Engine e reabra o terminal;
- falha de conexão com o Engine: inicie o Docker Desktop ou o serviço Docker;
- porta já em uso: libere a 5432 ou defina `POSTGRES_PORT` para outra porta;
- serviço `unhealthy`: execute `docker compose logs db` antes de recriar recursos;
- credenciais diferentes das esperadas: verifique as variáveis usadas na primeira
  criação do volume.

O workflow `PostgreSQL Compose checks` valida a configuração, o healthcheck, uma
consulta real e a persistência após recriar o container sem excluir o volume.
