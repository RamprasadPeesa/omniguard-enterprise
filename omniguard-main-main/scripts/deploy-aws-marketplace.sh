#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "AWS Marketplace deployment helper"
echo "This script validates the build artifacts and prints the next required inputs."

cd "$ROOT/omniguard"
npm run build

echo "Required before publishing:"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - AWS_DEFAULT_REGION"
echo "  - Marketplace listing/product code"
echo "  - AMI/container artifact target"
echo "  - Pricing and fulfillment model"
echo "  - Support contact and legal metadata"
echo "Once you provide these, I can wire the publish step into the script."
