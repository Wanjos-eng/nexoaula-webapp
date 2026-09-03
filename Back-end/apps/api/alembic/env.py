"""Scaffold legado preservado; integracao de migrations ainda nao aprovada.

`alembic history` inspeciona o diretorio vazio sem executar este modulo.
Comandos que precisem de banco devem aguardar a decisao de ORM/migrations.
"""

raise RuntimeError(
    "Migrations adiadas: consulte Back-end/apps/api/alembic/README. "
    "Nenhuma conexao de banco ou migration de dominio esta configurada."
)
