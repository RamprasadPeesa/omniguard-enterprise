#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VS_DIR="$ROOT_DIR/vscode-extension"

command -v node >/dev/null 2>&1 || { echo "node missing" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm missing" >&2; exit 1; }

cd "$VS_DIR"
npm install
npm run compile

echo "[OmniGuard] extension compile smoke test complete"
