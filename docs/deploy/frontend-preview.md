# Preview do frontend na Vercel

O workflow `.github/workflows/frontend-preview.yml` publica uma Preview do
frontend sempre que um Pull Request contém mudanças em `Front-end/**`.
Alterações exclusivas em `Back-end/`, documentação ou outras pastas não
disparam esse deploy.

## Configuração única no GitHub

No repositório `Wanjos-eng/nexoaula-webapp`, configure:

1. Um **Actions secret** chamado `VERCEL_TOKEN` com um token da conta Vercel.
2. Uma **Actions variable** chamada `VERCEL_SCOPE` com o escopo da equipe Vercel
   (`weslenengineer-6627`).

O token nunca deve ser commitado, colocado em `vercel.json`, em arquivos `.env`
ou exposto nos logs.

O workflow usa Node.js 22.13.0, executa lint, typecheck, testes e build antes
do deploy, e atualiza um único comentário do Pull Request com a URL de Preview.
PRs enviados de forks são ignorados para não expor o token a código não
confiável.

## Escopo do deploy

O comando é executado dentro de `Front-end/` e usa o projeto Vercel
`nexoaula-webapp-demo`. A implantação é de Preview; produção não é alterada
automaticamente.

Previews podem exigir login quando a proteção de deployments da Vercel estiver
ativa. Para uma URL pública de apresentação, promova manualmente uma Preview
validada ou ajuste a proteção do projeto na Vercel.
