$repoRoot = "C:\Users\User\Desktop\Coding Trio"
$env:VIBESERVE_API_SECRET = "benchmark-secret-2024"
$env:VIBESERVE_MUTLY_API_KEY = $env:VIBESERVE_API_SECRET
$env:VIBESERVE_HTTP_PORT = "8000"
$env:OLLAMA_MODEL = "gemma3:12b"
$env:DEFAULT_LLM_PROVIDER = "ollama"
$env:OLLAMA_API_KEY = "6d0894030f144a688a6374b2b5b9a384.ioLfc1axbBTzQcBl4Qe79M-X"
$env:VIBESERVE_LLM_RPM = "600"
$env:PYTHONPATH = "$repoRoot\VibeServe-main"
Set-Location -LiteralPath "$repoRoot\VibeServe-main"
& "C:\Program Files\Python312\python.exe" -m vibeserve --http
