import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Brain,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Code2,
  Database,
  GitBranch,
  Layers3,
  Lock,
  Moon,
  Play,
  Shield,
  Sparkles,
  SunMedium,
  TerminalSquare,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import hero from '../assets/hero.png'

type PageKey =
  | 'home'
  | 'product'
  | 'platform'
  | 'solutions'
  | 'enterprise'
  | 'pricing'
  | 'documentation'
  | 'security'
  | 'customers'
  | 'about'
  | 'careers'
  | 'blog'
  | 'contact'

const NAV = [
  ['Product', '/product'],
  ['Platform', '/platform'],
  ['Solutions', '/solutions'],
  ['Enterprise', '/enterprise'],
  ['Pricing', '/pricing'],
  ['Documentation', '/docs'],
  ['Security', '/security'],
]

const providers = ['Anthropic', 'OpenAI', 'Gemini', 'AWS Bedrock', 'Azure OpenAI', 'OpenRouter', 'Ollama', 'LM Studio']

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 mb-3">{eyebrow}</p>}
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-950 mb-4">{title}</h2>
        {children}
      </div>
    </section>
  )
}

function PageShell({ children, mode, setMode }: { children: React.ReactNode; mode: 'light' | 'dark'; setMode: (m: 'light' | 'dark') => void }) {
  return (
    <div className={mode === 'dark' ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-white text-slate-900'}>
      <header className={`sticky top-0 z-40 border-b ${mode === 'dark' ? 'border-slate-800 bg-slate-950/95' : 'border-slate-200 bg-white/95'} backdrop-blur`}>
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Shield className="w-5 h-5 text-slate-900" />
            OmniGuard
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-600">
            {NAV.map(([label, href]) => <Link key={href} to={href} className="hover:text-slate-950">{label}</Link>)}
            <Link to="/customers" className="hover:text-slate-950">Customers</Link>
            <Link to="/about" className="hover:text-slate-950">About</Link>
            <Link to="/careers" className="hover:text-slate-950">Careers</Link>
            <Link to="/blog" className="hover:text-slate-950">Blog</Link>
            <Link to="/contact" className="hover:text-slate-950">Contact</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setMode(mode === 'light' ? 'dark' : 'light')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
              {mode === 'light' ? <Moon className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
              {mode === 'light' ? 'Dark' : 'Light'}
            </button>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">
              Sign in <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className={`${mode === 'dark' ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'} border-t`}>
        <div className="mx-auto max-w-6xl px-6 py-10 grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-950">OmniGuard</p>
            <p className="text-sm mt-2">AI-native enterprise application security for teams that need policy, governance, and automation in one platform.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/security">Security</Link>
            <Link to="/docs">Documentation</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/customers">Customers</Link>
            <Link to="/enterprise">Enterprise</Link>
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-900">Built for</p>
            <p className="mt-2">Security teams, platform engineering, compliance leaders, and developers shipping to regulated environments.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function CopyBlock({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-950">{title}</h3><p className="text-sm text-slate-600 mt-2">{body}</p></div>
}

function Hero({ title, subtitle, ctas }: { title: string; subtitle: string; ctas: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-10">
      <div className="grid lg:grid-cols-2 gap-10 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
            <Sparkles className="w-3.5 h-3.5" /> AI-native enterprise application security
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="text-lg text-slate-600 max-w-2xl">{subtitle}</p>
          {ctas}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
          <img src={hero} alt="OmniGuard dashboard" className="rounded-2xl border border-slate-200" />
        </div>
      </div>
    </section>
  )
}

export function MarketingSite({ page }: { page: PageKey }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')
  const architecture = useMemo(() => [
    'Developer intent',
    'CLI / VS Code execution',
    'Backend policy decisioning',
    'Supabase persistence and audit trail',
    'AI providers and enterprise integrations',
  ], [])

  const BuyerGrid = () => (
    <div className="grid md:grid-cols-3 gap-4">
      <CopyBlock title="For Security Leaders" body="Prioritize critical findings, track compliance drift, and align remediation with policy, risk, and executive reporting." />
      <CopyBlock title="For Platform Teams" body="Centralize integrations, automate routing, and keep CLI, VS Code, and dashboard workflows synchronized." />
      <CopyBlock title="For Developers" body="Get fast triage, clear explanations, and AI fixes without losing the context of the code you are changing." />
    </div>
  )

  const AboutGrid = () => (
    <div className="grid lg:grid-cols-2 gap-4">
      <CopyBlock title="Why OmniGuard exists" body="Security tools often detect issues but stop short of policy-aware remediation. OmniGuard closes that gap by pairing AI with an organization’s actual standards, controls, and operating model." />
      <CopyBlock title="What makes it different" body="It is designed as an enterprise system of record: identity, integrations, policy context, remediation, auditability, and reporting all live in one product flow." />
    </div>
  )

  const pageContent = {
    product: {
      hero: ['Product overview', 'OmniGuard combines policy-aware scanning, AI remediation, and enterprise workflows in one platform.'],
      sections: (
        <>
          <Section title="What the product includes" eyebrow="Product">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CopyBlock title="AI remediation" body="Turn findings into guided fixes with policy and repository context." />
              <CopyBlock title="Policy engine" body="Encode engineering standards, exceptions, and approval flows." />
              <CopyBlock title="Enterprise dashboard" body="Monitor posture, cost, usage, and risk with live backend data." />
              <CopyBlock title="CLI and VS Code" body="Bring security workflows directly into developer tools." />
              <CopyBlock title="Integrations" body="Connect GitHub, Jira, Confluence, ServiceNow, and cloud platforms." />
              <CopyBlock title="Auditable controls" body="Track decisions, approvals, API activity, and remediation history." />
            </div>
          </Section>
          <Section title="How teams use it" eyebrow="Workflow">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Detect" body="Run scans against code, secrets, dependencies, IaC, and supply chain risk." />
              <CopyBlock title="Prioritize" body="Use policy context and risk scoring to focus on what matters to the business." />
              <CopyBlock title="Remediate" body="Send fixes to engineers with explanations, evidence, and tracking." />
            </div>
          </Section>
        </>
      ),
    },
    platform: {
      hero: ['Platform architecture', 'Developer tools, backend services, Supabase persistence, and AI providers are wired through a single architecture.'],
      sections: (
        <>
          <Section title="Architecture layers" eyebrow="Platform">
            <div className="grid md:grid-cols-5 gap-4 text-sm">
              {architecture.map((step, i) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-3">0{i + 1}</div>
                  <p className="font-medium text-slate-900">{step}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Operational guarantees" eyebrow="Reliability">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Centralized backend" body="All business logic flows through the backend services and Supabase, keeping UI, CLI, and extension behavior synchronized." />
              <CopyBlock title="Audit and policy" body="Actions are auditable and mapped to the organization’s standards and controls." />
              <CopyBlock title="Provider abstraction" body="Swap AI providers without redesigning the product or duplicating business logic." />
            </div>
          </Section>
        </>
      ),
    },
    solutions: {
      hero: ['Solutions by team', 'Security, platform engineering, compliance, and developer experience teams all get tailored workflows.'],
      sections: (
        <>
          <Section title="Role-based outcomes" eyebrow="Solutions">
            <BuyerGrid />
          </Section>
          <Section title="Common deployment models" eyebrow="Adoption">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Security team-led" body="Start with policies, findings, and compliance reporting, then expand into remediation automation." />
              <CopyBlock title="Platform-led" body="Standardize integrations, identities, and automation from a platform operations perspective." />
              <CopyBlock title="Developer-first" body="Roll out VS Code and CLI flows first, then connect enterprise governance and reporting." />
            </div>
          </Section>
        </>
      ),
    },
    enterprise: {
      hero: ['Enterprise readiness', 'SSO, auditability, integrations, and operational controls for regulated organizations.'],
      sections: (
        <>
          <Section title="Built for enterprise governance" eyebrow="Enterprise">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CopyBlock title="Identity and SSO" body="Support enterprise authentication patterns and role-aware workflows." />
              <CopyBlock title="Auditability" body="Preserve history for actions, approvals, scans, and key lifecycle events." />
              <CopyBlock title="Controls" body="Use policy packs, approvals, and scopes to shape the workflow for your org." />
              <CopyBlock title="Deployment options" body="Run locally, in cloud environments, or through enterprise-managed rollout paths." />
              <CopyBlock title="Operational visibility" body="Track provider health, usage, and organizational posture from one console." />
              <CopyBlock title="Support posture" body="Designed for demos, security reviews, and production adoption planning." />
            </div>
          </Section>
          <Section title="What enterprise buyers ask for" eyebrow="Checklist">
            <BuyerGrid />
          </Section>
        </>
      ),
    },
    pricing: {
      hero: ['Pricing and packaging', 'Transparent packaging for pilots, growing teams, and enterprise deployments.'],
      sections: (
        <>
          <Section title="Plans that map to adoption" eyebrow="Pricing">
            <div className="grid lg:grid-cols-3 gap-4">
              {[
                ['Team', '$0', 'For pilots and evaluation.', ['Core scanning', 'Dashboard', 'Email auth']],
                ['Business', '$49', 'For growing security teams.', ['AI provider management', 'CLI + VS Code', 'Policy packs']],
                ['Enterprise', 'Custom', 'For regulated organizations.', ['SSO', 'Audit logs', 'Priority support']],
              ].map(([name, price, desc, items]) => (
                <div key={name as string} className="rounded-3xl border border-slate-200 bg-white p-6">
                  <p className="text-sm text-slate-500">{name as string}</p>
                  <div className="mt-2 text-4xl font-semibold text-slate-950">{price as string}</div>
                  <p className="mt-3 text-sm text-slate-600">{desc as string}</p>
                  <div className="mt-5 space-y-2 text-sm text-slate-700">
                    {(items as string[]).map(item => <div key={item} className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-900" />{item}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Frequently asked questions" eyebrow="FAQ">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                ['What is included in the platform?', 'Scanning, policy management, AI remediation, dashboarding, CLI support, VS Code integration, and enterprise reporting.'],
                ['Can we start small?', 'Yes. Most teams begin with a pilot, connect one or two repositories, and expand into policies and integrations.'],
                ['How does AI usage get controlled?', 'Provider choice, routing, scopes, and token budgets are all configurable from the backend-managed console.'],
                ['How do we evaluate enterprise fit?', 'Run the local stack, connect a Supabase project, and review the workflows with your security and platform teams.'],
              ].map(([q, a]) => (
                <div key={q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="font-medium text-slate-950 flex items-center gap-2"><CircleHelp className="w-4 h-4" />{q}</p>
                  <p className="text-sm text-slate-600 mt-2">{a}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      ),
    },
    documentation: {
      hero: ['Documentation and API reference', 'Start with setup, authentication, scans, policy management, and API usage.'],
      sections: (
        <>
          <Section title="Quick start" eyebrow="Docs">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="1. Configure environment" body="Copy the `.env.example`, add your Supabase variables, and choose the AI provider you want to test." />
              <CopyBlock title="2. Sign in" body="Use the login page with a dev Supabase account or magic link before enabling enterprise SSO." />
              <CopyBlock title="3. Connect tools" body="Configure GitHub, Jira, Confluence, ServiceNow, and cloud integrations from the dashboard." />
            </div>
          </Section>
          <Section title="API surfaces" eyebrow="Reference">
            <div className="grid md:grid-cols-2 gap-4">
              <CopyBlock title="Dashboard API" body="The browser talks to backend function endpoints for data and actions." />
              <CopyBlock title="CLI API" body="The CLI authenticates with shared API keys and uses the same backend paths." />
              <CopyBlock title="Extension API" body="The VS Code extension uses the same backend and can delegate execution to the CLI." />
              <CopyBlock title="Policy ingestion" body="Upload documents or create policies from the dashboard and let the backend process them." />
            </div>
          </Section>
        </>
      ),
    },
    security: {
      hero: ['Security and trust', 'Learn how OmniGuard handles authentication, storage, access control, and trust boundaries.'],
      sections: (
        <>
          <Section title="Security model" eyebrow="Trust">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Least privilege" body="API keys, provider credentials, and access decisions are scoped to the organization and use case." />
              <CopyBlock title="Encrypted storage" body="Sensitive configuration stays in backend-managed secret paths rather than exposed in the browser." />
              <CopyBlock title="Auditable actions" body="The product records actions, scans, and remediation changes for review and governance." />
            </div>
          </Section>
          <Section title="How buyers evaluate risk" eyebrow="Buyer FAQ">
            <div className="grid md:grid-cols-2 gap-4">
              <CopyBlock title="Can our security team review it?" body="Yes. The public site is informational, while the dashboard and backend are structured for real security reviews." />
              <CopyBlock title="Do you support enterprise SSO?" body="Yes, with identity configuration planned through enterprise provider settings and auth flows." />
            </div>
          </Section>
        </>
      ),
    },
    customers: {
      hero: ['Customer stories', 'Representative customer narratives and use cases for security buyers and operators.'],
      sections: (
        <>
          <Section title="Typical customer outcomes" eyebrow="Customers">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Reduce triage time" body="Security teams can focus on the highest-risk findings instead of sorting through noisy alerts." />
              <CopyBlock title="Unify workflows" body="Developers, platform teams, and security reviewers work in the same system of record." />
              <CopyBlock title="Improve audit readiness" body="Organizations can show policies, evidence, and decision history during reviews." />
            </div>
          </Section>
          <Section title="Representative logos" eyebrow="Signals">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {['Global Bank', 'Healthcare Co', 'Retail Enterprise', 'SaaS Platform', 'Manufacturing Group', 'Public Sector', 'Fintech', 'Cloud Services'].map(item => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-slate-500">{item}</div>
              ))}
            </div>
          </Section>
        </>
      ),
    },
    about: {
      hero: ['About OmniGuard', 'OmniGuard is built to make AI-native application security practical for enterprise teams.'],
      sections: (
        <>
          <Section title="Our thesis" eyebrow="About">
            <AboutGrid />
          </Section>
          <Section title="What we prioritize" eyebrow="Principles">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Correctness" body="Security products must be trustworthy, not just flashy." />
              <CopyBlock title="Operational clarity" body="A tool should explain what it knows, why it knows it, and what to do next." />
              <CopyBlock title="Enterprise fit" body="Design, controls, and workflows must feel appropriate for serious buyers and operators." />
            </div>
          </Section>
        </>
      ),
    },
    careers: {
      hero: ['Careers', 'We hire engineers who care about correctness, security, and product quality.'],
      sections: (
        <>
          <Section title="What kind of team this is" eyebrow="Careers">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="High ownership" body="People here ship end-to-end and care about how the system behaves in production." />
              <CopyBlock title="Security minded" body="Every feature is judged against trust, reliability, and enterprise expectations." />
              <CopyBlock title="Product driven" body="We design for operators and developers, not just demo moments." />
            </div>
          </Section>
          <Section title="Open roles by focus" eyebrow="Roles">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Frontend engineering" body="Enterprise UI systems, data tables, workflows, and accessibility." />
              <CopyBlock title="Backend engineering" body="Auth, APIs, policy logic, data flows, and secure integrations." />
              <CopyBlock title="Product design" body="Information density, workflows, and buyer-facing experience." />
            </div>
          </Section>
        </>
      ),
    },
    blog: {
      hero: ['Blog', 'Updates on product direction, architecture, and enterprise AppSec practices.'],
      sections: (
        <>
          <Section title="Recent themes" eyebrow="Blog">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="How policy-aware remediation works" body="Why context matters more than raw detection when fixing security issues at scale." />
              <CopyBlock title="Enterprise auth without friction" body="How teams can balance SSO, API keys, and developer convenience." />
              <CopyBlock title="AI provider strategy" body="Choosing the right provider, routing model, and cost controls for security workflows." />
            </div>
          </Section>
          <Section title="Featured posts" eyebrow="Reading">
            <div className="grid md:grid-cols-2 gap-4">
              <CopyBlock title="Building a security platform that feels like a system of record" body="Explains the architectural choices behind OmniGuard’s dashboard, CLI, and extension model." />
              <CopyBlock title="Why dashboards fail when they forget the operator" body="A design note on clarity, density, and task completion in enterprise consoles." />
            </div>
          </Section>
        </>
      ),
    },
    contact: {
      hero: ['Contact', 'Reach the OmniGuard team for demos, security reviews, and enterprise deployment questions.'],
      sections: (
        <>
          <Section title="Ways to reach us" eyebrow="Contact">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Sales and demos" body="See the product, walk through your workflows, and map the rollout to your team structure." />
              <CopyBlock title="Security review" body="Discuss data handling, integrations, and operational controls with your security team." />
              <CopyBlock title="Technical onboarding" body="Get help with the Supabase-backed environment, CLI, and extension setup." />
            </div>
          </Section>
          <Section title="What to include" eyebrow="Checklist">
            <div className="grid md:grid-cols-2 gap-4">
              <CopyBlock title="Deployment context" body="Tell us whether you want a pilot, internal rollout, or full enterprise evaluation." />
              <CopyBlock title="Integration list" body="Share which systems matter most: GitHub, GitLab, Jira, Confluence, ServiceNow, Okta, and more." />
            </div>
          </Section>
        </>
      ),
    },
  } as const

  const current = pageContent[page as keyof typeof pageContent]

  return (
    <PageShell mode={mode} setMode={setMode}>
      {page === 'home' && (
        <>
          <Hero
            title="Security policy automation for engineering teams that need enterprise control."
            subtitle="OmniGuard helps teams detect, explain, prioritize, and remediate AppSec issues using policy context, architecture knowledge, and AI-driven fixes."
            ctas={
              <>
                <div className="flex flex-wrap gap-3">
                  <Link to="/login" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white">
                    Open console <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/docs" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
                    Read docs <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-600">
                  {['GitHub', 'AWS', 'VS Code', 'CLI'].map(item => <div key={item} className="rounded-xl border border-slate-200 px-4 py-3">{item}</div>)}
                </div>
              </>
            }
          />
          <Section title="Why teams adopt OmniGuard" eyebrow="Value">
            <div className="grid md:grid-cols-3 gap-4">
              <CopyBlock title="Ship faster with guardrails" body="Give engineers clear fixes and policy-aware guidance instead of generic alerts." />
              <CopyBlock title="Reduce operational overhead" body="One system manages findings, workflows, integrations, and API access across the organization." />
              <CopyBlock title="Make AI practical" body="Use AI where it improves triage and remediation, with controls that fit enterprise operations." />
            </div>
          </Section>
          <Section title="How it works" eyebrow="Platform">
            <div className="grid md:grid-cols-5 gap-4 text-sm">
              {architecture.map((step, i) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-3">0{i + 1}</div>
                  <p className="font-medium text-slate-900">{step}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Enterprise features built for security leaders" eyebrow="Features">
            <div className="grid md:grid-cols-3 gap-4">
              {[
                ['AI Auto Fixes', 'Generate high-confidence remediations with policy context.', Brain],
                ['Policy Engine', 'Codify controls, exceptions, and routing rules.', Lock],
                ['Interactive CLI', 'Scan, triage, and fix issues from terminal workflows.', TerminalSquare],
                ['Repository Intelligence', 'Track risk across code, dependencies, secrets, and IaC.', GitBranch],
                ['Enterprise Dashboard', 'High-density admin views with live backend data.', Database],
                ['Cloud Integrations', 'GitHub, AWS, and other enterprise surfaces.', Cloud],
              ].map(([title, desc, Icon]) => (
                <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <Icon className="w-5 h-5 text-slate-900 mb-3" />
                  <h3 className="font-semibold text-slate-950">{title as string}</h3>
                  <p className="text-sm text-slate-600 mt-2">{desc as string}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Supported AI providers" eyebrow="AI">
            <div className="flex flex-wrap gap-3">
              {providers.map(p => <span key={p} className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700">{p}</span>)}
            </div>
          </Section>
          <Section title="Pricing that scales with enterprise usage" eyebrow="Pricing">
            <div className="grid lg:grid-cols-3 gap-4">
              {[
                ['Team', '$0', 'For pilots and evaluation.', ['Core scanning', 'Dashboard', 'Email auth']],
                ['Business', '$49', 'For growing security teams.', ['AI provider management', 'CLI + VS Code', 'Policy packs']],
                ['Enterprise', 'Custom', 'For regulated organizations.', ['SSO', 'Audit logs', 'Priority support']],
              ].map(([name, price, desc, items]) => (
                <div key={name as string} className="rounded-3xl border border-slate-200 bg-white p-6">
                  <p className="text-sm text-slate-500">{name as string}</p>
                  <div className="mt-2 text-4xl font-semibold text-slate-950">{price as string}</div>
                  <p className="mt-3 text-sm text-slate-600">{desc as string}</p>
                  <div className="mt-5 space-y-2 text-sm text-slate-700">
                    {(items as string[]).map(item => <div key={item} className="flex items-center gap-2"><Check className="w-4 h-4 text-slate-900" />{item}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Frequently asked questions" eyebrow="FAQ">
            <div className="grid md:grid-cols-2 gap-4">
              {[
                ['Does OmniGuard store secrets?', 'Secrets are stored hashed or in secure backend-managed configuration flows.'],
                ['Can we use our own AI provider?', 'Yes. OmniGuard supports multiple providers and compatible OpenAI APIs.'],
                ['Does the CLI share credentials with the dashboard?', 'Yes. The intended architecture keeps auth and provider config synchronized.'],
                ['Can we deploy without local Supabase?', 'Yes. The platform targets your existing cloud Supabase project only.'],
              ].map(([q, a]) => (
                <div key={q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="font-medium text-slate-950 flex items-center gap-2"><CircleHelp className="w-4 h-4" />{q}</p>
                  <p className="text-sm text-slate-600 mt-2">{a}</p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {page !== 'home' && current && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{page}</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{current.hero[0]}</h1>
            <p className="text-lg text-slate-600">{current.hero[1]}</p>
          </div>
          <div className="mt-10">{current.sections}</div>
        </section>
      )}
    </PageShell>
  )
}
