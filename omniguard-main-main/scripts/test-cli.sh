#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="$ROOT_DIR/cli"

command -v node >/dev/null 2>&1 || { echo "node missing" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm missing" >&2; exit 1; }

cd "$CLI_DIR"
npm install
npm link

node src/index.js version
node src/index.js doctor || true
node src/index.js status || true

echo "[OmniGuard] CLI smoke test complete"
