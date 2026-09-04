# Referência da Modelagem de Dados

A base de dados oficial do nexoAula é estruturada em **PostgreSQL**, contendo um total de 45 tabelas e 98 referências (Foreign Keys/Constraints), separando rigidamente o catálogo acadêmico institucional, o ciclo dinâmico de aulas e a camada comercial/comunitária.

## Acesso ao Contrato DBML
O versionamento textual e estrito do modelo encontra-se em formato DBML na pasta de diagramas do repositório:

👉 **[Acessar o Modelo de Dados Oficial](../diagrams/nexoaula.dbml)**

### Instruções de Visualização Gráfica
Para renderizar e inspecionar o diagrama completo:
1. Copie todo o conteúdo do arquivo `nexoaula.dbml`.
2. Acesse a ferramenta [dbdiagram.io](https://dbdiagram.io).
3. Cole o script na interface de importação/edição para validação visual dos relacionamentos e dos módulos (`TableGroup`).