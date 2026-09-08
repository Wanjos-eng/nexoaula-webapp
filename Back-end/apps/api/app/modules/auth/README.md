# Módulo Auth

O módulo Auth coordena os contratos HTTP de autenticação sem criar uma identidade
paralela. Ele consome somente a interface pública de `app.modules.users`; acesso
ao SQLAlchemy e controle transacional continuam encapsulados pelo módulo Users.

## Cadastro disponível

`POST /api/v1/auth/register` recebe:

```json
{
  "fullName": "Lucas Almeida",
  "email": "lucas@example.com",
  "password": "uma-senha-segura"
}
```

- nome: de 3 a 120 caracteres após normalização dos espaços;
- e-mail: sintaxe válida, limitado a 320 caracteres e normalizado por Users;
- senha: de 8 a 72 caracteres e no máximo 72 bytes, limite seguro do bcrypt;
- campos desconhecidos são rejeitados.

A senha é recebida como `SecretStr`, transformada em bcrypt antes de atravessar a
fronteira de Users e nunca aparece na representação pública, em erros de
validação ou na documentação de resposta. O cadastro cria o perfil mínimo com o
nome na mesma transação da identidade.

O sucesso retorna `201` e apenas `id`, `email`, `fullName` e `createdAt`.
Duplicidade retorna `409`, entrada inválida retorna `422` e indisponibilidade de
persistência retorna `503`. As respostas não são armazenáveis em cache.

Conforme o ADR-0002, cadastro não emite JWT, não cria cookie e não autentica
automaticamente. Login, sessão, recuperação de senha, aceite de termos e
confirmação de senha não fazem parte deste endpoint.
