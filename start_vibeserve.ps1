# VibeServe startup script — sets required env vars before launching.
# Use: powershell -ExecutionPolicy Bypass -File start_vibeserve.ps1

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

# 1. Load .env (takes precedence over API.txt)
$envFile = Join-Path $repoRoot ".env"
if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line -match "^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$") {
            $name = $Matches[1]
            $val = $Matches[2]
            if ($val -and -not $val.StartsWith("#")) {
                Set-Item -Path "Env:$name" -Value $val
                Write-Host "  .env set $name"
            }
        }
    }
}

# 2. If real LLM keys are still missing, try to read them from API.txt
#    Format: "Label: value" or "Label value" — we look for known prefixes.
$apiFile = Join-Path $repoRoot "API.txt"
if (Test-Path -LiteralPath $apiFile) {
    $apiContent = Get-Content -LiteralPath $apiFile -Encoding UTF8

    # Helper: set env var from API.txt if not already set
    $keysToLoad = @(
        @{ Name = "GOOGLE_API_KEY";    Pattern = "^\s*gemini\s*:" },
        @{ Name = "DEEPSEEK_API_KEY";  Pattern = "^\s*deepseek\s*:" },
        @{ Name = "OLLAMA_API_KEY";    Pattern = "^\s*OLLAMA API\s*:" },
        @{ Name = "OPENROUTER_API_KEY"; Pattern = "^\s*openrouter\s*:" },
        @{ Name = "MISTRAL_API_KEY";   Pattern = "^\s*Mistral API\s*:" },
        @{ Name = "STRIPE_SECRET_KEY"; Pattern = "^\s*stripe sec\s*:" }
    )

    foreach ($k in $keysToLoad) {
        $envName = $k.Name
        $pattern = $k.Pattern
        if (Test-Path "Env:$envName") { continue }
        $match = $apiContent | Select-String -Pattern $pattern | Select-Object -First 1
        if ($match) {
            $value = ($match -split ":", 2)[1].Trim()
            if ($value) {
                Set-Item -Path "Env:$envName" -Value $value
                Write-Host "  API.txt set $envName"
            }
        }
    }
}

# Fallback defaults so the server can always start
if (-not $env:VIBESERVE_API_SECRET) { $env:VIBESERVE_API_SECRET = "benchmark-secret-2024" }
if (-not $env:VIBESERVE_MUTLY_API_KEY) { $env:VIBESERVE_MUTLY_API_KEY = $env:VIBESERVE_API_SECRET }
if (-not $env:VIBESERVE_HTTP_PORT) { $env:VIBESERVE_HTTP_PORT = "8000" }
if (-not $env:OLLAMA_MODEL) { $env:OLLAMA_MODEL = "gemma3:12b" }

# Default provider: prefer the working one (ollama has active credits).
# gemini and deepseek have free tiers that may be exhausted, so fall back.
if (-not $env:DEFAULT_LLM_PROVIDER) {
    if ($env:OLLAMA_API_KEY) { $env:DEFAULT_LLM_PROVIDER = "ollama" }
    elseif ($env:OPENROUTER_API_KEY) { $env:DEFAULT_LLM_PROVIDER = "openrouter" }
    elseif ($env:OPENAI_API_KEY) { $env:DEFAULT_LLM_PROVIDER = "openai" }
    elseif ($env:GOOGLE_API_KEY) { $env:DEFAULT_LLM_PROVIDER = "gemini" }
    elseif ($env:DEEPSEEK_API_KEY) { $env:DEFAULT_LLM_PROVIDER = "deepseek" }
    else { $env:DEFAULT_LLM_PROVIDER = "mock" }
}

# Benchmark-friendly rate limit (default 60 is too low for a 30-task harness)
if (-not $env:VIBESERVE_LLM_RPM) { $env:VIBESERVE_LLM_RPM = "600" }

Write-Host ""
Write-Host "  Configuration:"
Write-Host "    VIBESERVE_HTTP_PORT:   $($env:VIBESERVE_HTTP_PORT)"
Write-Host "    DEFAULT_LLM_PROVIDER:  $($env:DEFAULT_LLM_PROVIDER)"
Write-Host "    Has GOOGLE_API_KEY:    $([bool]$env:GOOGLE_API_KEY)"
Write-Host "    Has DEEPSEEK_API_KEY:  $([bool]$env:DEEPSEEK_API_KEY)"
Write-Host "    Has OLLAMA_API_KEY:    $([bool]$env:OLLAMA_API_KEY)"
Write-Host "    Has OPENROUTER_API_KEY:$([bool]$env:OPENROUTER_API_KEY)"
Write-Host ""
Write-Host "Starting VibeServe HTTP bridge on port $($env:VIBESERVE_HTTP_PORT)..."
Set-Location -LiteralPath (Join-Path $repoRoot "VibeServe-main")
& python -m vibeserve --http
