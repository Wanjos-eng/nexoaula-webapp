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

# 3. Verificar/Instalar Node.js 22 LTS e NPM
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 22 ]]; then
    echo "--> Instalando/Atualizando Node.js para a versão 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "--> Node.js 22 LTS já instalado ($(node -v))."
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
if [ -d "Front-end" ]; then
    cd Front-end
    if [ -f "package.json" ]; then
        npm install
    fi
    cd ..
else
    echo "Aviso: Diretório Front-end não encontrado."
fi

echo "=== [Setup nexoAula] Ambiente configurado com sucesso! ==="