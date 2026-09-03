#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
api_path="$repo_root/Back-end/apps/api"
frontend_path="$repo_root/Front-end"
target="all"
python_command="${PYTHON_EXECUTABLE:-python3.11}"
check_only=false

fail() { printf '%s\n' "$*" >&2; exit 1; }
trap 'printf "Setup interrompido: comando falhou (linha %s).\n" "$LINENO" >&2' ERR

while (($#)); do
    case "$1" in
        --target)
            (($# >= 2)) || fail 'Informe all, backend ou frontend depois de --target.'
            target="$2"; shift 2 ;;
        --python)
            (($# >= 2)) || fail 'Informe o executavel Python 3.11 depois de --python.'
            python_command="$2"; shift 2 ;;
        --check) check_only=true; shift ;;
        *) fail "Argumento desconhecido: $1" ;;
    esac
done
case "$target" in all|backend|frontend) ;; *) fail 'Target invalido: use all, backend ou frontend.' ;; esac

assert_python311() {
    "$1" -c 'import sys; print(sys.version); sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)' ||
        fail 'Python incompativel ou indisponivel: use Python 3.11 e indique --python se necessario.'
}

# Valide tudo antes de instalar; nao instale runtimes globais com sudo/winget.
if [[ "$target" != frontend ]]; then
    [[ -f "$api_path/requirements.txt" ]] || fail 'Requirements da API ausente.'
    assert_python311 "$python_command"
    venv_path="$api_path/.venv"
    case "${OSTYPE:-}" in
        msys*|cygwin*) venv_python="$venv_path/Scripts/python.exe" ;;
        *) venv_python="$venv_path/bin/python" ;;
    esac
    if [[ -e "$venv_path" ]]; then assert_python311 "$venv_python"; fi
fi
if [[ "$target" != backend ]]; then
    [[ -f "$frontend_path/package.json" && -f "$frontend_path/package-lock.json" ]] ||
        fail 'package.json/package-lock.json do frontend ausente.'
    node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 13) || major === 24)) { console.error("Use Node.js 22.13+ (22.x) ou 24.x."); process.exit(1); } console.log(process.version);'
    npm --version
fi
if "$check_only"; then
    printf 'Pre-requisitos verificados. Nenhuma dependencia foi instalada.\n'
    exit 0
fi
if [[ "$target" != frontend ]]; then
    if [[ ! -e "$venv_path" ]]; then "$python_command" -m venv "$venv_path"; fi
    "$venv_python" -m pip install -r "$api_path/requirements.txt"
    "$venv_python" -m pip check
fi
if [[ "$target" != backend ]]; then
    (cd -- "$frontend_path" && npm ci)
fi
printf 'Setup concluido para: %s.\n' "$target"
