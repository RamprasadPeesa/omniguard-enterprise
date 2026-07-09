$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Cli = Join-Path $Root "cli"

Push-Location $Cli
npm install
npm link
node src/index.js version
node src/index.js doctor
node src/index.js status
Pop-Location

Write-Host "[OmniGuard] CLI smoke test complete"
