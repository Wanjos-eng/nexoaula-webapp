# Frontend do nexoAula

Aplicação web do nexoAula construída com Next.js, TypeScript e App Router.
A interface atual é um protótipo navegável com dados simulados; ela ainda não
possui autenticação real nem integração com o FastAPI.

A criação de grupo em `/grupos/novo` valida e preserva um rascunho somente enquanto
a tela está aberta. A conclusão é simulada e não cria grupos, canais ou convites.
Veja a [organização, limites e evidências da issue #16](../docs/evidence/issue-16/README.md).

## Requisitos

- Node.js 22.13 ou superior dentro da versão 22, ou Node.js 24.x;
- npm compatível com a versão instalada do Node.js.

## Instalação

Na raiz do monorepositório, execute o script correspondente ao sistema:

```powershell
.\setup.ps1
```

```bash
./setup.sh
```

Também é possível instalar apenas o frontend:

```bash
cd Front-end
npm ci
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` somente quando precisar alterar a
configuração local. Nunca versione `.env.local`, tokens ou credenciais.

```bash
cp .env.example .env.local
```

Nesta fundação nenhuma variável é obrigatória. `NEXT_PUBLIC_API_URL` está
reservada para a integração com o backend em uma task posterior.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
```

O servidor de desenvolvimento fica disponível em `http://localhost:3000`.

## Imagem Docker

O frontend também pode ser executado como uma imagem independente, sem
backend ou banco de dados. O `Dockerfile` usa Node.js 22.13.0, gera o bundle
`standalone` do Next.js e inicia o servidor na porta 3000:

```bash
docker build -t nexoaula-web-demo ./Front-end
docker run --rm -p 3000:3000 nexoaula-web-demo
```

O deploy da demonstração usa o build nativo do Next.js na Vercel. A imagem
Docker permanece como alternativa para ambientes compatíveis com containers.
O `Dockerfile` não é executado pela Vercel: os dois caminhos usam o mesmo código,
mas possuem runtimes de implantação diferentes. Durante builds da Vercel, o
bundle `standalone` é desativado para que o adaptador da plataforma gere seus
próprios artefatos; builds Docker continuam gerando o bundle normalmente.

## Deploy na Vercel

A raiz do projeto na Vercel deve ser configurada como `Front-end`. O arquivo
`vercel.json` mantém os comandos de instalação e build explícitos. Pull Requests
podem receber previews automaticamente quando o repositório estiver conectado
ao projeto pela integração Git da Vercel. A opção `Skip deployments` do projeto
evita builds quando não há mudanças em `Front-end` ou em suas dependências.

## Rotas disponíveis

- `/login` — acesso simulado com validação de campos;
- `/cadastro` — criação simulada de conta;
- `/inicio` — dashboard acadêmico com disciplinas, aulas e grupo de estudo;
- `/disciplinas` — lista de disciplinas e turmas em andamento;
- `/disciplinas/modelagem-simulacao` — detalhe da disciplina com ementa, materiais, notas e atividades;
- `/calendario` — calendário mensal com aulas, encontros e entregas;
- `/grupos` — visão de grupos próprios e descoberta de comunidades abertas;
- `/grupos/comunidade-msd-c8` — conversa da comunidade com canais, encontros e participantes;
- `/grupos/novo` — fluxo simulado de criação de grupo;
- `/perfil` — perfil acadêmico e preferências;
- `/progresso` — acompanhamento resumido do progresso;
- `/` — redireciona para `/login`.

## Estrutura

```text
src/
├── app/                # Rotas, layouts e páginas do App Router
├── components/
│   ├── layout/         # Estruturas visuais compartilhadas
│   ├── auth/           # Formulários compartilhados de acesso
│   └── ui/             # Componentes básicos reutilizáveis
├── lib/
│   └── api/            # Cliente HTTP e contratos de integração futuros
├── mocks/              # Fixtures de desenvolvimento e testes
└── modules/            # Funcionalidades organizadas por domínio
```

Não crie módulos de roadmap antes de existir uma Issue aprovada para eles.

## Estado dos mocks

As ações visíveis que dependem de backend comunicam seu caráter simulado. Os
dados do dashboard ficam temporariamente junto da página para facilitar a
apresentação e deverão migrar para fixtures e contratos de API nas Issues de
integração correspondentes.
