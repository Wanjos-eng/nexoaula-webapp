# ADR-0001: Organização inicial em monorepositório

- **Status:** Pendente
- **Data:** 2026-08-27

## Contexto

O nexoAula é desenvolvido por uma equipe pequena, em um projeto acadêmico com prazo de sete semanas. A equipe precisa manter rastreáveis as mudanças do frontend, do backend, da documentação e de futuros componentes compartilhados.

## Decisão

Manter frontend, backend, documentação e componentes compartilhados em um único monorepositório. O frontend será desenvolvido com Next.js, o backend com FastAPI, o banco de dados será PostgreSQL e a organização interna seguirá uma arquitetura modular/em camadas.

A importação do plano de ensino em PDF (US11) e o plano premium (US14) foram **movidos para o backlog futuro** e não fazem parte do escopo do MVP atual, priorizando o fluxo de autenticação, perfil com disponibilidade, criação de grupos e solicitação de entrada. A decisão poderá ser reavaliada em sprints futuras, caso haja tempo e viabilidade técnica.

## Benefícios

- Maior rastreabilidade entre mudanças relacionadas.
- Integração mais simples entre as partes do produto.
- Revisões de mudanças coordenadas em um único Pull Request.
- Configuração e documentação centralizadas.

## Riscos

- Crescimento do repositório e do tempo de execução das automações.
- Acoplamento indevido entre módulos.
- Pipelines de integração e implantação mais complexos.

## Condição de revisão

Reavaliar esta decisão se o monorepositório causar prejuízo técnico ou organizacional, como acoplamento excessivo, perda de autonomia, pipelines inviáveis ou dificuldade relevante de manutenção.

