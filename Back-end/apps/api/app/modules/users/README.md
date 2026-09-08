# Módulo Users

Este módulo é o dono da identidade persistida e do perfil básico. Outros módulos,
inclusive Auth, devem consumir `UserService` e os contratos exportados por
`app.modules.users`; não devem acessar o repository SQLAlchemy nem criar um modelo
de usuário paralelo.

## Responsabilidades

- normalizar e consultar e-mail sem diferença de caixa;
- criar usuário com perfil opcional na mesma unidade de trabalho;
- padronizar conflito, ausência e falha de persistência;
- manter SQLAlchemy restrito a `infrastructure/`.

O service recebe uma factory de `UserUnitOfWork`, o que permite testes unitários
sem banco. A implementação `SqlAlchemyUserUnitOfWork` gerencia sessão, commit,
rollback e tradução da constraint `uq_users_email_ci` para erro público estável.

Cadastro HTTP, validação de senha e hashing pertencem ao módulo Auth. O
`password_hash` é um valor opaco recebido desse caso de uso; Users nunca recebe
ou persiste senha em texto puro. Cookies e JWT permanecem reservados ao fluxo de
login definido no ADR-0002.
