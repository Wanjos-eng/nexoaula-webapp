# ADR-0001: Organização inicial em monorepositório

- **Status:** Aceita — decisão de monorepositório
- **Data:** 2026-08-27; referências conciliadas em 2026-09-04

## Contexto

O nexoAula é desenvolvido por uma equipe pequena, em um projeto acadêmico com prazo de sete semanas. A equipe precisa manter rastreáveis as mudanças do frontend, do backend, da documentação e de futuros componentes compartilhados, com configuração centralizada.

## Decisão

Manter frontend, backend, documentação e futuros componentes compartilhados em um único monorepositório. Next.js fica em `Front-end/`, FastAPI em `Back-end/apps/api/` e o banco definido é PostgreSQL. O backend segue arquitetura modular/em camadas, não microsserviços.

## Referências de produto e limites desta decisão

- A [decisão de monetização #11](https://github.com/Wanjos-eng/nexoaula-webapp/issues/11) preserva o núcleo acadêmico gratuito, sem limitações artificiais de grupos/membros. Gratuito não significa acesso irrestrito: o aluno acessa o PD pelos grupos dos quais participa.
- Cada grupo tem plano, aulas e correções próprios; presença/falta é individual e ligada à aula realizada. A revisão técnica está na [modelagem](../architecture/data-model.md), com revisão conjunta aceita pelo proprietário na [#7](https://github.com/Wanjos-eng/nexoaula-webapp/issues/7), por decisão expressa em 04/09/2026.
- Tutores/criadores, materiais, sessões profissionais e credenciamento pertencem ao recorte MONETIZATION, inicialmente com transações simuladas. A formulação antiga de premium baseado em escassez não é a decisão vigente.
- Importação assistida de PDF e correções colaborativas estão em NEXT. Publicidade permanece em FUTURE, sem tabelas físicas. Isso não significa implementação concluída nem obriga criar todos os módulos agora.
- ORM, estratégia concreta de migrations, autenticação e provedor de storage permanecem em aberto. O status deste ADR aprova a organização em monorepositório, não essas escolhas pendentes.

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
