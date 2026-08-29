# Design QA — Issue #13

## Alvos comparados

- Verdade visual de login: `C:\Users\wesle\.codex\attachments\d9193766-fb53-47cf-870e-de973291f23c\pasted-text.txt`
- Verdade visual de cadastro: `C:\Users\wesle\.codex\attachments\c7baf6d8-e59f-4ef7-9e9b-6a228a81eee8\pasted-text.txt`
- Verdade visual de início: `C:\Users\wesle\.codex\attachments\2c003925-5e18-431a-822a-a3cece897ab4\pasted-text.txt`
- Identidade oficial: `C:\Users\wesle\Downloads\NexoAula_Logo_Kit_v1.zip`
- Implementação: `http://localhost:3000/login`, `http://localhost:3000/cadastro` e `http://localhost:3000/inicio`
- Referências adicionais: `C:\Users\wesle\.codex\attachments\23be5b1b-fbd0-499b-9be3-c49076e9bd79\pasted-text.txt` (criação), `40c42756-6bbb-4c95-9319-a0506a1bf5fb` (acesso), `320b6e83-b72c-4a04-aaa4-6002c0601904` (revisão), `0b300581-4ab7-4eea-a1eb-b260922853b4` (sucesso) e `56a0b8eb-c6e1-4995-856c-cf9389b2f10f`/`18bd3bad-6f7f-4c5f-9754-33f790b23340` (comunidade).
- Implementação adicional: `http://localhost:3000/grupos`, `http://localhost:3000/grupos/novo` e `http://localhost:3000/grupos/comunidade-msd-c8`

## Evidências e normalização

| Estado | Fonte | Implementação | Viewport CSS | Densidade |
| --- | --- | --- | --- | --- |
| Login desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-login-desktop.jpg` — 1280 × 720 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-login-desktop-pass3.jpg` — 1280 × 720 px | 1280 × 720 | 1,25 |
| Cadastro desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-cadastro-desktop.jpg` — 1265 × 712 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-cadastro-desktop-pass2.jpg` — 1265 × 712 px | 1280 × 720; área útil desconta barras nativas | 1,25 |
| Início desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-inicio-desktop.jpg` — 1440 × 900 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-inicio-desktop-pass2.jpg` — 1425 × 891 px | 1440 × 900; comparação pelas regiões de conteúdo, descontando a barra de rolagem da implementação | 1,0 |
| Início mobile | não havia captura móvel autônoma no material | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-inicio-mobile.jpg` — 375 × 811 px | 390 × 844; área útil desconta barras nativas | 1,0 |
| Menu mobile aberto | comportamento especificado na Issue #13 | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-menu-mobile.jpg` — 390 × 843 px | 390 × 844 | 1,0 |
| Cadastro mobile | comportamento responsivo derivado do HTML de referência | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-cadastro-mobile.jpg` — 375 × 811 px | 390 × 844; área útil desconta barras nativas | 1,0 |
| Criação de grupo desktop | `tmp/screen-references-2/01-criar-grupo.html` — captura IAB emitida em 1265 × 800 px | `http://localhost:3000/grupos/novo` — captura IAB emitida em 1265 × 800 px | 1265 × 800 | 1,0 |
| Comunidade desktop | `tmp/screen-references-2/05-comunidade.html` — captura IAB emitida em 1265 × 800 px | `http://localhost:3000/grupos/comunidade-msd-c8` — captura IAB emitida em 1265 × 800 px | 1265 × 800 | 1,0 |
| Comunidade mobile | `tmp/screen-references-2/06-comunidade-mobile.html` — referência responsiva | `http://localhost:3000/grupos/comunidade-msd-c8` — captura IAB emitida em 390 × 844 px | 390 × 844 | 1,0 |

As imagens foram capturadas no mesmo navegador, tema claro e estado inicial. As diferenças de 15 × 9 px no início desktop e de 15 × 8 px no cadastro correspondem às barras nativas presentes somente nas páginas roláveis; a comparação considerou o conteúdo útil e não registrou falsos desvios por esse recorte.

## Comparação de vista completa

