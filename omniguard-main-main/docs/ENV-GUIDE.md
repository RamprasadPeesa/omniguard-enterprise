# OmniGuard — Environment Variables Guide

## Required (Frontend)

These two variables are **required** for the web app to start. They are public-safe (exposed to the browser by design — the anon key is scoped by RLS policies).

```bash
# .env (in omniguard/ directory — same folder as vite.config.ts)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Required (Edge Functions)

These are **server-side only** — never prefix with `VITE_`. They are automatically configured by the Supabase platform when edge functions are deployed. Do NOT set them manually unless running functions locally with `supabase functions serve`.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Optional (AI Providers)

Configure at least one AI provider to enable AI-powered remediation, classification, and summaries.

```bash
# Default AI provider (anthropic | openai | azure | gemini | openrouter | ollama)
AI_PROVIDER=anthropic

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxx

# OpenAI GPT
OPENAI_API_KEY=sk-xxxxxxxxx

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_KEY=your_azure_key

# Google Gemini
GEMINI_API_KEY=your_gemini_key

# OpenRouter (multi-provider)
OPENROUTER_API_KEY=sk-or-xxxxxxxxx

# Ollama (local, no API key needed)
OLLAMA_URL=http://localhost:11434
```

## Optional (Cloud Provider Integrations)

```bash
# AWS
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Azure DevOps
AZURE_DEVOPS_ORG=your-org
AZURE_DEVOPS_PAT=your_personal_access_token
```

## Optional (Git Provider Integrations)

```bash
# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxx

# GitLab
GITLAB_TOKEN=glpat-xxxxxxxxx
```

## Optional (ITSM / Collaboration Integrations)

```bash
# Jira
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your_api_token

# Confluence
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_EMAIL=you@company.com
CONFLUENCE_API_TOKEN=your_api_token

# ServiceNow
SERVICENOW_INSTANCE=yourcompany.service-now.com
SERVICENOW_USERNAME=your_username
SERVICENOW_PASSWORD=your_password
```

## Optional (Enterprise SSO — Okta)

```bash
OKTA_DOMAIN=yourcompany.okta.com
OKTA_ISSUER=https://yourcompany.okta.com/oauth2/default
OKTA_CLIENT_ID=your_okta_client_id
OKTA_CLIENT_SECRET=your_okta_client_secret
OKTA_REDIRECT_URI=http://localhost:5173/login
OKTA_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/
```

## Optional (CLI / VS Code Extension)

These are set by end-users after installing the CLI or extension. They configure where the tooling points.

```bash
# API endpoint (your Supabase edge functions URL)
OMNIGUARD_URL=https://your-project.supabase.co/functions/v1
OMNIGUARD_DASHBOARD_URL=https://your-project.supabase.co

# API key (generated from the dashboard → API Keys page)
OMNIGUARD_API_KEY=og_your_api_key_here

# Organization ID (found in dashboard → Organizations)
OMNIGUARD_ORG_ID=your_org_uuid

# Fail CI/CD on severity threshold (critical | high | medium | low | none)
OMNIGUARD_FAIL_ON=critical

# Default AI provider for CLI scans
OMNIGUARD_DEFAULT_PROVIDER=anthropic
```

## App URL

```bash
# Used for email redirects and integration callback URLs
APP_URL=http://localhost:5173
VITE_APP_URL=http://localhost:5173
```

## Summary: What You Actually Need

| Environment | Variables Required |
|---|---|
| **Local Dev (minimum)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Local Dev (with AI)** | Above + `AI_PROVIDER` + one AI provider key (e.g. `ANTHROPIC_API_KEY`) |
| **Production** | All Supabase vars + AI provider keys + any integration keys you use |
| **CLI Only** | `OMNIGUARD_URL`, `OMNIGUARD_API_KEY`, `OMNIGUARD_ORG_ID` |
| **Extension Only** | Same as CLI |
