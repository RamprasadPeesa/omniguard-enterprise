# OmniGuard VS Code Extension — Guide and Publishing

## Installation

### From VS Code Marketplace (when published)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "OmniGuard"
4. Click Install

### From VSIX (local install)
```bash
code --install-extension omniguard-main-main/vscode-extension/omniguard-1.0.0.vsix
```

### From source
```bash
cd omniguard-main-main/vscode-extension
npm install
npm run compile
# Press F5 in VS Code to launch an Extension Development Host
```

## Configuration

Open VS Code Settings → Extensions → OmniGuard:

- **OmniGuard: API URL** — Your Supabase edge functions URL
- **OmniGuard: API Key** — Your API key (generate from dashboard → API Keys)
- **OmniGuard: Organization ID** — Your org UUID
- **OmniGuard: Fail On** — Severity threshold for editor warnings (default: high)
- **OmniGuard: Enable Real-time** — Live scanning on file save (default: true)

Or in `settings.json`:
```json
{
  "omniguard.apiUrl": "https://your-project.supabase.co/functions/v1",
  "omniguard.apiKey": "og_your_api_key",
  "omniguard.organizationId": "your_org_uuid",
  "omniguard.failOn": "high",
  "omniguard.enableRealtime": true
}
```

## Features

### Inline Security Diagnostics
The extension scans open files in real-time and shows inline diagnostics:
- Secret detection (API keys, tokens, passwords in source code)
- SAST findings (injection, XSS, insecure patterns)
- IaC issues (Terraform, CloudFormation misconfigurations)
- Dependency vulnerabilities (from package.json, requirements.txt)

### Problems Panel
All findings appear in VS Code's Problems panel with severity icons:
- Red = Critical
- Orange = High
- Yellow = Medium
- Blue = Low/Info

### Quick Fix Suggestions
Click on a diagnostic to see AI-powered remediation suggestions (requires AI provider configured).

### Status Bar
The status bar shows:
- Current scan status (idle/scanning/error)
- Finding count for the active file
- Overall risk score for the workspace

### Commands

| Command | Description |
|---|---|
| `OmniGuard: Scan Workspace` | Run a full scan on the entire workspace |
| `OmniGuard: Scan Current File` | Scan just the active file |
| `OmniGuard: View Findings` | Open the findings web dashboard |
| `OmniGuard: Suppress Finding` | Mark a finding as false positive |
| `OmniGuard: Get AI Remediation` | Generate AI fix suggestion for a finding |
| `OmniGuard: Generate Report` | Export a security report (JSON/SARIF) |
| `OmniGuard: Configure` | Open settings |

### Sidebar View
The extension adds an "OmniGuard" panel in the sidebar with:
- **Findings Explorer** — Tree view of all findings grouped by severity
- **Scan History** — Recent scans with status and timing
- **Security Posture** — Workspace risk score and trend

## Publishing to VS Code Marketplace

### Prerequisites
- VS Code Extension CLI (`vsce`) installed: `npm install -g @vscode/vsce`
- Azure DevOps PAT (for marketplace publisher account)
- Publisher ID registered in VS Code Marketplace

### Steps

```bash
cd omniguard-main-main/vscode-extension

# 1. Update version in package.json
npm version patch

# 2. Compile
npm run compile

# 3. Login to publisher (first time only)
vsce login your-publisher-id

# 4. Package and verify
vsce package

# 5. Publish
vsce publish

# Or publish specific version:
vsce publish 1.0.1
```

### Automated Publishing Script

```bash
#!/bin/bash
set -euo pipefail

cd omniguard-main-main/vscode-extension

# Install vsce if needed
npm install -g @vscode/vsce

# Compile
npm run compile

# Bump version
npm version patch --no-git-tag-version

# Publish
vsce publish

echo "Extension published to VS Code Marketplace."
```

Save as `scripts/deploy-vscode.sh`.

## Extension Architecture

```
vscode-extension/
├── src/
│   └── extension.ts     # Main extension entry point
├── out/
│   └── extension.js     # Compiled output (committed)
├── media/
│   └── icon.png         # Extension icon
├── package.json         # Extension manifest (commands, views, settings)
├── views.json           # View container definitions
├── tsconfig.json
└── .vscodeignore        # Files to exclude from VSIX package
```

The extension:
1. Activates on workspace open
2. Registers diagnostics provider for file types
3. Runs scanners on file save (if real-time enabled)
4. Shows findings as VS Code diagnostics (squiggly underlines)
5. Communicates with Supabase edge functions for scan upload and AI remediation
6. Provides tree views for findings explorer and scan history