- Tipografia: Inter variável foi incorporada localmente; tamanhos, pesos e alturas de linha reproduzem a hierarquia dos HTMLs. No login de 1280 px, o título institucional termina em `x=424`, `y=328`, contra `x=448`, `y=329` na fonte, mantendo a mesma quebra e altura de 70 px.
- Ritmo e layout: login e cadastro mantêm a divisão 40/60. Logo, título do cadastro e sidebar do início coincidem em posição e dimensão. No início, fonte e implementação usam sidebar de 288 px e topbar de 127 px.
- Cores e tokens: grafite, verde de ação, verde de marca, âmbar, superfícies, bordas e estados foram centralizados em tokens CSS derivados do material.
- Imagens: todas as marcas remotas do Stitch foram substituídas pelos PNGs oficiais do kit, preservando transparência, proporção e nitidez. Nenhuma imagem foi redesenhada em CSS ou SVG artesanal.
- Conteúdo: o dashboard permanece centrado em organização acadêmica e grupos. Não foram inseridos anúncios, cobrança, assinatura ou atalhos premium incompatíveis com a monetização futura descrita no plano.

## Comparações focadas

- Painel de autenticação: após o ajuste, o logo ocupa 208 × 47,8 px em `x=64`, `y=64`, equivalente ao quadro de 208,3 × 48 px da referência. O título grande do cadastro inicia em `y=175,8`, contra `y=176` na fonte.
- Dashboard: sidebar e topbar possuem exatamente 288 px e 127 px em ambos os alvos. O primeiro cartão da implementação ocupa `x=320`, `y=168`, `699 × 290 px`, preservando a composição e a densidade do cartão de referência.
- Mobile: nenhum overflow horizontal foi detectado em 390 px. O drawer cobre 84% da largura, mantém o fundo bloqueado, recebe foco ao abrir, fecha com Escape e devolve o foco ao acionador.
- Controles: campos têm rótulos, erros associados e foco âmbar; senha alterna visibilidade; navegação, busca simulada, notificações e CTA de grupo comunicam seus estados.
- Fluxo de grupos: as três etapas têm progressão, edição de dados, seleção público/privado, limite, regras, revisão e confirmação. A comunidade permite trocar assunto, marcar interesse no encontro e publicar mensagem simulada.
- Monetização: as telas não bloqueiam recursos acadêmicos nem introduzem cobrança, anúncios ou pagamentos. A decisão futura de monetizar o ecossistema de tutores permanece fora do caminho principal, como definido no plano.

## Histórico de iterações

### Iteração 1 — bloqueada

- [P2] O dashboard estava mais compacto que a referência e expunha conteúdo adicional acima da dobra.
- [P2] O cadastro reutilizava o alinhamento vertical central do login, deixando o título institucional aproximadamente 85 px abaixo do alvo.
- [P2] O atalho móvel “Criar grupo” tinha o SVG comprimido a largura zero por conflito de especificidade.

Correções aplicadas:

- topbar ajustada para 127 px; espaçamento e tipografia dos cartões recalibrados;
- painel de autenticação recebeu posições e escalas de título próprias para login e cadastro;
- logo oficial ajustado para 208 px e padding institucional para 64 px;
- botão móvel recebeu rótulo explícito, seletor mais específico e ícone visível de 18 px.

### Iteração 2 — aprovada

As novas capturas confirmaram as dimensões acima, ausência de sobreposição e equivalência da composição. Não restaram diferenças P0, P1 ou P2.

### Iteração 3 — aprovada (fluxo de grupos)

- [P3] O shell atual mantém a saudação e a barra superior também nas telas de grupo; o HTML de referência usa uma moldura mais compacta. A diferença é intencional para manter a navegação compartilhada da Issue #13.
- [P3] A referência da comunidade usa uma coluna interna para canais; a implementação expõe os mesmos canais como chips responsivos, preservando a leitura e evitando uma terceira coluna estreita em mobile.

Correções aplicadas:

- CTA “Criar grupo” do topbar passou a abrir a rota real `/grupos/novo`;
- rotas `/grupos`, `/grupos/novo` e `/grupos/comunidade-msd-c8` foram adicionadas com navegação e estados simulados;
- emoji de confirmação foram substituídos por ícones da biblioteca Phosphor para manter consistência de acessibilidade e identidade visual;
- layout mobile testado em 390 × 844 px e console verificado sem erros.

## Diferenças intencionais aceitas

- [P3] O selo “Ambiente de demonstração” não existe no Stitch, mas deixa explícito que não há autenticação nem API real, conforme o escopo da Issue #13.
- [P3] O avatar remoto foi substituído pelas iniciais `LA`, exercitando o fallback exigido pela própria issue.
- [P3] Datas passadas do HTML foram atualizadas para a sequência acadêmica usada na apresentação, sem alterar a estrutura visual.

