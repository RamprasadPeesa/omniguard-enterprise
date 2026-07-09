# OmniGuard CLI — Guide and Publishing

## Installation

### From npm (when published)
```bash
npm install -g @omniguard/cli
```

### From source
```bash
cd omniguard-main-main/cli
npm install
npm link
```

## Configuration

```bash
# Set your API endpoint and credentials
omniguard config set url https://your-project.supabase.co/functions/v1
omniguard config set api-key og_your_api_key_here
omniguard config set org-id your_org_uuid

# Optional: set default fail threshold
omniguard config set fail-on critical

# View current config
omniguard config list
```

Configuration is stored in `~/.omniguard/config.json`.

## Commands

### Scan a Repository

```bash
# Full scan (all scanners)
omniguard scan /path/to/repo

# Quick scan (secrets only)
omniguard scan /path/to/repo --type quick

# Specific scanner
omniguard scan /path/to/repo --scanner secrets
omniguard scan /path/to/repo --scanner sast
omniguard scan /path/to/repo --scanner dependency
omniguard scan /path/to/repo --scanner iac

# With AI remediation
omniguard scan /path/to/repo --ai

# Fail on severity threshold
omniguard scan /path/to/repo --fail-on critical
```

### CI/CD Integration

```bash
# GitHub Actions
- name: OmniGuard Security Scan
  run: |
    npm install -g @omniguard/cli
    omniguard config set url ${{ secrets.OMNIGUARD_URL }}
    omniguard config set api-key ${{ secrets.OMNIGUARD_API_KEY }}
    omniguard config set org-id ${{ secrets.OMNIGUARD_ORG_ID }}
    omniguard scan . --fail-on critical

# GitLab CI
omniguard_security:
  script:
    - npm install -g @omniguard/cli
    - omniguard config set url $OMNIGUARD_URL
    - omniguard config set api-key $OMNIGUARD_API_KEY
    - omniguard config set org-id $OMNIGUARD_ORG_ID
    - omniguard scan . --fail-on critical
```

### View Findings

```bash
# List findings for current org
omniguard findings list

# Filter by severity
omniguard findings list --severity critical

# Show specific finding
omniguard findings show <finding-id>

# Get AI remediation
omniguard findings remediate <finding-id>
```

### Manage Repositories

```bash
# List connected repositories
omniguard repos list

# Connect a repository
omniguard repos connect github owner/repo-name

# Disconnect
omniguard repos disconnect <repo-id>
```

### Generate Reports

```bash
# JSON report
omniguard report --format json > report.json

# CSV report
omniguard report --format csv > report.csv

# SARIF (for GitHub code scanning)
omniguard report --format sarif > sarif.json
```

### API Key Management

```bash
# Create a new API key
omniguard api-keys create --name "CI Pipeline" --scopes scans:write,findings:read

# List keys
omniguard api-keys list

# Revoke a key
omniguard api-keys revoke <key-id>
```

## Publishing to npm

### Prerequisites
- npm account with 2FA enabled
- Membership in the `@omniguard` org (or use unscoped name)

### Steps

```bash
cd omniguard-main-main/cli

# 1. Update version in package.json
npm version patch  # or minor / major

# 2. Build if needed (CLI is pure JS, no build step)

# 3. Login to npm
npm login

# 4. Publish
npm publish --access public

# For scoped package:
npm publish @omniguard/cli --access public
```

### Automated Publishing Script

```bash
#!/bin/bash
set -euo pipefail

cd omniguard-main-main/cli

# Bump version
npm version patch --no-git-tag-version

# Publish
npm publish --access public

echo "CLI published successfully."
```

Save as `scripts/deploy-npm.sh`.

## CLI Architecture

The CLI is a Node.js application that:
1. Reads configuration from `~/.omniguard/config.json` or env vars
2. Makes authenticated HTTP requests to Supabase edge functions
3. Runs local scanners (secret detection, SAST, dependency check) on the local filesystem
4. Uploads findings to Supabase via the API
5. Returns exit code based on `--fail-on` threshold (for CI/CD gates)
