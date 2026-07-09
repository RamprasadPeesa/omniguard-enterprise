# OmniGuard — AWS Production Deployment Guide

## Architecture

```
Internet → CloudFront (CDN) → S3 (static files)
                           → Supabase (API + Auth + DB + Edge Functions)
```

OmniGuard is a static SPA (React/Vite) with a Supabase backend. No server-side rendering is needed.

## Step 1: Build the Frontend

```bash
cd omniguard-main-main/omniguard

# Set production env vars
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_URL=https://omniguard.yourcompany.com
EOF

# Build
npm run build
```

Output goes to `omniguard/dist/` — a static site with `index.html`, JS, and CSS bundles.

## Step 2: Deploy to S3 + CloudFront

### Create S3 Bucket

```bash
aws s3api create-bucket \
  --bucket omniguard-frontend \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1
```

### Upload Static Files

```bash
aws s3 sync dist/ s3://omniguard-frontend/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"
```

### Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

Sample `cloudfront-config.json`:
```json
{
  "CallerReference": "omniguard-unique-id",
  "Comment": "OmniGuard Frontend",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-omniguard-frontend",
      "DomainName": "omniguard-frontend.s3.amazonaws.com",
      "S3OriginConfig": { "OriginAccessIdentity": "" }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-omniguard-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "ForwardedValues": { "QueryString": false, "Cookies": { "Forward": "none" } },
    "MinTTL": 0,
    "DefaultTTL": 31536000,
    "MaxTTL": 31536000
  },
  "DefaultRootObject": "index.html",
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 404,
      "ResponseCodePath": "/index.html",
      "ResponseCode": 200,
      "ErrorCachingMinTTL": 0
    }]
  }
}
```

The `CustomErrorResponses` section is critical — it routes all 404s to `index.html` so client-side routing works.

### Get the CloudFront URL

```bash
aws cloudfront get-distribution \
  --id E123ABCXYZ \
  --query 'Distribution.DomainName' \
  --output text
```

Your app is now live at `https://d123abcxyz.cloudfront.net`.

## Step 3: Configure Custom Domain

```bash
aws cloudfront create-distribution-with-tags \
  --distribution-config file://cloudfront-config.json \
  --tags file://tags.json
```

1. Add your domain (e.g., `omniguard.yourcompany.com`) as an Alternate Domain Name in CloudFront
2. Request an ACM certificate in us-east-1 for your domain
3. Attach the certificate to the CloudFront distribution
4. Create a CNAME or Route53 alias record pointing to the CloudFront domain

## Step 4: Configure Supabase Auth Redirects

In the Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://omniguard.yourcompany.com`
- **Redirect URLs**: `https://omniguard.yourcompany.com/**`

## Step 5: Deploy Edge Functions

Edge functions are already deployed to Supabase (they run on Supabase's edge network, not AWS). Deploy them via:

```bash
# Using the MCP tool (recommended)
mcp__supabase__deploy_edge_function(slug="api-v1-api-keys", verify_jwt=false)

# Or via Supabase Dashboard → Edge Functions → Deploy
```

## Step 6: Configure Edge Function Secrets

Set AI provider keys and integration credentials as Supabase secrets:

```bash
# Via Supabase Dashboard → Edge Functions → Secrets
ANTHROPIC_API_KEY=sk-ant-xxxx
GITHUB_TOKEN=ghp_xxx
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_API_TOKEN=xxx
```

## Step 7: Update CLI/Extension Configuration

Point the CLI and VS Code extension to your production URL:

```bash
omniguard config set url https://your-project.supabase.co/functions/v1
omniguard config set api-key og_your_key
```

## Deploy Script

```bash
#!/bin/bash
set -euo pipefail

# Build
cd omniguard-main-main/omniguard
npm run build

# Sync to S3
aws s3 sync dist/ s3://omniguard-frontend/ \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# Upload index.html with no-cache
aws s3 cp dist/index.html s3://omniguard-frontend/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id E123ABCXYZ \
  --paths "/*"

echo "Deploy complete."
```

Save as `scripts/deploy-aws.sh` and run with `bash scripts/deploy-aws.sh`.

## CI/CD with GitHub Actions

```yaml
name: Deploy OmniGuard
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd omniguard-main-main/omniguard && npm ci
      - run: cd omniguard-main-main/omniguard && npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws s3 sync omniguard-main-main/omniguard/dist/ s3://omniguard-frontend/ --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} --paths "/*"
```

## Monitoring

- **Frontend**: Enable CloudFront access logs → S3 bucket
- **Edge Functions**: Supabase Dashboard → Edge Functions → Logs
- **Database**: Supabase Dashboard → Database → Reports
- **Auth**: Supabase Dashboard → Authentication → Users
