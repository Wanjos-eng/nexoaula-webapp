# Frontend do nexoAula

Aplicação web do nexoAula construída com Next.js, TypeScript e App Router.
A interface atual é um protótipo navegável com dados simulados; ela ainda não
possui autenticação real nem integração com o FastAPI.

## Requisitos

- Node.js 22.13 LTS ou Node.js 24 ou superior;
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
