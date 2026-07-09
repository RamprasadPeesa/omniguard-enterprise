$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Omni = Join-Path $Root "omniguard"
$Cli = Join-Path $Root "cli"
$Vs = Join-Path $Root "vscode-extension"

function Need($cmd) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Missing $cmd" } }
Need node
Need npm

Write-Host "[OmniGuard] installing dashboard deps"
Push-Location $Omni; npm install; Pop-Location

Write-Host "[OmniGuard] installing cli deps"
Push-Location $Cli; npm install; Pop-Location

Write-Host "[OmniGuard] installing extension deps"
Push-Location $Vs; npm install; Pop-Location

Write-Host "[OmniGuard] linking local CLI"
Push-Location $Cli; npm link; Pop-Location
Push-Location $Vs; npm link omniguard | Out-Null; Pop-Location
Push-Location $Omni; npm link omniguard | Out-Null; Pop-Location

if ($env:PUBLISH_NPM -eq "true") {
  if (-not $env:NPM_TOKEN) { throw "PUBLISH_NPM=true but NPM_TOKEN is missing" }
  Push-Location $Cli
  npm config set //registry.npmjs.org/:_authToken $env:NPM_TOKEN | Out-Null
  npm publish --access public
  Pop-Location
}

if ($env:DEPLOY_SUPABASE -eq "true") {
  if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Push-Location (Join-Path $Root "supabase")
    supabase functions deploy api-v1-api-keys api-v1-members api-v1-findings api-v1-scans api-v1-status enterprise-integrations github-webhook notify-deliver policy-ingest scan-quick scan-worker secrets-proxy api-gateway
    Pop-Location
  } else {
    Write-Warning "Supabase CLI not found; skipping backend deploy"
  }
}

if ($env:RUN_DASHBOARD -ne "false") {
  Push-Location $Omni
  npm run dev
  Pop-Location
}