## Interações e erros

- Jornada login → início validada no navegador.
- Menu móvel validado com abertura, foco inicial, Escape e retorno de foco.
- Login, cadastro e início carregaram conteúdo significativo e sem overlay de erro.
- Console sem erros. Um aviso antigo de `scroll-behavior` foi eliminado adicionando `data-scroll-behavior="smooth"` ao elemento `html`.

## Resultado final

### Iteração 4 — correções de navegação e stepper (aprovada)

- [P2] A tela de Grupos apresentava mais de um CTA para criar grupo no mesmo contexto. O CTA contextual foi removido da página; a ação permanece no cabeçalho compartilhado.
- [P2] Disciplinas, Calendário e Progresso apontavam para âncoras do dashboard e pareciam a mesma tela. Foram criadas as rotas próprias `/disciplinas`, `/calendario` e `/progresso`, com conteúdo específico e item ativo correto na navegação.
- [P2] A linha do stepper atravessava os rótulos das etapas. O stepper passou a usar uma linha central independente, com os nomes acima dos círculos e progressão verde sem sobreposição em desktop e mobile.

Validação pós-correção:

- `/grupos` exibe somente um CTA “Criar grupo” (no topbar) e nenhum CTA duplicado no cartão informativo;
- `/inicio`, `/disciplinas`, `/calendario`, `/progresso` e `/grupos` exibem títulos e conteúdos distintos;
- fluxo `/grupos/novo` permanece navegável nas etapas 1 → 2 → 3 → sucesso;
- screenshot IAB em 1265 × 800 confirmou o stepper sem texto cortado;
- lint, typecheck, testes (6/6) e build passaram.

final result: passed

### Iteração 9 — calendário mensal em canvas integral (aprovada)

Feedback visual recebido: o calendário ainda parecia uma tela poluída e encaixotada; a leitura mensal precisava ser a primeira tarefa, com as aulas carregadas diretamente nas datas e os detalhes separados da grade.

Problemas encontrados:

- [P1] A grade mensal não ocupava o protagonismo visual e os eventos apareciam apenas como marcadores discretos, sem horário legível na data;
- [P1] No mobile, o painel lateral podia disputar espaço com a grade e criar uma segunda coluna espremida;
- [P2] Selecionar um dia fora do mês atual não levava o usuário para o mês correspondente.

Correções aplicadas:

- calendário reorganizado em uma composição de canvas com toolbar, grade mensal de sete colunas e painel `Agenda do dia` separado;
- cada data com atividade exibe o horário diretamente na célula, usando cor verde para aula e âmbar para encontro; o título completo permanece disponível no tooltip e no painel de detalhes;
- navegação por mês, botão `Hoje` e seleção de datas continuam funcionando; selecionar um dia fora do mês atual navega automaticamente para o mês dele;
- painel de detalhes e próximas datas empilham abaixo da grade em larguras menores, sem overflow horizontal;
- não foram adicionados cartões, issues, integrações ou dados reais: os eventos seguem explicitamente como mocks de apresentação.

Validação pós-correção:

- desktop em 1265 × 800 confirmou a grade mensal como foco, aulas marcadas nas células e agenda contextual à direita;
- mobile em 390 × 844 confirmou a grade em uma única coluna, sem overflow horizontal, com os detalhes empilhados;
- clique em `2 de setembro de 2026` mudou o mês para setembro e atualizou a agenda para `Quarta-feira, 2 de setembro`;
- aba nova carregou sem erros de console; lint, typecheck, testes (6/6) e build passaram.

Evidências salvas e inspecionadas:

- `tmp/design-qa-issue-13/calendar-platform-full-desktop.png` — 1265 × 800;
- `tmp/design-qa-issue-13/calendar-platform-full-mobile.png` — 390 × 844.

final result: passed

### Iteração 8 — canvas de plataforma sem moldura externa (aprovada)

Feedback visual recebido: a aplicação estava parecendo um SaaS de painéis encaixotados, não uma plataforma acadêmica atrativa. A fonte `f18af107-5249-4e3e-9415-874f63cab769/pasted-text.txt` usa um canvas contínuo para a comunidade, com navegação, conversa e contexto ocupando a tela; a implementação ainda prendia essas regiões em um cartão arredondado com altura artificial.

