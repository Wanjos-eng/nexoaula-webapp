# FORMULÁRIO SEMANAL DE SPRINT E AVALIAÇÃO — SEMANA 4

**Uso:** Uma entrega por equipe em cada encontro  
**Nota:** 0,0 a 10,0  
**Anexos/evidências:** Links do repositório, backlog, protótipo, deploy e outras evidências devem ser informados  
**Regra:** Respostas curtas, objetivas e verificáveis  

---

### A. Identificação
* **Equipe / nome do produto:** nexoAula — Equipe 3
* **Semana / aula:** `[  ] 1   [  ] 2   [  ] 3   [ X ] 4   [  ] 5   [  ] 6   [  ] 7`
* **Product Owner:** Weslen Anjos
* **Scrum Master:** Rafael Emanuel
* **Data:** 12 de Setembro de 2026

---

### B. Objetivo do Sprint / marco
**Escreva em uma frase o resultado que a equipe pretendia alcançar neste ciclo:**  
*Integrar a jornada completa de autenticação (cadastro e login) ao backend FastAPI com PostgreSQL e autenticação JWT, implementar o cliente HTTP resiliente com gerenciamento de sessão protegida e concluir a modelagem dos módulos acadêmico e comunitário.*

---

### C. Itens planejados e situação

| ID | História/tarefa principal | Responsável(is) | Status | Evidência/commit |
| :--- | :--- | :--- | :--- | :--- |
| **001** | `[#14]` Refatorar jornada visual de autenticação | João Vitor | Concluído | PR #75 |
| **002** | `[#20]` Definir persistência e estratégia de migrations | Weslen | Concluído | PR #81 / ADR-0003 |
| **003** | `[#19]` Definir mecanismo de autenticação JWT | Weslen | Concluído | PR #82 / ADR-0002 |
| **004** | `[#83]` Preparar PostgreSQL local com Docker Compose | Weslen | Concluído | PR #84 |
| **005** | `[#21]` Criar migration inicial de identidade | Weslen | Concluído | PR #85 |
| **006** | `[#22]` Implementar persistência de usuário e perfil | Weslen | Concluído | PR #86 |
| **007** | `[#23]` Implementar cadastro com senha protegida | Weslen | Concluído | PR #87 |
| **008** | `[#24]` Implementar autenticação de login | Weslen | Concluído | PR #89 |
| **009** | `[#25]` Criar cliente HTTP compartilhado | Weslen | Concluído | PR #91 |
| **010** | `[#26]` Integrar cadastro à API | Weslen | Concluído | PR #92 |
| **011** | `[#27]` Integrar LoginForm ao FastAPI e restaurar sessão | Weslen | Concluído | PRs #93 e #94 |
| **012** | `[#17]` Implementar detalhe visual do grupo | Weslen | Concluído | PR #88 |
| **013** | `[#18]` Implementar disciplina, calendário e progresso visual | Weslen | Concluído | PR #90 |
| **014** | `[#29]` Criar migration do núcleo acadêmico e de grupos | Rafael | Concluído | PR #95 |
| **015** | `[#30]` Contexto acadêmico mínimo do estudante | Rafael | Concluído | PR #96 |

---

### D. Incremento produzido

#### 1. O que está funcionando ao final desta aula?
*Descreva funcionalidades executáveis, não apenas atividades realizadas.*
* O fluxo completo de Cadastro e Login de Usuários está 100% funcional entre Next.js (Frontend) e FastAPI + PostgreSQL (Backend), usando senhas criptografadas com bcrypt e tokens JWT.
* Cliente HTTP compartilhado no frontend com tratamento padronizado de erros (`ApiError`), suporte a interceptores e proteção de rotas autenticadas.
* Telas de Detalhes do Grupo, Disciplinas, Calendário e Progresso Pessoal integradas com componentes compartilhados.
* Migrations e entidades ORM (SQLAlchemy/Alembic) para Identidade (`User`, `Profile`), Núcleo Acadêmico (`Course`, `Campus`, `Subject`) e Grupos (`StudyGroup`, `Membership`).

#### 2. O que foi alterado no backlog e por quê?
*Inclua requisitos adicionados, removidos, divididos ou repriorizados.*
Concluímos e fechamos as tarefas `#14`, `#17`, `#18`, `#19`, `#20`, `#21`, `#22`, `#23`, `#24`, `#25`, `#26`, `#27`, `#29`, `#30` e `#83`. Concentramos o esforço da Sprint 4 na estabilização da camada de autenticação, banco de dados e comunicação HTTP para viabilizar a entrega da hipótese de monetização na Aula 5.

#### 3. Qual foi o principal impedimento técnico ou de organização?
*Informe como a equipe tratou ou pretende tratar o impedimento.*
Divergência entre o formato de retorno de erro e status HTTP do frontend mockado e os endpoints reais da API. Foi solucionado padronizando o cliente HTTP no PR #91 e ajustando a especificação OpenAPI no ADR-0002.

