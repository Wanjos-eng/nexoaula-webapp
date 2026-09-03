# Issue #16 — criação de grupo (interface demonstrativa)

## Escopo e organização

A jornada existente foi mantida em três etapas: informações, acesso e revisão,
seguidas de conclusão **simulada**. O visual usa a identidade e os padrões já
presentes no frontend; não houve uma nova auditoria do arquivo Figma nesta tarefa.

- Rota: `Front-end/src/app/(app)/grupos/novo/page.tsx`, Server Component fino.
- Interface: `Front-end/src/modules/community/components/CreateGroupFlow.tsx`.
- Campos e resumo: `GroupDraftFields.tsx` e `GroupDraftSummary.tsx`.
- Estado/transições: `modules/community/createGroupState.ts`, reducer puro.
- Validação: `modules/community/schemas/group.schema.ts`, sem dependência adicional.
- Catálogo explicitamente fictício: `src/mocks/community/academicCatalog.ts`.

O componente genérico `ui/Field` atual aceita somente inputs. Os campos de seleção
e texto desta jornada usam um wrapper privado ao módulo, sem expandir a API global
de UI nem interferir na refatoração de autenticação do PR #75.

## Alinhamento com a modelagem fornecida

Conferido contra `nexoaula_modelagem_revisada.md` e `DBML-nexoAul.sql` fornecidos pelo
proprietário. Não se trata de um contrato de integração com a API.

| Interface | Referência de modelo / comportamento |
| --- | --- |
| Nome | `study_groups.name`, obrigatório, até 150 caracteres |
| Disciplina | `subject_id`, obrigatória; IDs do catálogo são mocks |
| Turma | `class_section_id`, opcional e pertencente à disciplina; mudar disciplina limpa turma |
| Período | Mostrado junto à turma; não cria campo novo em `study_groups` |
| Visibilidade | `public`, `unlisted`, `private` |
| Entrada | `open`, `approval_required`, `invite_only`, separada da visibilidade |
| Capacidade | Opcional; inteiro positivo, incluindo organizador. Limite técnico de inteiro PostgreSQL, não premium |
| Descrição | Campo existente; mantém limite de 240 caracteres do protótipo |
| Regras | Apenas estado da interface (até 500 caracteres); persistência não definida por esta issue |

Não foram criadas combinações proibidas entre visibilidade e entrada, pois essa
regra não está definida no modelo fornecido. A autorização real depende do backend.
O controle legado de sugestão de assuntos foi retirado desta jornada por não
pertencer ao escopo de configuração pedido nesta issue; nenhuma API foi removida.

## Comportamento verificado

- Rascunho inicia vazio, com visibilidade pública e entrada mediante aprovação.
- Erros por campo e resumo focável; digitar não rouba o foco do campo.
- Avanço, retorno e edição preservam os dados em memória.
- Mudança de etapa foca seu título; controles nativos suportam teclado.
- Cancelar com dados pede confirmação; recusar mantém o rascunho.
- Sair/recarregar descarta os dados, como informado na tela. A confirmação é do
  botão Cancelar, não um bloqueio global de links ou histórico do navegador.
- Conclusão explicita que não cria grupo, canal, membros ou convite.
- Não há fetch de criação, localStorage/sessionStorage, limite pago ou cobrança.
- O link enganoso para o grupo fixo MSD foi removido da conclusão.
- Reiniciar começa um novo rascunho vazio; voltar aos grupos mantém a navegação.
- Cabeçalho genérico duplicado foi ocultado apenas nesta rota, preservando o menu mobile.

## Validações

Node 24.7.0, npm 11.5.1; instalação via `npm ci` sem alteração de dependências.

```bash
cd Front-end
npm run typecheck
npm run lint
npm test
npm run build
```

Resultados: TypeScript, lint e build aprovados; **40 testes em 8 arquivos passaram**.
Os testes cobrem schema, reducer, interface e as regressões existentes de descoberta.
Foram verificados desktop (1440 px), mobile (390 px) e largura mínima de 320 px,
sem overflow horizontal nas telas verificadas. Navegador sem erros reportados.
Teste real de navegação entre etapas e Tab entre nome e disciplina aprovado.

Axe 4.12.1 no `main` da etapa inicial a 320 px: 0 violações e 0 verificações
incompletas. No estado de erro desktop também houve 0 violações, mas o contraste
do stepper exigiu inspeção visual por causa dos pseudo-elementos. Isso não equivale
a uma auditoria completa de acessibilidade da plataforma nem certificação WCAG.

## Evidências visuais

- [Informações — desktop](01-informacoes-desktop.png)
- [Acesso — mobile](02-acesso-mobile.png)
- [Revisão — mobile](03-revisao-mobile.png)
- [Revisão — desktop](03-revisao-desktop.png)
- [Conclusão simulada — desktop](04-conclusao-desktop.png)

Capturas locais do servidor de desenvolvimento; o indicador do Next.js aparece
somente nesse ambiente. Revisão humana e merge serão registrados no PR vinculado.
A US13 funcional não deve ser encerrada por esta entrega visual.
