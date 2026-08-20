$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Instalando Ambiente nexoAula (Windows)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "`n[1/4] Instalando Python 3.11..." -ForegroundColor Yellow
    winget install --id Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "`n[1/4] Python já instalado." -ForegroundColor Green
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "`n[2/4] Instalando Node.js 20 LTS..." -ForegroundColor Yellow
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "`n[2/4] Node.js já instalado." -ForegroundColor Green
}

Write-Host "`n[3/4] Configurando Back-end (FastAPI)..." -ForegroundColor Yellow
Set-Location -Path "Back-end"
if (-not (Test-Path "venv")) {
    python -m venv venv
}
& ".\venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
}
deactivate
Set-Location -Path ".."

Write-Host "`n[4/4] Configurando Front-end (Next.js)..." -ForegroundColor Yellow
Set-Location -Path "Front-end"
if (Test-Path "package.json") {
    if (Test-Path "package-lock.json") {
        npm ci
    } else {
        npm install
    }
}
Set-Location -Path ".."

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "   Ambiente configurado com sucesso!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
