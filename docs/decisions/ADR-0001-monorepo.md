# ADR-0001: Organização em monorepositório e Premissas de Negócio e Arquitetura

- **Status:** Aceito
- **Data:** 2026-08-27 (Atualizado em 2026-09-03)

## Contexto

O nexoAula é desenvolvido em um projeto acadêmico estruturado. A equipe precisa manter rastreáveis as mudanças do frontend, do backend, da documentação e de futuros componentes compartilhados, garantindo padronização e compartilhamento de contratos.

## Decisão

1. **Monorepositório:** Manter frontend, backend, documentação e componentes compartilhados em um único monorepositório. O frontend será desenvolvido com Next.js, o backend com FastAPI, o banco de dados será PostgreSQL e a organização interna seguirá uma arquitetura modular.
2. **Modelo de Acesso e Monetização (Alinhamento #11):** 
   - O núcleo acadêmico do nexoAula (gestão de turmas, planejamento de aulas e acompanhamento de presença/progresso) é **estritamente gratuito e universal** para estudantes e instituições.
   - Não há limitação artificial de criação de grupos de estudo ou quantidade de membros.
   - A monetização futura restringe-se ao ecossistema de marketplace (materiais autorais de tutores, sessões de tutoria profissional e credenciamento), mantendo o ecossistema educacional livre de barreiras financeiras básicas.
3. **Decisões Pendentes:** Escolhas definitivas de ORM avançado, infraestrutura exata de Object Storage para arquivos binários e provedores de autenticação robustos continuam sob análise e serão pontuadas em ADRs futuros dedicados.

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