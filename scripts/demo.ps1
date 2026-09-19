[CmdletBinding()]
param(
    [ValidateSet('up', 'check', 'logs', 'down')]
    [string]$Command = 'up',
    [ValidateSet('db', 'api', 'web')]
    [string]$Service = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = Split-Path -Parent $PSScriptRoot
$webPort = if ($env:WEB_PORT) { $env:WEB_PORT } else { '3000' }
$apiPort = if ($env:API_PORT) { $env:API_PORT } else { '8000' }

function Invoke-Compose {
    param([string[]]$Arguments)
    Push-Location $repoRoot
    try {
        & docker compose @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose falhou (exit $LASTEXITCODE). Verifique se o Docker Desktop esta em execucao e consulte: docker compose logs"
        }
    } finally {
        Pop-Location
    }
}

function Test-HttpEndpoint {
    param([string]$Uri, [string]$Name)
    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
            throw "HTTP $($response.StatusCode)"
        }
        Write-Host "[ok] ${Name}: $($response.StatusCode)"
    } catch {
        throw "[falha] $Name indisponivel em $Uri. Consulte 'docker compose logs $Name'. Causa: $($_.Exception.Message)"
    }
}

try {
    switch ($Command) {
        'up' {
            Invoke-Compose @('up', '-d', '--wait')
            Invoke-Compose @('ps')
            Write-Host 'Ambiente integrado iniciado. Execute .\scripts\demo.ps1 check para o smoke test.'
        }
        'check' {
            Invoke-Compose @('ps')
            Invoke-Compose @('exec', '-T', 'db', 'pg_isready')
            Test-HttpEndpoint "http://127.0.0.1:${apiPort}/health" 'api'
            Test-HttpEndpoint "http://127.0.0.1:${webPort}" 'web'
            Write-Host 'Smoke test do ambiente integrado aprovado.'
        }
        'logs' {
            $logArguments = @('logs', '--tail=100')
            if ($Service) { $logArguments += $Service }
            Invoke-Compose $logArguments
        }
        'down' {
            Invoke-Compose @('down')
            Write-Host 'Ambiente encerrado; o volume postgres_data foi preservado.'
        }
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
