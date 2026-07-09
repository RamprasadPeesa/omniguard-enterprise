#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/vscode-extension"

npm run compile
npx vsce package --no-yarn
echo "VS Code extension packaged."
echo "Publish with: npx vsce publish --no-yarn"
echo "Before publishing, ensure the publisher in package.json matches your Marketplace account."