Problemas encontrados:

- [P1] `.layout` tinha borda, raio e sombra externos, transformando a comunidade em uma moldura dentro de outra moldura;
- [P1] a altura limitada a 640 px deixava um vazio grande abaixo do chat e fazia o composer parecer deslocado;
- [P2] as colunas não comunicavam claramente que eram regiões permanentes da plataforma.

Correções aplicadas:

- comunidade passou a usar canvas contínuo, sem borda/raio/sombra no agrupador principal;
- o layout ocupa o espaço vertical disponível (`calc(100vh - 190px)`), mantendo canais, conversa e contexto alinhados até o fim da viewport;
- separadores sutis e fundos tonais diferenciam navegação, chat e contexto sem criar cartões aninhados;
- em mobile, o layout permanece contínuo e usa a faixa horizontal de assuntos, sem moldura externa;
- o calendário mantém cartões apenas onde eles ajudam a agrupar agenda mensal e detalhes do dia, seguindo a referência recebida.

Validação pós-correção:

- comunidade em 1265 × 800 não apresenta mais o cartão externo nem o vazio inferior; composer permanece ancorado no fim da área de conversa;
- comunidade em 390 × 844 mantém leitura, navegação de assuntos e rolagem sem overflow horizontal;
- calendário em 1265 × 800 mantém título e agenda como primeira hierarquia, sem topbar duplicado;
- aba nova carregou sem erros de console; lint, typecheck, testes (6/6) e build passaram.

Evidências salvas e inspecionadas:

- `tmp/design-qa-issue-13/community-platform-desktop.png` — 1265 × 800;
- `tmp/design-qa-issue-13/community-platform-mobile.png` — 390 × 844;
- `tmp/design-qa-issue-13/calendar-platform-desktop.png` — 1265 × 800.

final result: passed

### Iteração 7 — adaptação às referências de comunidade e calendário (aprovada)

Fontes visuais recebidas nesta revisão:

- `C:\Users\wesle\.codex\attachments\f18af107-5249-4e3e-9415-874f63cab769\pasted-text.txt` — comunidade MSD com navegação de canais, cabeçalho contextual e três regiões;
- `C:\Users\wesle\.codex\attachments\73badfdb-06ad-43c2-81d1-d0363654247d\pasted-text.txt` — calendário mensal com cabeçalho de página, navegação e agenda lateral.

Problemas encontrados na comparação:

- [P1] O shell repetia `Área de grupos`/`Área acadêmica` acima de páginas que já possuíam cabeçalho contextual próprio, criando uma hierarquia duplicada;
- [P2] A comunidade ficava visualmente mais distante da referência quando o topbar global competia com o título do grupo;
- [P2] A busca global precisava ser discreta e acionada sob demanda, sem dominar o cabeçalho.

Correções aplicadas:

- páginas de calendário e comunidade passaram a usar um shell mínimo no desktop; seus cabeçalhos próprios agora são a primeira hierarquia visual;
- em mobile, o shell mínimo mantém somente o menu, evitando repetir títulos e liberando espaço para o conteúdo;
- comunidade preserva a composição de canais + conversa + contexto, com composer fixado e modais de participantes/organizador;
- calendário preserva a visão mensal, navegação por mês e agenda por data, com cards de próximas datas;
- páginas gerais continuam com topbar contextual e busca compacta expansível.

Validação pós-correção:

- comunidade em 1265 × 800 e 390 × 844 ficou alinhada ao padrão visual recebido, sem título duplicado;
- calendário em 1265 × 800 inicia diretamente no cabeçalho `Calendário`, com a agenda mensal e lateral em primeiro plano;
- aba de comunidade carregou sem erros de console em uma aba nova; mobile não apresentou overflow horizontal;
- lint, typecheck, testes (6/6) e build passaram.

final result: passed

### Iteração 5 — comunidade com padrão de canais (aprovada)

- [P1] A comunidade estava organizada como uma sequência de chips e uma lista de posts sem separação clara entre canais, conversa e contexto do grupo. Isso deixava o chat visualmente solto e diferente da referência inspirada no Discord.
- [P1] O topbar repetia “Olá, Lucas” e “Criar grupo” em telas internas, inclusive quando um grupo já estava aberto.

Correções aplicadas:

