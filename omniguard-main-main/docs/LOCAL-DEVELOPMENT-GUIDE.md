# OmniGuard — Local Development Guide

## Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **npm 9+** (comes with Node 18+)
- A Supabase project (already provisioned for this project)

## Step 1: Configure Environment

Create `.env` in the `omniguard/` directory (next to `vite.config.ts`):

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_URL=http://localhost:5173
```

That's all you need for the frontend to start. The Supabase URL and anon key are in your project's `.env` file.

## Step 2: Install Dependencies

```bash
cd omniguard-main-main/omniguard
npm install
```

## Step 3: Apply Database Migrations

Migrations are applied automatically via the Supabase MCP tools. If you need to re-apply them:

1. Open the Supabase Dashboard → SQL Editor
2. Run each migration file in order from `supabase/migrations/`
3. Or use `mcp__supabase__apply_migration` to apply them programmatically

The migrations create:
- 25+ tables (organizations, repositories, scans, findings, policies, etc.)
- RLS policies on every table (org-scoped, role-based)
- Trigger functions (auto-create user profile on signup, auto-queue scans)
- Seed data (compliance frameworks: SOC 2, ISO 27001, HIPAA, PCI DSS, OWASP, NIST)

## Step 4: Deploy Edge Functions

Edge functions are deployed via `mcp__supabase__deploy_edge_function`. Each function lives in `supabase/functions/<name>/index.ts`.

Required functions:
- `api-v1-api-keys` — API key CRUD (API Keys page)
- `api-v1-members` — Team member management (Teams page)
- `api-v1-scans` — Scan API endpoints
- `api-v1-findings` — Findings API endpoints
- `scan-quick` — Trigger scans from the dashboard
- `scan-worker` — Background scan processor

## Step 5: Start the Dev Server

```bash
cd omniguard-main-main/omniguard
npm run dev
```

The app will be available at **http://localhost:5173**.

## Step 6: Create Your First Organization

1. Navigate to http://localhost:5173/signup
2. Sign up with email and password
3. You'll be redirected to the dashboard at `/app`
4. Since you have no organization yet, go to **Organizations** in the sidebar
5. Create an organization (name, plan defaults to "free")
6. You're automatically the owner of the new org
7. The dashboard will now load with real data (empty until you connect repos and run scans)

## Step 7: Connect a Repository

1. Go to **Repositories** in the sidebar
2. Click **Connect Repository**
3. Choose a provider (GitHub, GitLab, Bitbucket, Azure DevOps)
4. Enter the owner and repository name
5. Click **Connect**

## Step 8: Run a Scan

1. On the Repositories page, click **Scan Now** on any repository
2. The scan will be queued and processed by the `scan-worker` edge function
3. View results in **Scans** or **Findings** pages

## Project Structure

```
omniguard-main-main/
├── omniguard/                 # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Layout.tsx     # Sidebar, topbar, navigation
│   │   │   └── ui.tsx         # Component library (Card, StatCard, DataTable, etc.)
│   │   ├── hooks/             # React hooks
│   │   │   ├── useAuth.tsx    # Auth context (sign in, sign up, session)
│   │   │   ├── useRepositories.ts # Data hooks (repos, scans, findings, notifications)
│   │   │   └── useTheme.tsx   # Dark/light theme context
│   │   ├── lib/
│   │   │   └── supabase.ts    # Supabase client + type definitions
│   │   └── pages/             # One unique component per route
│   │       ├── Dashboard.tsx
│   │       ├── Findings.tsx
│   │       ├── Scans.tsx
│   │       ├── Repositories.tsx
│   │       ├── Organizations.tsx
│   │       ├── SecurityPosture.tsx
│   │       ├── APIKeysPage.tsx
│   │       ├── Teams.tsx
│   │       ├── Policies.tsx
│   │       ├── Compliance.tsx
│   │       └── ... (19 pages total)
│   ├── vite.config.ts
│   └── package.json
├── supabase/
│   ├── functions/             # Edge functions (Deno)
│   │   ├── api-v1-api-keys/
│   │   ├── api-v1-members/
│   │   ├── scan-quick/
│   │   ├── scan-worker/
│   │   └── ...
│   └── migrations/            # SQL migrations
├── cli/                       # CLI tool (Node.js)
├── vscode-extension/          # VS Code extension
└── docs/                      # Documentation
```

## Authentication Flow

1. **Sign Up**: User enters email + password + name → Supabase Auth creates the user → `handle_new_user()` trigger auto-creates a `user_profiles` row
2. **Sign In**: Email + password → Supabase Auth returns session → `onAuthStateChange` fires → app loads profile + memberships
3. **Session**: JWT token stored by Supabase JS client → persists across page reloads
4. **Organization**: User creates an org → becomes owner → all data is scoped to that org via RLS policies
5. **RLS**: Every query is filtered by `organization_id` through `organization_members` membership checks

## Troubleshooting

### "Missing VITE_SUPABASE_URL"
The `.env` file must be in the `omniguard/` directory (where `vite.config.ts` is), not the project root.

### "Permission denied" or empty pages
You need to create an organization first. Go to `/app/organizations` and create one.

### Edge function returns 401
Make sure you're signed in. The edge functions validate the JWT token from the Authorization header.

### Scan stays in "queued" status
The scan-worker function runs on a schedule (pg_cron). If pg_cron isn't available, scans won't auto-process. You can manually trigger the worker by calling the `scan-worker` edge function.
