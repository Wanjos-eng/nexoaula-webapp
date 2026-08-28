# Frontend do nexoAula

Aplicação web do nexoAula construída com Next.js, TypeScript e App Router.
Este setup contém somente a fundação técnica; jornadas de produto serão
implementadas em Issues próprias.

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
cd apps/web
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

## Estrutura inicial

```text
src/
├── app/                # Rotas, layouts e páginas do App Router
├── components/
│   ├── layout/         # Estruturas visuais compartilhadas
│   └── ui/             # Componentes básicos reutilizáveis
├── lib/
│   └── api/            # Cliente HTTP e contratos de integração futuros
├── mocks/              # Fixtures de desenvolvimento e testes
└── modules/            # Funcionalidades organizadas por domínio
```

Não crie módulos de roadmap antes de existir uma Issue aprovada para eles.
