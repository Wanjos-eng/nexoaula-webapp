# Design QA — Issue #13

## Alvos comparados

- Verdade visual de login: `C:\Users\wesle\.codex\attachments\d9193766-fb53-47cf-870e-de973291f23c\pasted-text.txt`
- Verdade visual de cadastro: `C:\Users\wesle\.codex\attachments\c7baf6d8-e59f-4ef7-9e9b-6a228a81eee8\pasted-text.txt`
- Verdade visual de início: `C:\Users\wesle\.codex\attachments\2c003925-5e18-431a-822a-a3cece897ab4\pasted-text.txt`
- Identidade oficial: `C:\Users\wesle\Downloads\NexoAula_Logo_Kit_v1.zip`
- Implementação: `http://localhost:3000/login`, `http://localhost:3000/cadastro` e `http://localhost:3000/inicio`

## Evidências e normalização

| Estado | Fonte | Implementação | Viewport CSS | Densidade |
| --- | --- | --- | --- | --- |
| Login desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-login-desktop.jpg` — 1280 × 720 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-login-desktop-pass3.jpg` — 1280 × 720 px | 1280 × 720 | 1,25 |
| Cadastro desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-cadastro-desktop.jpg` — 1265 × 712 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-cadastro-desktop-pass2.jpg` — 1265 × 712 px | 1280 × 720; área útil desconta barras nativas | 1,25 |
| Início desktop | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\source-inicio-desktop.jpg` — 1440 × 900 px | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-inicio-desktop-pass2.jpg` — 1425 × 891 px | 1440 × 900; comparação pelas regiões de conteúdo, descontando a barra de rolagem da implementação | 1,0 |
| Início mobile | não havia captura móvel autônoma no material | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-inicio-mobile.jpg` — 375 × 811 px | 390 × 844; área útil desconta barras nativas | 1,0 |
| Menu mobile aberto | comportamento especificado na Issue #13 | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-menu-mobile.jpg` — 390 × 843 px | 390 × 844 | 1,0 |
| Cadastro mobile | comportamento responsivo derivado do HTML de referência | `C:\Users\wesle\Documents\Codex\2026-08-16\quero-criar-e-configurar-um-reposit\tmp\design-qa-issue-13\implementation-cadastro-mobile.jpg` — 375 × 811 px | 390 × 844; área útil desconta barras nativas | 1,0 |

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

final result: passed
