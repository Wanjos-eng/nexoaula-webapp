# Arquitetura e Visão Geral do nexoAula

O nexoAula adota uma arquitetura baseada em **Monorepositório**, garantindo centralização, padronização e compartilhamento de contratos entre os pacotes do sistema.

## Pilha Tecnológica Oficial
* **Front-end:** Next.js (localizado em `Front-end/` ou na estrutura de aplicações do repositório)
* **Back-end:** FastAPI em Python (localizado em `Back-end/apps/api/` ou estrutura equivalente de microsserviços/APIs)
* **Banco de Dados:** PostgreSQL

> **Nota técnica:** Decisões complexas referentes a frameworks de ORM definitivos, provedores de storage de arquivos em object storage ou fluxos complexos de autenticação detalhada ainda **não** estão escopo fechado ou escolhidas neste momento.

## Limites e Dependências dos Módulos (Escopo e Priorização)

O sistema organiza-se em blocos conceituais e lógicos bem delimitados:

* **CORE (Núcleo):** 
  * *Identity:* Contas, perfis, tokens de verificação e credenciais de acesso.
  * *Academic:* Estrutura institucional, cursos, disciplinas, turmas e vínculos docentes.
  * *Academic Planning:* O planejamento acadêmico estruturado sob a ótica estrita de **PREVISTO** (`teaching_plans` e `scheduled_lessons`), **REALIZADO** (`lesson_occurrences`) e **MEU REGISTRO** privado do aluno (`student_lesson_attendance` e `student_topic_progress`).
* **NEXT (Engajamento):** 
  * *Community:* Grupos de estudo, canais de texto, mensagens e encontros comunitários/gratuitos.
* **MONETIZATION (Fluxo Comercial e Futuro):** 
  * *Marketplace:* Perfis profissionais de tutores, credenciamento, venda de materiais autorais e sessões profissionais com transações financeiras simuladas.
* **FUTURE:** 
  * Funcionalidades mapeadas mas mantidas fora do MVP ou do escopo imediato (ex: integrações diretas com sistemas acadêmicos externos legados, publicidade modular pesada).

## Referências
* **[Modelo de Dados Oficial em DBML](../diagrams/nexoaula.dbml)**