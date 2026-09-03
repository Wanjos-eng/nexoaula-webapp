[CmdletBinding()]
param(
    [ValidateSet('All', 'Backend', 'Frontend')]
    [string]$Target = 'All',
    [string]$PythonExecutable = '',
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = $PSScriptRoot
$apiPath = Join-Path $repoRoot 'Back-end/apps/api'
$frontendPath = Join-Path $repoRoot 'Front-end'
$setupBackend = $Target -ne 'Frontend'
$setupFrontend = $Target -ne 'Backend'

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Comando '$Executable' falhou (exit $LASTEXITCODE). Setup interrompido."
    }
}

function Assert-Python311 {
    param([string]$Executable, [string[]]$Prefix = @())
    Invoke-Checked $Executable ($Prefix + @('-c', 'import sys; print(sys.version); sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)'))
}

try {
    # Valide todos os pre-requisitos antes de instalar qualquer dependencia.
    if ($setupBackend) {
        if (-not (Test-Path -LiteralPath (Join-Path $apiPath 'requirements.txt') -PathType Leaf)) {
            throw 'Requirements da API ausente em Back-end/apps/api/requirements.txt.'
        }
        $pythonPrefix = @()
        if ($PythonExecutable) {
            $pythonCommand = $PythonExecutable
        } elseif (Get-Command py -ErrorAction SilentlyContinue) {
            $pythonCommand = 'py'
            $pythonPrefix = @('-3.11')
        } elseif (Get-Command python3.11 -ErrorAction SilentlyContinue) {
            $pythonCommand = 'python3.11'
        } else {
            $pythonCommand = 'python'
        }
        Write-Host 'Verificando Python 3.11 (use -PythonExecutable para indicar o executavel)...'
        Assert-Python311 $pythonCommand $pythonPrefix
        $venvPath = Join-Path $apiPath '.venv'
        $venvPython = Join-Path $venvPath 'Scripts/python.exe'
        if (Test-Path -LiteralPath $venvPath) {
            # Nao reutilize silenciosamente um ambiente de outra versao.
            Assert-Python311 $venvPython
        }
    }
    if ($setupFrontend) {
        foreach ($file in @('package.json', 'package-lock.json')) {
            if (-not (Test-Path -LiteralPath (Join-Path $frontendPath $file) -PathType Leaf)) {
                throw "Arquivo obrigatorio ausente: Front-end/$file."
            }
        }
        Invoke-Checked 'node' @('-e', 'const [major, minor] = process.versions.node.split(".").map(Number); if (!((major === 22 && minor >= 13) || major === 24)) { console.error("Use Node.js 22.13+ (22.x) ou 24.x."); process.exit(1); } console.log(process.version);')
        Invoke-Checked 'npm.cmd' @('--version')
    }
    if ($Check) {
        Write-Host 'Pre-requisitos verificados. Nenhuma dependencia foi instalada.'
        exit 0
    }
    if ($setupBackend) {
        if (-not (Test-Path -LiteralPath $venvPath)) {
            Invoke-Checked $pythonCommand ($pythonPrefix + @('-m', 'venv', $venvPath))
        }
        Invoke-Checked $venvPython @('-m', 'pip', 'install', '-r', (Join-Path $apiPath 'requirements.txt'))
        Invoke-Checked $venvPython @('-m', 'pip', 'check')
    }
    if ($setupFrontend) {
        Push-Location -LiteralPath $frontendPath
        try {
            Invoke-Checked 'npm.cmd' @('ci')
        } finally {
            Pop-Location
        }
    }
    Write-Host "Setup concluido para: $Target."
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
