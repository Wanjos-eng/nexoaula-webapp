$ErrorActionPreference = "Stop"

Write-Host "=== [Setup nexoAula] Iniciando verificação e configuração do ambiente ===" -ForegroundColor Cyan

# 1. Verificar/Instalar Python 3.11
Write-Host "--> Verificando Python 3.11..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue) -or ((python --version 2>&1) -notmatch "3\.11")) {
    Write-Host "--> Instalando Python 3.11 via winget..." -ForegroundColor Green
    winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "--> Python 3.11 já instalado." -ForegroundColor Green
}

# 2. Verificar/Instalar Node.js 22 LTS
Write-Host "--> Verificando Node.js 22 LTS..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or ((node -v).Split('.')[0].Replace('v','') -lt 22)) {
    Write-Host "--> Instalando Node.js LTS via winget..." -ForegroundColor Green
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "--> Node.js 22 LTS já instalado ($(node -v))." -ForegroundColor Green
}

# 3. Configuração do Back-end
Write-Host "--> Configurando ambiente do Back-end..." -ForegroundColor Yellow
if (Test-Path "Back-end") {
    Set-Location "Back-end"
    if (-not (Test-Path "venv")) {
        python -m venv venv
    }
    .\venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt
    }
    deactivate
    Set-Location ..
} else {
    Write-Warning "Diretório Back-end não encontrado."
}

# 4. Configuração do Front-end
Write-Host "--> Configurando dependências do Front-end..." -ForegroundColor Yellow
if (Test-Path "Front-end") {
    Set-Location "Front-end"
    if (Test-Path "package.json") {
        npm install
    }
    Set-Location ..
} else {
    Write-Warning "Diretório Front-end não encontrado."
}

Write-Host "=== [Setup nexoAula] Ambiente configurado com sucesso! ===" -ForegroundColor Cyan