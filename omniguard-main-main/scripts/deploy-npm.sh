#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Building dashboard..."
cd "$ROOT/omniguard"
npm run build

echo "Packing CLI..."
cd "$ROOT/cli"
npm pack

echo "Publishing checklist:"
echo "  - Verify the package name in cli/package.json"
echo "  - Set npm auth locally with: npm login"
echo "  - Publish from the CLI package directory with: npm publish --access public"
echo "  - Do not reuse long-lived npm tokens in shared shells"