#### 4. Qual decisão de Engenharia de Software foi mais relevante?
*Ex.: arquitetura, dados, testes, interface, integração, escopo, segurança.*
Adoção de autenticação baseada em JWT com persistência segura de token no `localStorage`, validação automática de expiração no frontend e ambiente local conteinerizado com PostgreSQL via Docker Compose.

#### 5. Como o incremento desta semana melhora o valor do produto?
*Relacione a entrega ao usuário e, quando aplicável, à hipótese de monetização.*
Converte o protótipo em um produto com backend e segurança real. Usuários conseguem se registrar, autenticar e navegar em ambiente protegido, criando o alicerce para a contratação e simulação de sessões pagas de tutoria.

---

### E. Evidências

* **Repositório Git:** [Repositório do nexoAula](https://github.com/Wanjos-eng/nexoaula-webapp)
* **Quadro / Product Backlog:** [Kanban — nexoAula Desenvolvimento](https://github.com/users/Wanjos-eng/projects/7)
* **Protótipo:** Protótipo NexoAula
* **Deploy / URL de execução:** Demo pública do frontend / ambiente local Docker
* **Outra evidência:** PRs #75, #81, #82, #84, #85, #86, #87, #88, #89, #90, #91, #92, #93, #94, #95, #96

---

### F. Contribuição dos integrantes

| Integrante | Contribuição concreta nesta semana | Evidência | Participação: baixa/média/alta |
| :--- | :--- | :--- | :--- |
| **Weslen Anjos** | Elaborei os ADRs de autenticação e persistência, ambiente Docker PostgreSQL, endpoints BE de auth/signup, cliente HTTP FE e integração das telas de login/cadastro. | PRs #81, #82, #84, #85, #86, #87, #88, #89, #90, #91, #92, #93, #94 | **Alta** |
| **Rafael Emanuel** | Desenvolvi as migrations e modelos do banco de dados (SQLAlchemy/Alembic) para o núcleo acadêmico e estrutura de grupos de estudo. | PRs #95 e #96 | **Alta** |
| **João Vitor Lopes** | Refatorei a jornada visual de autenticação e organização dos módulos e formulários de auth no frontend. | PR #75 | **Média** |
| **Rennan Oliveira** | Atuei na facilitação do Scrum, atualização do quadro Kanban e acompanhamento da repriorização de tarefas do sprint. | Kanban — Project #7 | **Média** |
| **Augusto Hawdani** | Auxiliei no refinamento dos scripts de ambiente e validação da estrutura do repositório. | Issue #9 / Reviews | **Média** |

---

### G. Retrospectiva e próximo passo

* **Manter:** Manter a automação de testes unitários/integração no CI antes de cada merge, convenção de PRs e validação de lints.
* **Mudar:** Disponibilizar os contratos e endpoints de backend com antecedência para evitar gargalos de integração no frontend na reta final.
* **Próximo Sprint Goal:** Implementar o incremento de monetização simulada (jornada de oferta e inscrição simulada de sessão com tutor profissional) e aprovar o backlog repriorizado de fechamento para a Release Candidate.

---

### H. Auto avaliação do grupo junto com o professor - nota do encontro

| Critério | Descrição | Máximo | Nota |
| :--- | :--- | :--- | :--- |
| **Entrega do incremento** | Resultados compatíveis com o objetivo da semana; funcionalidades/evidências demonstráveis. | 3,0 | Weslen: 3,0<br>Rafael: 3,0<br>João: 3,0<br>Rennan: 3,0<br>Augusto: 3,0 |
| **Uso do Scrum** | Backlog atualizado, objetivo claro, papéis, revisão/retrospectiva e transparência do trabalho. | 1,5 | Weslen: 1,5<br>Rafael: 1,5<br>João: 1,5<br>Rennan: 1,5<br>Augusto: 1,5 |
| **Engenharia de Software** | Qualidade das decisões de requisitos, arquitetura, código, testes, dados ou UX conforme o estágio do projeto. | 2,0 | Weslen: 2,0<br>Rafael: 2,0<br>João: 2,0<br>Rennan: 2,0<br>Augusto: 2,0 |
| **Evidências e rastreabilidade** | Links, commits, backlog e registros permettent verificar o que foi realizado. | 1,5 | Weslen: 1,5<br>Rafael: 1,5<br>João: 1,5<br>Rennan: 1,5<br>Augusto: 1,5 |
| **Produto e valor** | Equipe conecta decisões ao problema do usuário e à proposta de valor/monetização quando pertinente. | 1,0 | Weslen: 1,0<br>Rafael: 1,0<br>João: 1,0<br>Rennan: 1,0<br>Augusto: 1,0 |
| **Relato e participação** | Formulário claro, contribuições identificáveis e respostas objetivas. | 1,0 | Weslen: 1,0<br>Rafael: 1,0<br>João: 1,0<br>Rennan: 1,0<br>Augusto: 1,0 |

**NOTA DA AULA:** 10,0 / 10,0

**Comentários para o professor:**  
*Entrega da Sprint 4 realizada com integração completa de login/cadastro entre o frontend Next.js e a API FastAPI com persistência real em PostgreSQL.*
