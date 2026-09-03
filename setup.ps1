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
    param([string]$Executable, [string[]]$Arguments, [string]$Hint = 'Consulte docs/environment/setup.md para diagnostico e repita o setup apos corrigir a causa.')
    if (-not (Get-Command $Executable -ErrorAction SilentlyContinue)) {
        throw "Ferramenta ausente: $Executable. $Hint"
    }
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Comando '$Executable' falhou (exit $LASTEXITCODE). Setup interrompido. $Hint"
    }
}

function Assert-Python311 {
    param([string]$Executable, [string[]]$Prefix = @())
    Invoke-Checked $Executable ($Prefix + @('-c', 'import sys; print(sys.version); sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)')) 'Instale Python 3.11 com pip/venv, reabra o terminal ou indique -PythonExecutable. Se .venv ja existe com outra versao, revise e recrie manualmente; o script nao apaga ambientes.'
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'setup.ps1 suporta Windows. No Linux use bash setup.sh. Veja docs/environment/setup.md.' }
    # Valide todos os pre-requisitos antes de instalar qualquer dependencia.
    if ($setupBackend) {
        if (-not (Test-Path -LiteralPath (Join-Path $apiPath 'requirements.txt') -PathType Leaf)) {
            throw 'Requirements da API ausente em Back-end/apps/api/requirements.txt. Use um clone completo e atualizado do repositorio.'
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
                throw "Arquivo obrigatorio ausente: Front-end/$file. Use um clone completo e atualizado; nao gere um lockfile novo para contornar a falha."
            }
        }
        # Aspas simples no JavaScript sobrevivem ao repasse nativo do PowerShell 5.1.
        Invoke-Checked 'node' @('-e', 'const [major, minor] = process.versions.node.split(''.'').map(Number); if (!((major === 22 && minor >= 13) || major === 24)) { console.error(''Use Node.js 22.13+ (22.x) ou 24.x.''); process.exit(1); } console.log(process.version);') 'Instale Node.js 22.13+ (22.x) ou 24.x com npm e reabra o terminal para atualizar o PATH.'
        Invoke-Checked 'npm.cmd' @('--version') 'Instale/repare o npm junto ao Node.js e reabra o terminal. No Windows o setup usa npm.cmd para evitar bloqueio de npm.ps1.'
    }
    if ($Check) {
        Write-Host 'Pre-requisitos verificados. Nenhuma dependencia foi instalada.'
        exit 0
    }
    if ($setupBackend) {
        if (-not (Test-Path -LiteralPath $venvPath)) {
            Invoke-Checked $pythonCommand ($pythonPrefix + @('-m', 'venv', $venvPath)) 'Confira suporte a venv/ensurepip no Python 3.11 e permissao de escrita na pasta da API. Use um caminho curto no Windows. Nao execute como administrador para contornar permissao do clone.'
        }
        Invoke-Checked $venvPython @('-m', 'pip', 'install', '-r', (Join-Path $apiPath 'requirements.txt')) 'Confira rede/proxy, disponibilidade das versoes em requirements.txt e permissao de escrita em .venv. Corrija a causa e repita -Target Backend; nao altere pins automaticamente.'
        Invoke-Checked $venvPython @('-m', 'pip', 'check') 'Revise os conflitos reportados no ambiente .venv da API; nao tente corrigi-los instalando pacotes globais.'
    }
    if ($setupFrontend) {
        Push-Location -LiteralPath $frontendPath
        try {
            Invoke-Checked 'npm.cmd' @('ci') 'Confira rede/proxy, escrita em Front-end e consistencia de package.json/package-lock.json. Feche processos que bloqueiem node_modules e repita -Target Frontend; nao substitua npm ci por npm install para esconder divergencias.'
        } finally {
            Pop-Location
        }
    }
    Write-Host "Setup concluido para: $Target."
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
