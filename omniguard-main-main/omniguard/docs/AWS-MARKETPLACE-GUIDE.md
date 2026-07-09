# OmniGuard AWS Marketplace Guide

This guide is for turning OmniGuard into a buyer-ready enterprise offering on AWS Marketplace.

OmniGuard is already structured as a SaaS platform backed by Supabase and deployed as a web dashboard plus CLI and VS Code extension. That means the Marketplace story should focus on:

- SaaS onboarding through the dashboard
- BYOK AI provider configuration
- Cloud-hosted backend functions
- Enterprise reporting, audit logs, notifications, and policy enforcement
- Optional container deployment for dedicated environments

## Recommended Marketplace Model

Use one of these two models:

1. SaaS subscription
   - Best for fastest enterprise sales and zero-friction onboarding
   - Buyers subscribe in AWS Marketplace and are redirected to OmniGuard to create or link their tenant
   - The product then provisions the organization, API keys, policies, and integrations in the existing cloud Supabase backend

2. Container product
   - Best for buyers who want to run OmniGuard in their own AWS account
   - The dashboard app is deployed in ECS Fargate or EKS
   - Supabase remains the managed persistence layer unless the customer contract requires a dedicated backend

For most enterprise security teams, SaaS subscription is the cleanest first release.

## What OmniGuard Already Demonstrates

The current platform can already show:

- Live dashboard widgets for findings, scans, risk, and activity
- Audit logs
- Notifications
- API key management
- AI provider configuration
- Organizations, teams, and policies
- Reports and exports
- CLI and VS Code extension integration

That is enough for a credible executive demo.

## AWS Marketplace Flow

### SaaS Flow

1. Customer subscribes in AWS Marketplace
2. AWS redirects the customer to the OmniGuard onboarding URL
3. OmniGuard creates or links the organization
4. The tenant configures:
   - AI provider keys
   - GitHub/GitLab/Azure DevOps integrations
   - Notification channels
   - Repository connections
5. The customer installs the CLI or VS Code extension
6. Scans, findings, AI remediations, audit logs, and reports appear in the dashboard in real time

### Container Flow

1. Customer subscribes to the container listing
2. Customer launches OmniGuard in ECS Fargate or EKS
3. The container points at the existing cloud Supabase backend
4. Tenant secrets are configured through environment variables or AWS Secrets Manager
5. Developers use the CLI and VS Code extension against the same backend

## Minimum Marketplace Assets

Prepare these assets before submission:

- Product name: OmniGuard
- Product description: AI-native enterprise AppSec platform
- Logo and marketing images
- Public landing page
- Fulfillment URL for SaaS onboarding
- Privacy policy
- EULA
- Support contact
- Pricing structure
- Demo tenant
- Security overview

## Marketplace Listing Positioning

Use language like:

- Enterprise application security platform
- AI-powered policy-aware remediation
- Live code scanning and governance
- Audit-friendly and compliance-ready
- Centralized posture, reporting, and remediation workflows

Avoid positioning it as a developer toy or a scanner-only utility.

## Buyer Demo Checklist

When presenting OmniGuard, show these screens in order:

1. Dashboard
   - Security score
   - Critical findings
   - Open PR blocks
   - Recent scans
   - Provider health
   - Organization risk trend

2. Findings
   - Real vulnerabilities
   - Status transitions
   - AI remediation suggestions

3. Scans
   - Recent and incremental scans
   - Worker status
   - Scan history

4. Policies
   - Policy ingestion
   - Policy blocks
   - Enforcement modes

5. Teams
   - Invitations
   - Roles
   - Member management

6. Notifications
   - Security alerts
   - Scan completion alerts
   - Delivery preferences

7. Audit Logs
   - Who changed what
   - Who triggered scans
   - Who generated keys

8. Reports
   - Executive report
   - CISO report
   - Compliance report

9. Settings
   - AI provider setup
   - API keys
   - Integrations

## AI and Real-Time Expectations

For live AI recommendations in a demo:

- Add an Anthropic API key in Settings
- Connect one GitHub repository
- Run a real scan from the CLI or dashboard
- Show remediation suggestions in findings
- Open the audit trail that records the scan and notification activity

If no provider key is configured, OmniGuard still scans using its local rules engine, but AI-enhanced remediation will not be available.

## Deployment Recommendation

For an enterprise presentation, use:

- AWS ECS Fargate for the dashboard container
- AWS Route 53 for DNS
- AWS ACM for TLS
- AWS Secrets Manager for application secrets
- AWS CloudWatch for logs and alarms
- Existing cloud Supabase for persistence and auth

That combination is credible, secure, and easy to explain to buyers.

## Related Files

- [AWS Production Deployment](./AWS-PRODUCTION-DEPLOYMENT.md)
- [Local Development Guide](./README.md)
- [Dashboard](../src/pages/Dashboard.tsx)
- [Settings](../src/pages/Settings.tsx)
