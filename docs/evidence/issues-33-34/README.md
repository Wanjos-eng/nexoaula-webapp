# Issues #33 e #34 — contexto acadêmico e grupos

## Comportamento entregue

- `/perfil`: identidade real, instituição/curso relacionados e bio; leitura após recarregar, gravação por PATCH e preservação dos campos em falha.
- `/grupos/novo`: catálogo canônico de disciplinas, turmas e períodos; criação persistida, visibilidade/política de entrada e link para o ID retornado pela API.
- `/grupos`: grupos do participante e descoberta pública com filtros de assunto, disciplina e período. Paginação de 12 itens com um registro adicional para detectar próxima página.
- `/grupos/[groupId]`: metadados, participação própria, entrada aberta ou solicitação, edição pelo proprietário e gestão por organizadores. Aprovação/recusa/remoção revalidam os dados, inclusive em conflito.
- As ações de escrita bloqueiam submissão duplicada; erros de sessão oferecem retorno ao login. Falhas de leitura oferecem nova tentativa e não exibem dados anteriores de outro filtro/grupo.

## Consistência visual

As quatro telas compartilham `AcademicCommunity.module.css`: cores semânticas existentes, títulos, ritmo de espaçamento, bordas, botões de 44px ou mais, foco visível e cartões responsivos. O cabeçalho global não repete títulos e ações dessas páginas. A navegação exibe o usuário da sessão.

## Complementos necessários na API

A #32 fornecia ações de participação, mas não as leituras necessárias para reconstruir a interface. Foram adicionados:

| Endpoint | Acesso e conteúdo |
| --- | --- |
| `GET /api/v1/groups/mine` | Grupos com participação ativa do usuário autenticado; inclui privados/não listados, exclui removidos logicamente. |
| `GET /api/v1/groups/{id}/participation` | Estado e papel próprios, permissão de gestão e quantidade de membros ativos. |
| `GET /api/v1/groups/{id}/members` | Apenas organizadores ativos; nomes públicos, IDs e papéis. `pending=true` lista solicitações pendentes. |

As listagens aceitam `offset` e `limit` (1–100). Não retornam emails. Grupo privado retorna 404 para não participantes. Não foram adicionadas tabelas ou migrações.

## Verificação reproduzível

```sh
cd Front-end
npm run lint
npm run typecheck
npm test -- --maxWorkers=2
npm run build
# Com o frontend em execução:
npx playwright test tests/e2e/community-controlled.spec.ts --workers=1
```

```sh
cd Back-end/apps/api
python -m pytest tests/integration/community/test_groups.py -q
```

`src/modules/groups/integration.test.tsx` usa o cliente HTTP real e respostas de rede controladas: persistência ao remontar, CSRF, submissão única, recuperação de validação, filtros/paginação, estados por política/papel, conflito e erros 401/404/503.

O teste Playwright percorre perfil → descoberta → solicitação → criação → aprovação nas larguras 1440 e 390px, verifica ausência de overflow horizontal e produz capturas. Suas respostas HTTP são controladas; ele não substitui E2E com API/PostgreSQL reais.

Os testes da API verificam autenticação, permissão de leitura/gestão, paginação, reconsulta após aprovação e perda de acesso ao grupo privado após remoção. O cenário PostgreSQL existente também recebeu as novas consultas; requer banco configurado.

## Limites do recorte

Não há matrícula/follow de turma, importação de PDF, canais, chat ou painel de PD pessoal. Nenhum conteúdo acadêmico é liberado pela simples descoberta ou consulta ao catálogo. Convites não são enviados nesta entrega. Histórico pessoal não é apagado ao remover participação.

As telas antigas em `modules/community` e a rota de demonstração `grupos/comunidade-msd-c8` pertencem ao protótipo anterior; não alimentam o fluxo integrado. A página inicial e outras áreas de demonstração continuam fora deste recorte.

## Resultados locais

- Lint e verificação TypeScript aprovados.
- Suite frontend: 150 testes aprovados. Após acrescentar cobertura de edição, recusa e remoção, a execução focalizada passou com 15 testes (integrações e navegação global).
- Build de produção aprovado.
- Playwright: 2 cenários aprovados, em 1440px e 390px, com respostas HTTP controladas.
- API de grupos: 24 testes aprovados e 1 teste PostgreSQL ignorado por falta de banco configurado.
- Verificação ampliada do backend no runtime Python 3.12: 180 aprovados, 55 ignorados e 9 falhas nos testes preexistentes de instalação, que exigem Python 3.11. Essas falhas não foram corrigidas alterando a regra de versão do projeto.

## Capturas

| Tela | Desktop | Celular |
| --- | --- | --- |
| Perfil | [1440px](profile-1440.png) | [390px](profile-390.png) |
| Descoberta | [1440px](discovery-1440.png) | [390px](discovery-390.png) |
| Criação | [1440px](create-1440.png) | [390px](create-390.png) |
| Solicitação pendente | [1440px](pending-1440.png) | [390px](pending-390.png) |
| Gestão do organizador | [1440px](organizer-1440.png) | [390px](organizer-390.png) |
