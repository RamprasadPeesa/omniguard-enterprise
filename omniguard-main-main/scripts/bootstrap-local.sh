#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OMNI_DIR="$ROOT_DIR/omniguard"
CLI_DIR="$ROOT_DIR/cli"
VSCODE_DIR="$ROOT_DIR/vscode-extension"

need() { command -v "$1" >/dev/null 2>&1 || { echo "[OmniGuard] missing $1" >&2; exit 1; }; }
need node
need npm
need git

echo "[OmniGuard] installing dashboard deps"
cd "$OMNI_DIR" && npm install

echo "[OmniGuard] installing cli deps"
cd "$CLI_DIR" && npm install

echo "[OmniGuard] installing extension deps"
cd "$VSCODE_DIR" && npm install

echo "[OmniGuard] linking local CLI"
cd "$CLI_DIR" && npm link
cd "$VSCODE_DIR" && npm link omniguard || true
cd "$OMNI_DIR" && npm link omniguard || true

if [[ "${PUBLISH_NPM:-false}" == "true" ]]; then
  if [[ -z "${NPM_TOKEN:-}" ]]; then
    echo "[OmniGuard] PUBLISH_NPM=true but NPM_TOKEN is missing" >&2
    exit 1
  fi
  echo "[OmniGuard] publishing CLI package"
  cd "$CLI_DIR"
  npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN" >/dev/null
  npm publish --access public
fi

if [[ "${DEPLOY_SUPABASE:-false}" == "true" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "[OmniGuard] Supabase CLI not found; skipping backend deploy" >&2
  else
    echo "[OmniGuard] deploying Supabase edge functions"
    cd "$ROOT_DIR/supabase"
    supabase functions deploy api-v1-api-keys api-v1-members api-v1-findings api-v1-scans api-v1-status enterprise-integrations github-webhook notify-deliver policy-ingest scan-quick scan-worker secrets-proxy api-gateway
  fi
fi

if [[ "${RUN_DASHBOARD:-true}" == "true" ]]; then
  echo "[OmniGuard] starting dashboard"
  cd "$OMNI_DIR"
  npm run dev
fi