- comunidade reorganizada em três regiões: canais do grupo, chat central com rolagem interna e composer fixado, e informações laterais de encontro/plano/participantes;
- canais `#geral`, `#filas-mm1`, `#modelo-analitico` e `#dúvidas` passaram a ter seleção ativa e estado de assunto;
- topbar passou a ser contextual: saudação somente em `/inicio`, área de grupos nas rotas de grupo e CTA “Criar grupo” somente em `/inicio` e `/grupos`;
- layout desktop usa altura controlada para manter o composer visível; mobile transforma a lista de canais em uma faixa horizontal sem scrollbar aparente;
- ícones permanecem na biblioteca Phosphor e os recursos acadêmicos seguem sem bloqueios ou monetização intrusiva.

Evidência pós-correção:

- referência: `tmp/screen-references-2/05-comunidade.html` (captura IAB, 1265 × 800 px);
- implementação: `http://localhost:3000/grupos/comunidade-msd-c8` (captura IAB, 1265 × 800 px) e 390 × 844 px;
- composer visível no desktop, canais selecionáveis, interesse no encontro e envio de mensagem simulada validados;
- nova aba carregou sem erros de console.

### Iteração 6 — descoberta, agenda e preferências de workspace (aprovada)

- [P1] Grupos precisava separar a visão de comunidades do usuário da descoberta de grupos abertos; sem isso, a busca e a entrada em novas comunidades ficavam implícitas.
- [P1] O calendário ainda funcionava como uma lista de compromissos, sem visão mensal ou detalhe contextual por data.
- [P2] A busca global ocupava espaço em todos os contextos e repetia a mesma estrutura visual; a sidebar também não oferecia escolha de densidade ou ocultação.
- [P1] Participantes e ações do organizador estavam expostos no mesmo nível da conversa, dificultando a leitura do chat e a distinção de permissões.

Correções aplicadas:

- `/grupos` agora possui abas `Meus grupos` e `Descobrir grupos`, busca local por disciplina/nome e cards de comunidades abertas, mantendo o CTA de criação somente no cabeçalho;
- `/calendario` usa `react-day-picker` para uma visão mensal navegável, marcadores de aula/encontro e painel `Agenda do dia` atualizado ao selecionar uma data;
- o topbar foi reduzido e contextualizado: a busca global virou um acionador compacto com expansão sob demanda, evitando um campo dominante em todas as páginas;
- a sidebar ganhou preferências `Ampla`, `Compacta` e `Oculta`, com alça de revelação por hover/foco e ajuste de margem do conteúdo;
- a comunidade ganhou painéis modais separados para `Participantes` e `Gerenciar grupo`, com papéis explícitos (organizador, tutora voluntária e participante) e ações de organização isoladas da conversa;
- a proposta de valor continua sem bloqueios, anúncios ou cobrança no fluxo acadêmico; tutoria aparece apenas como papel futuro/opcional da comunidade.

Validação pós-correção:

- desktop em 1265 × 800 confirmou abas, busca filtrada, calendário mensal, topbar compacto e layout de chat em três regiões;
- mobile em 390 × 844 confirmou calendário empilhado, grupos responsivos, navegação sem overflow horizontal e acionador de busca reduzido;
- seleção de `2 de setembro` atualizou a agenda para o evento correspondente; modos `Compacta` e `Oculta` alteraram a largura/revelação da sidebar;
- `Participantes` abriu o painel com quatro pessoas e papéis; `Gerenciar grupo` abriu a visão exclusiva do organizador;
- console da aba de QA sem erros; lint, typecheck, testes (6/6) e build passaram.

final result: passed

### Iteração 10 — perfil e detalhe de disciplina alinhados ao Figma (aprovada)

Referências comparadas nesta revisão:

- `tmp/audit-profile-discipline/01-figma-profile.png` — frame `perfil` (`165:101`), capturado no arquivo NexoAula;
- `tmp/audit-profile-discipline/02-figma-discipline.png` — frame `detalhes-disciplina` (`165:432`), capturado no arquivo NexoAula;
- `tmp/audit-profile-discipline/local-profile-final.png` e `local-discipline-final.png` — implementação em 1265 × 800;
- `tmp/audit-profile-discipline/local-profile-mobile-final.png` e `local-discipline-mobile-final.png` — implementação em 390 × 844.

Diferenças encontradas:

