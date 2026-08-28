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

# 2. Verificar/Instalar Node.js 22.13 LTS ou Node.js 24+
Write-Host "--> Verificando Node.js 22.13 LTS ou Node.js 24+..." -ForegroundColor Yellow
$nodeVersion = if (Get-Command node -ErrorAction SilentlyContinue) {
    [version]((node -v).Trim().TrimStart('v'))
} else {
    $null
}
$nodeIsCompatible = $null -ne $nodeVersion -and (
    ($nodeVersion.Major -eq 22 -and $nodeVersion -ge [version]"22.13.0") -or
    $nodeVersion.Major -ge 24
)

if (-not $nodeIsCompatible) {
    Write-Host "--> Instalando Node.js LTS via winget..." -ForegroundColor Green
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "--> Node.js compatível já instalado ($(node -v))." -ForegroundColor Green
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
if (Test-Path "Front-end/package.json") {
    Push-Location "Front-end"
    try {
        if (Test-Path "package-lock.json") {
            npm ci
        } else {
            npm install
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao instalar as dependências do frontend."
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Warning "Aplicação frontend não encontrada em Front-end."
}

Write-Host "=== [Setup nexoAula] Ambiente configurado com sucesso! ===" -ForegroundColor Cyan
