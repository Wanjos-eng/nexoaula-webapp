#!/usr/bin/env bash
set -e

echo "=================================================="
echo "   Instalando Ambiente nexoAula (Linux)"
echo "=================================================="

echo -e "\n[1/4] Atualizando pacotes do sistema..."
sudo apt update -y && sudo apt install -y curl git software-properties-common build-essential

echo -e "\n[2/4] Verificando/Instalando Python 3 e venv..."
sudo apt install -y python3 python3-venv python3-pip

echo -e "\n[3/4] Verificando/Instalando Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d '.' -f 1)" != "v20" ]; then
    echo "Configurando repositório Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo -e "\n[4/4] Configurando Back-end (FastAPI)..."
cd Back-end
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
fi
deactivate
cd ..

echo -e "\n[5/5] Configurando Front-end (Next.js)..."
cd Front-end
if [ -f "package.json" ]; then
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
fi
cd ..

echo -e "\n=================================================="
echo "   Ambiente configurado com sucesso!"
echo "=================================================="