- [P1] Não existia uma rota de Perfil, embora o arquivo de referência apresentasse dados pessoais, desempenho acadêmico e preferências;
- [P1] `Disciplinas` era somente um cartão-resumo, enquanto a referência apresentava detalhe da disciplina, progresso, abas, notas e próximas atividades;
- [P2] o topbar contextual repetia `Área acadêmica` antes das telas que já tinham cabeçalho próprio;
- [P3] a navegação usava `Progresso`, enquanto a referência usa `Meu progresso`.

Correções aplicadas:

- criada a rota `/perfil`, acessível pelo nome do usuário na sidebar, com informações pessoais, IRA, créditos, disciplinas em andamento, previsão de formatura, notificações, tema e idioma;
- `/disciplinas/modelagem-simulacao` passou a usar detalhe acadêmico com abas funcionais `Ementa`, `Materiais`, `Notas` e `Atividades`, tabela de avaliações e agenda lateral; `/disciplinas` ficou reservado à lista de turmas no fluxo revisado da Iteração 11;
- Perfil, Disciplinas e Progresso agora usam shell mínimo, deixando o cabeçalho da própria tela como primeira hierarquia;
- `Meu progresso` foi alinhado ao rótulo da referência e o avatar da sidebar passou a ser um link de perfil;
- dados continuam explicitamente simulados; nenhuma integração de API ou regra funcional foi inventada.

Revisão geral:

- `/calendario`, `/grupos` e `/grupos/novo` estão consistentes com as correções visuais recentes e sem problemas estruturais críticos;
- `/inicio`, `/login` e `/cadastro` mantêm a composição já validada;
- `/progresso` agora elimina o cabeçalho duplicado, mas ainda é mais simples que a referência Figma: faltam os três indicadores, gráfico de evolução, conquistas e tabela detalhada por disciplina;
- a diferença de fotografia no perfil foi mantida como fallback de iniciais (`LA`), pois não há avatar local oficial no repositório.

Validação pós-correção:

- Perfil e Disciplinas renderizados em desktop e mobile sem overflow horizontal;
- abas da disciplina, toggle de notificações e seleção de tema testados no navegador;
- abas novas carregaram sem erros de console; lint, typecheck, testes (6/6) e build passaram.

Limitação de captura:

- a chamada estruturada do Figma atingiu o limite do plano Starter; as referências foram capturadas pela sessão Browser autenticada, sem editar o arquivo Figma.

final result: passed

### Iteração 11 — fluxo de disciplinas e chat mobile comparados ao Figma (aprovada)

Referências comparadas nesta revisão:

- frame `grupos_mobile` (`16:666`) no arquivo NexoAula, com cabeçalho compacto, canais em chips e mensagens em balões;
- frame `detalhes-disciplina` (`165:432`) e a captura anterior de `Minhas disciplinas`, comparados às rotas locais em 1265 × 800 e 390 × 844.

Diferenças encontradas:

- [P1] `/disciplinas` havia sido convertido diretamente em detalhe, removendo a etapa “Minhas disciplinas” do fluxo;
- [P1] o chat mobile mantinha o cabeçalho desktop, a moldura de três painéis e mensagens em lista, divergindo do frame compacto do Figma;
- [P2] o cabeçalho global ainda aparecia no mobile do grupo, roubando espaço da conversa.

Correções aplicadas:

- `/disciplinas` voltou a ser a lista “Minhas disciplinas”, com resumo da turma, próxima aula e progresso;
- criada a rota `/disciplinas/modelagem-simulacao` para o detalhe com abas `Ementa`, `Materiais`, `Notas` e `Atividades`; CTAs de progresso e da lista apontam para essa etapa;
- o grupo ganhou cabeçalho mobile com identidade da comunidade, tópico ativo, retorno e configurações; a navegação global é ocultada apenas nesse contexto;
- canais mobile permanecem em chips roláveis sem scrollbar visível, mensagens usam balões e a mensagem do usuário é alinhada à direita; composer fica fixado ao rodapé e informações secundárias ficam acessíveis fora da conversa.

Validação pós-correção:

- grupo e disciplinas renderizados em 1265 × 800 e 390 × 844;
- fluxo lista → detalhe confirmado por navegação real;
- grupo mobile sem erros de console e sem overflow horizontal aparente;
- lint, typecheck, testes (6/6) e build passaram; build gerou `/disciplinas` e `/disciplinas/modelagem-simulacao`.

final result: passed
