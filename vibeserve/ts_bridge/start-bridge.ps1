# Start VibeServe TypeScript Bridge (Windows)
# This script launches the TypeScript-native Hono HTTP bridge
# as an alternative to the Python HTTP bridge.
#
# Usage:
#   .\start-bridge.ps1                    # default port 8000
#   .\start-bridge.ps1 -Port 9000         # custom port
#   .\start-bridge.ps1 -Python "python3"  # custom Python path

param(
    [int]$Port = 8000,
    [string]$Python = "python",
    [string]$BindHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $bridgeDir "..\..")

Write-Host "=== VibeServe TypeScript Bridge ==="
Write-Host "Project root : $projectRoot"
Write-Host "Bridge port  : $Port"
Write-Host "Python path  : $Python"
Write-Host ""

$env:VIBESERVE_HTTP_PORT = $Port.ToString()
$env:VIBESERVE_HTTP_HOST = $BindHost
$env:VIBESERVE_PYTHON_PATH = $Python
$env:VIBESERVE_PROJECT_ROOT = $projectRoot

Set-Location -LiteralPath $bridgeDir

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

Write-Host "Starting bridge..."
npx tsx bridge.ts
