#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
api_path="$repo_root/Back-end/apps/api"
frontend_path="$repo_root/Front-end"
target="all"
python_command="${PYTHON_EXECUTABLE:-python3.11}"
check_only=false

fail() { printf '%s\n' "$*" >&2; exit 1; }
trap 'printf "Setup interrompido: comando falhou (linha %s). Consulte docs/environment/setup.md e corrija a causa antes de repetir.\n" "$LINENO" >&2' ERR

require_tool() {
    command -v "$1" >/dev/null 2>&1 || fail "Ferramenta ausente: $1. $2"
}
case "${OSTYPE:-}" in
    linux*|msys*) ;;
    *) fail 'Sistema nao validado. Use Linux ou Git Bash no Windows; veja docs/environment/setup.md.' ;;
esac

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
    require_tool "$1" 'Instale Python 3.11 com pip/venv e indique --python /caminho/python3.11 se necessario.'
    "$1" -c 'import sys; print(sys.version); sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)' ||
        fail 'Python incompativel: use Python 3.11 e indique --python. Se .venv ja existe, revise e recrie manualmente; o script nao apaga ambientes.'
}

# Valide tudo antes de instalar; nao instale runtimes globais com sudo/winget.
if [[ "$target" != frontend ]]; then
    [[ -f "$api_path/requirements.txt" ]] || fail 'Requirements da API ausente. Use um clone completo e atualizado com Back-end/apps/api/requirements.txt.'
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
        fail 'package.json/package-lock.json do frontend ausente. Use um clone completo e atualizado; nao gere outro lockfile para contornar a falha.'
    require_tool node 'Instale Node.js 22.13+ (22.x) ou 24.x com npm e reabra o terminal para atualizar o PATH.'
    require_tool npm 'Instale/repare o npm junto ao Node.js e reabra o terminal.'
    node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 13) || major === 24)) { console.error("Use Node.js 22.13+ (22.x) ou 24.x."); process.exit(1); } console.log(process.version);' || fail 'Node incompativel. Selecione Node.js 22.13+ (22.x) ou 24.x no seu gerenciador de versoes e reabra o terminal.'
    npm --version || fail 'npm nao executa. Repare a instalacao do npm junto ao Node.js e confira o PATH.'
fi
if "$check_only"; then
    printf 'Pre-requisitos verificados. Nenhuma dependencia foi instalada.\n'
    exit 0
fi
if [[ "$target" != frontend ]]; then
    if [[ ! -e "$venv_path" ]]; then
        "$python_command" -m venv "$venv_path" || fail 'Nao foi possivel criar .venv. Instale o suporte venv/ensurepip do Python 3.11 e confira escrita na pasta da API. Nao rode o setup com sudo; veja docs/environment/setup.md.'
    fi
    "$venv_python" -m pip install -r "$api_path/requirements.txt" || fail 'pip install falhou. Confira rede/proxy, versoes do requirements.txt e escrita em .venv; corrija e repita --target backend sem alterar pins automaticamente.'
    "$venv_python" -m pip check || fail 'pip check encontrou conflitos. Revise o ambiente .venv da API; nao instale pacotes globais para contornar a falha.'
fi
if [[ "$target" != backend ]]; then
    (cd -- "$frontend_path" && npm ci) || fail 'npm ci falhou. Confira rede/proxy, escrita em Front-end e consistencia de package.json/package-lock.json. Feche processos que bloqueiem node_modules e repita --target frontend; nao use npm install para esconder divergencias.'
fi
printf 'Setup concluido para: %s.\n' "$target"
