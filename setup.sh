#!/usr/bin/env bash

set -e

echo "=== [Setup nexoAula] Iniciando verificação e configuração do ambiente ==="

# 1. Atualizar repositórios do sistema
echo "--> Atualizando lista de pacotes..."
sudo apt-get update -y

# 2. Verificar/Instalar Python 3.11 e venv
if ! command -v python3.11 &> /dev/null; then
    echo "--> Python 3.11 não encontrado. Instalando..."
    sudo apt-get install -y software-properties-common
    sudo add-apt-repository -y ppa:deadsnakes/ppa
    sudo apt-get update -y
    sudo apt-get install -y python3.11 python3.11-venv python3.11-dev
else
    echo "--> Python 3.11 já instalado."
fi

# 3. Verificar/Instalar Node.js 22.13 LTS ou Node.js 24+ e NPM
node_is_compatible() {
    command -v node &> /dev/null && node -e '
        const [major, minor] = process.versions.node.split(".").map(Number);
        process.exit((major === 22 && minor >= 13) || major >= 24 ? 0 : 1);
    '
}

if ! node_is_compatible; then
    echo "--> Instalando/Atualizando Node.js para a versão 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "--> Node.js compatível já instalado ($(node -v))."
fi

# 4. Configuração do Back-end
echo "--> Configurando ambiente do Back-end..."
if [ -d "Back-end" ]; then
    cd Back-end
    if [ ! -d "venv" ]; then
        python3.11 -m venv venv
    fi
    source venv/bin/activate
    pip install --upgrade pip
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    fi
    deactivate
    cd ..
else
    echo "Aviso: Diretório Back-end não encontrado."
fi

# 5. Configuração do Front-end
echo "--> Configurando dependências do Front-end..."
if [ -f "Front-end/package.json" ]; then
    (
        cd Front-end
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
    )
else
    echo "Aviso: Aplicação frontend não encontrada em Front-end."
fi

echo "=== [Setup nexoAula] Ambiente configurado com sucesso! ==="
