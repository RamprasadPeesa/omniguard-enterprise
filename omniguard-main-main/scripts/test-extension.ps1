$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Vs = Join-Path $Root "vscode-extension"

Push-Location $Vs
npm install
npm run compile
Pop-Location

Write-Host "[OmniGuard] extension compile smoke test complete"
