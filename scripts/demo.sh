#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
command="${1:-up}"
web_port="${WEB_PORT:-3000}"
api_port="${API_PORT:-8000}"

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

compose() {
    (cd -- "$repo_root" && docker compose "$@") ||
        fail "docker compose falhou. Verifique se o Docker esta em execucao e consulte: docker compose logs"
}

check_http() {
    local name="$1"
    local url="$2"
    curl --fail --silent --show-error --max-time 10 "$url" >/dev/null ||
        fail "[falha] $name indisponivel em $url. Consulte 'docker compose logs $name'."
    printf '[ok] %s: HTTP 200\n' "$name"
}

case "$command" in
    up)
        compose up -d --wait
        compose ps
        printf '%s\n' 'Ambiente integrado iniciado. Execute ./scripts/demo.sh check para o smoke test.'
        ;;
    check)
        compose ps
        compose exec -T db pg_isready
        check_http api "http://127.0.0.1:${api_port}/health"
        check_http web "http://127.0.0.1:${web_port}"
        printf '%s\n' 'Smoke test do ambiente integrado aprovado.'
        ;;
    logs)
        compose logs --tail=100
        ;;
    down)
        compose down
        printf '%s\n' 'Ambiente encerrado; o volume postgres_data foi preservado.'
        ;;
    *)
        fail 'Uso: ./scripts/demo.sh {up|check|logs|down}'
        ;;
esac
