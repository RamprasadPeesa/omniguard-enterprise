import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callAI, resolveAIConfigFromOrg, extractJson, estimateCost, type AIConfig } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

// ─────────────────────────────────────────────────────────────
// SCANNER RULES
// ─────────────────────────────────────────────────────────────

const SECRET_RULES = [
  { id: "SECRET-AWS-001",       name: "AWS Access Key ID",         re: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,              sev: "critical", baseConfidence: 0.95 },
  { id: "SECRET-GITHUB-001",    name: "GitHub PAT (classic)",      re: /ghp_[A-Za-z0-9_]{36,}/g,                                                             sev: "critical", baseConfidence: 0.98 },
  { id: "SECRET-GITHUB-002",    name: "GitHub Fine-Grained PAT",   re: /github_pat_[A-Za-z0-9_]{82}/g,                                                       sev: "critical", baseConfidence: 0.99 },
  { id: "SECRET-OPENAI-001",    name: "OpenAI Key (legacy)",       re: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g,                                         sev: "critical", baseConfidence: 0.99 },
  { id: "SECRET-OPENAI-002",    name: "OpenAI Project Key",        re: /sk-proj-[A-Za-z0-9_-]{40,}/g,                                                        sev: "critical", baseConfidence: 0.98 },
  { id: "SECRET-ANTHROPIC-001", name: "Anthropic API Key",         re: /sk-ant-api03-[A-Za-z0-9\-_]{90,}/g,                                                  sev: "critical", baseConfidence: 0.99 },
  { id: "SECRET-STRIPE-001",    name: "Stripe Live Secret Key",    re: /sk_live_[0-9a-zA-Z]{24,}/g,                                                          sev: "critical", baseConfidence: 0.99 },
  { id: "SECRET-STRIPE-002",    name: "Stripe Test Secret Key",    re: /sk_test_[0-9a-zA-Z]{24,}/g,                                                          sev: "medium",   baseConfidence: 0.95 },
  { id: "SECRET-SLACK-001",     name: "Slack Bot Token",           re: /xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24}/g,                                   sev: "high",     baseConfidence: 0.97 },
  { id: "SECRET-SSH-001",       name: "SSH Private Key",           re: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,                            sev: "critical", baseConfidence: 0.98 },
  { id: "SECRET-DB-001",        name: "Database Connection String",re: /(postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s'"]{5,}/gi,        sev: "critical", baseConfidence: 0.92 },
  { id: "SECRET-JWT-001",       name: "JWT Secret Assignment",     re: /jwt[_-]?secret["']?\s*[:=]\s*["']([A-Za-z0-9\-_!@#$%^&*]{20,})["']/gi,             sev: "critical", baseConfidence: 0.85 },
  { id: "SECRET-PASS-001",      name: "Hardcoded Password",        re: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/gim,                          sev: "high",     baseConfidence: 0.75 },
  { id: "SECRET-GCP-001",       name: "GCP Service Account Key",   re: /"private_key":\s*"-----BEGIN (?:RSA )?PRIVATE KEY/g,                                 sev: "critical", baseConfidence: 0.99 },
  { id: "SECRET-DISCORD-001",   name: "Discord Bot Token",         re: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g,                                          sev: "high",     baseConfidence: 0.88 },
  { id: "SECRET-SENDGRID-001",  name: "SendGrid API Key",          re: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,                                         sev: "high",     baseConfidence: 0.97 },
  { id: "SECRET-OKTA-001",      name: "Okta API Token",            re: /00[A-Za-z0-9\-_]{40}/g,                                                              sev: "critical", baseConfidence: 0.80 },
  { id: "SECRET-JIRA-001",      name: "Atlassian API Token",       re: /ATATT3x[A-Za-z0-9\-_+=/]{100,}/g,                                                    sev: "high",     baseConfidence: 0.97 },
];

const SAST_RULES = [
  { id: "SAST-SQL-001",    name: "SQL Injection (string concat)", re: /(?:execute|query)\s*\([^)]*(?:SELECT|INSERT|UPDATE|DELETE)[^)]*\+/gi,                  sev: "critical", cwe: ["CWE-89"],   owasp: ["A03:2021"], baseConfidence: 0.80 },
  { id: "SAST-SQL-002",    name: "SQL Injection (Python f-str)",  re: /cursor\.execute\s*\(\s*f["'][^"']*\{/g,                                                sev: "critical", cwe: ["CWE-89"],   owasp: ["A03:2021"], baseConfidence: 0.85 },
  { id: "SAST-XSS-001",    name: "XSS via innerHTML",             re: /\.innerHTML\s*[+]?=\s*[^"';\n]{1,80}(?:req\.|request\.|params\.|query\.|\$\{)/gm,     sev: "high",     cwe: ["CWE-79"],   owasp: ["A03:2021"], baseConfidence: 0.82 },
  { id: "SAST-CMD-001",    name: "Command Injection (exec)",      re: /(?:child_process\.exec|execSync|os\.system|subprocess\.call)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/gi, sev: "critical", cwe: ["CWE-78"], owasp: ["A03:2021"], baseConfidence: 0.78 },
  { id: "SAST-SSRF-001",   name: "SSRF Risk",                     re: /(?:fetch|axios\.get|axios\.post|requests\.get|requests\.post)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/gi, sev: "critical", cwe: ["CWE-918"], owasp: ["A10:2021"], baseConfidence: 0.73 },
  { id: "SAST-PATH-001",   name: "Path Traversal",                re: /(?:path\.join|path\.resolve|fs\.readFile|fs\.writeFile|open)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/gi, sev: "high", cwe: ["CWE-22"], owasp: ["A01:2021"], baseConfidence: 0.76 },
  { id: "SAST-DESER-001",  name: "Unsafe Deserialization",        re: /pickle\.loads?\s*\(/g,                                                                 sev: "critical", cwe: ["CWE-502"],  owasp: ["A08:2021"], baseConfidence: 0.90 },
  { id: "SAST-JWT-ALG",    name: "JWT Algorithm None Attack",     re: /algorithm[s]?\s*[:=]\s*["']none["']/gi,                                               sev: "critical", cwe: ["CWE-287"],  owasp: ["A07:2021"], baseConfidence: 0.95 },
  { id: "SAST-CRYPTO-001", name: "Weak Hash Algorithm (MD5)",     re: /(?:createHash\s*\(\s*["']md5["']|hashlib\.md5\s*\()/gi,                               sev: "high",     cwe: ["CWE-328"],  owasp: ["A02:2021"], baseConfidence: 0.92 },
  { id: "SAST-REDIRECT",   name: "Open Redirect",                 re: /(?:res\.redirect|response\.redirect)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/gi, sev: "medium",  cwe: ["CWE-601"],  owasp: ["A01:2021"], baseConfidence: 0.72 },
  { id: "SAST-PROTO",      name: "Prototype Pollution",           re: /__proto__\s*[\[\.]/gi,                                                                 sev: "high",     cwe: ["CWE-1321"], owasp: ["A03:2021"], baseConfidence: 0.85 },
  { id: "SAST-EVAL",       name: "Dangerous eval()",              re: /\beval\s*\([^)]{0,200}(?:req\.|request\.|params\.|query\.|\$_)/gi,                    sev: "critical", cwe: ["CWE-95"],   owasp: ["A03:2021"], baseConfidence: 0.88 },
];

const IAC_RULES = [
  { id: "IAC-S3-PUBLIC",    name: "S3 Bucket Public ACL",         re: /acl\s*=\s*["']public-read/gi,                                                         sev: "critical", baseConfidence: 0.98 },
  { id: "IAC-SG-OPEN",      name: "Security Group Open to World", re: /ingress\s*\{[^}]*cidr_blocks\s*=\s*\["0\.0\.0\.0\/0"\]/gs,                           sev: "high",     baseConfidence: 0.95 },
  { id: "IAC-RDS-PUBLIC",   name: "RDS Publicly Accessible",      re: /publicly_accessible\s*=\s*true/gi,                                                    sev: "critical", baseConfidence: 0.99 },
  { id: "IAC-UNENCRYPTED",  name: "Unencrypted Storage",          re: /encrypted\s*=\s*false/gi,                                                             sev: "high",     baseConfidence: 0.96 },
  { id: "IAC-DOCKER-ROOT",  name: "Dockerfile: Running as root",  re: /^USER\s+root\s*$/mi,                                                                  sev: "high",     baseConfidence: 0.97 },
  { id: "IAC-DOCKER-LATEST",name: "Dockerfile: :latest tag",      re: /^FROM\s+\S+:latest/mi,                                                                sev: "medium",   baseConfidence: 0.99 },
  { id: "IAC-DOCKER-SECRET",name: "Secret in Dockerfile ENV",     re: /^ENV\s+\w*(?:SECRET|PASSWORD|TOKEN|KEY|API)\w*\s+\S+/mi,                             sev: "critical", baseConfidence: 0.90 },
  { id: "IAC-K8S-PRIV",     name: "Privileged Kubernetes Pod",    re: /privileged:\s*true/gi,                                                                sev: "critical", baseConfidence: 0.97 },
  { id: "IAC-K8S-HOSTPID",  name: "Kubernetes hostPID: true",     re: /hostPID:\s*true/g,                                                                    sev: "high",     baseConfidence: 0.98 },
];

const SKIP_PATHS  = ["node_modules/", ".git/", "dist/", "build/", "__pycache__/", "vendor/", ".next/", "coverage/"];
const SCAN_EXTS   = new Set(["js","jsx","ts","tsx","py","java","go","rb","php","cs","rs","c","cpp","tf","hcl","yaml","yml","json","toml","ini","env","sh","sql","config"]);
const FALSE_POS   = /(?:test|example|sample|placeholder|changeme|your[-_]|xxx|dummy|fake|<[A-Z_]+>|REPLACE_ME|INSERT_HERE)/i;

interface RawFinding {
  scanner:          string;
  rule_id:          string;
  rule_name:        string;
  severity:         string;
  title:            string;
  description:      string;
  evidence:         string;
  file_path:        string;
  line_start:       number;
  owasp:            string[];
  cwe:              string[];
  risk_score:       number;
  confidence_score: number;
  remediation?:     string;
  references?:      string[];
  cvss_score?:      number;
  cve_id?:          string;
  package_name?:    string;
  package_version?: string;
  metadata?:        Record<string, unknown>;
  fingerprint?:     string;
}

interface ScanFile { path: string; content: string }
interface InventoryItem { name: string; version: string; ecosystem: string; file_path: string; license?: string }
interface TechnologyInventory { languages: Record<string, number>; frameworks: string[]; files_by_type: Record<string, number> }

function mask(v: string) { return v.length <= 8 ? "****" : v.slice(0, 4) + "****" + v.slice(-4); }
function isBinary(c: string) { return (c.match(/[\x00-\x08\x0e-\x1f\x7f]/g) ?? []).length / Math.max(c.length, 1) > 0.03; }
async function hashText(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Confidence scoring ────────────────────────────────────────
// Adjusts base confidence up/down based on file context signals

function scoreConfidence(baseConf: number, filePath: string, lineText: string, evidence: string): number {
  let score = baseConf;
  const fp = filePath.toLowerCase();
  // Reduce confidence for test/example files
  if (/test|spec|__tests__|mock|fixture|example|sample|demo/i.test(fp)) score -= 0.20;
  if (/\.example\.|\.sample\.|\.template\./i.test(fp)) score -= 0.25;
  // Reduce for obvious placeholder values
  if (FALSE_POS.test(evidence)) score -= 0.40;
  // Increase for production-looking paths
  if (/production|prod\/|src\/|app\/|lib\//i.test(fp)) score += 0.05;
  // Increase for .env files
  if (fp.includes(".env") && !fp.includes(".example") && !fp.includes(".sample")) score += 0.10;
  // Decrease for comment lines
  if (/^\s*(\/\/|#|\*|<!-)/. test(lineText)) score -= 0.50;
  return Math.max(0, Math.min(1, score));
}

function sevToRisk(sev: string, conf: number): number {
  const base = { critical: 90, high: 65, medium: 40, low: 20, info: 5 }[sev] ?? 30;
  // Confidence modulates risk: 0.5 confidence → 70% of base risk
  return Math.round(base * (0.5 + 0.5 * conf));
}

// ── Scanners ──────────────────────────────────────────────────

function detectLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  if (base === "dockerfile" || base.endsWith(".dockerfile")) return "Dockerfile";
  const ext = lower.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
    py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", swift: "Swift",
    php: "PHP", rb: "Ruby", cs: "C#", c: "C", h: "C", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++",
    scala: "Scala", sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell", yaml: "YAML", yml: "YAML",
    json: "JSON", tf: "Terraform", hcl: "Terraform", html: "HTML", xml: "XML"
  };
  return map[ext] ?? "Unknown";
}

function classifyFileType(filePath: string): string {
  const lower = filePath.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  if (base === "dockerfile" || lower.endsWith(".dockerfile")) return "dockerfile";
  if (lower.endsWith(".tf") || lower.endsWith(".hcl")) return "terraform";
  if (lower.includes(".github/workflows/")) return "github_actions";
  if (base === "azure-pipelines.yml" || base === "azure-pipelines.yaml") return "azure_pipeline";
  if (lower.endsWith(".template") || lower.endsWith(".cloudformation.json") || lower.endsWith(".cloudformation.yaml")) return "cloudformation";
  if (lower.includes("chart.yaml") || lower.includes("values.yaml") || lower.includes("/templates/")) return "helm";
  if (lower.includes("playbook") || lower.includes("/roles/") || lower.includes("/tasks/")) return "ansible";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".json")) return "json";
  return "source";
}

function buildTechnologyInventory(files: ScanFile[]): TechnologyInventory {
  const languages: Record<string, number> = {};
  const filesByType: Record<string, number> = {};
  const frameworks = new Set<string>();

  for (const file of files) {
    const language = detectLanguage(file.path);
    languages[language] = (languages[language] ?? 0) + 1;
    const type = classifyFileType(file.path);
    filesByType[type] = (filesByType[type] ?? 0) + 1;
    const lower = file.path.toLowerCase();
    if (lower.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(file.content);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (deps.react) frameworks.add("React");
        if (deps.next) frameworks.add("Next.js");
        if (deps.vue) frameworks.add("Vue");
        if (deps["@angular/core"]) frameworks.add("Angular");
        if (deps.express) frameworks.add("Express");
        if (deps["@nestjs/core"]) frameworks.add("NestJS");
        if (deps.electron) frameworks.add("Electron");
        if (deps["react-native"]) frameworks.add("React Native");
        if (deps["@types/node"] || deps.node || deps.express || deps.fastify || deps.koa) frameworks.add("Node");
      } catch { /* handled by validation scanner */ }
    }
    if (lower.endsWith("requirements.txt") || lower.endsWith("pyproject.toml")) {
      const content = file.content.toLowerCase();
      if (content.includes("fastapi")) frameworks.add("FastAPI");
      if (content.includes("django")) frameworks.add("Django");
      if (content.includes("flask")) frameworks.add("Flask");
    }
    if ((lower.endsWith("pom.xml") || lower.endsWith("build.gradle") || lower.endsWith("build.gradle.kts")) && /spring-boot|org\.springframework\.boot/i.test(file.content)) frameworks.add("Spring Boot");
    if (lower.endsWith("composer.json") && /laravel\/framework/i.test(file.content)) frameworks.add("Laravel");
    if (lower.endsWith("gemfile") && /\brails\b/i.test(file.content)) frameworks.add("Rails");
    if (lower.endsWith(".csproj") && /Microsoft\.AspNetCore/i.test(file.content)) frameworks.add("ASP.NET");
  }

  return { languages, frameworks: Array.from(frameworks).sort(), files_by_type: filesByType };
}

function runSecrets(files: ScanFile[]): RawFinding[] {
  const out: RawFinding[] = [];
  for (const f of files) {
    if (isBinary(f.content)) continue;
    const lines = f.content.split("\n");
    for (const rule of SECRET_RULES) {
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.re.exec(f.content)) !== null) {
        const lineNum = f.content.slice(0, m.index).split("\n").length;
        if (seen.has(lineNum)) continue; seen.add(lineNum);
        const lineText = lines[lineNum - 1]?.trim() ?? "";
        const conf = scoreConfidence(rule.baseConfidence, f.path, lineText, m[0]);
        if (conf < 0.30) continue; // below threshold, skip
        out.push({
          scanner: "secret", rule_id: rule.id, rule_name: rule.name, severity: rule.sev,
          title: `${rule.name} detected`,
          description: `A ${rule.name} was found hardcoded in source. This credential must be rotated immediately and removed from git history.`,
          evidence: mask(m[0]), file_path: f.path, line_start: lineNum,
          owasp: ["A07:2021"], cwe: ["CWE-798"],
          confidence_score: conf, risk_score: sevToRisk(rule.sev, conf),
          remediation: "1. Rotate the credential immediately. 2. Remove from git history (git-filter-repo or BFG). 3. Move to environment variables or a secrets manager (AWS Secrets Manager, Vault, Doppler).",
        });
      }
    }
  }
  return out;
}

function runSAST(files: ScanFile[]): RawFinding[] {
  const out: RawFinding[] = [];
  for (const f of files) {
    if (isBinary(f.content)) continue;
    const lines = f.content.split("\n");
    for (const rule of SAST_RULES) {
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.re.exec(f.content)) !== null) {
        const lineNum = f.content.slice(0, m.index).split("\n").length;
        if (seen.has(lineNum)) continue; seen.add(lineNum);
        const lineText = lines[lineNum - 1]?.trim() ?? "";
        const conf = scoreConfidence(rule.baseConfidence, f.path, lineText, m[0]);
        if (conf < 0.30) continue;
        out.push({
          scanner: "sast", rule_id: rule.id, rule_name: rule.name, severity: rule.sev,
          title: `${rule.name}`,
          description: `Potential ${rule.name} vulnerability at ${f.path}:${lineNum}. User-controlled input may flow into a dangerous sink.`,
          evidence: m[0].slice(0, 200), file_path: f.path, line_start: lineNum,
          owasp: rule.owasp, cwe: rule.cwe,
          confidence_score: conf, risk_score: sevToRisk(rule.sev, conf),
        });
      }
    }
  }
  return out;
}

function runIaC(files: ScanFile[]): RawFinding[] {
  const out: RawFinding[] = [];
  const iacFiles = files.filter(f => {
    const l = f.path.toLowerCase();
    return l.endsWith(".tf") || l.endsWith(".hcl") || /dockerfile$/i.test(l) || l.includes("docker-compose") || l.includes("kubernetes") || l.includes("/k8s/") || l.endsWith(".yaml") || l.endsWith(".yml");
  });
  for (const f of iacFiles) {
    const lines = f.content.split("\n");
    for (const rule of IAC_RULES) {
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.re.exec(f.content)) !== null) {
        const lineNum = f.content.slice(0, m.index).split("\n").length;
        if (seen.has(lineNum)) continue; seen.add(lineNum);
        const lineText = lines[lineNum - 1]?.trim() ?? "";
        const conf = scoreConfidence(rule.baseConfidence, f.path, lineText, m[0]);
        if (conf < 0.40) continue;
        out.push({
          scanner: "iac", rule_id: rule.id, rule_name: rule.name, severity: rule.sev,
          title: rule.name, description: `Infrastructure misconfiguration: ${rule.name} in ${f.path}`,
          evidence: m[0].slice(0, 150), file_path: f.path, line_start: lineNum,
          owasp: ["A05:2021"], cwe: ["CWE-16"],
          confidence_score: conf, risk_score: sevToRisk(rule.sev, conf),
        });
      }
    }
  }
  return out;
}

async function runDependencies(files: ScanFile[]): Promise<RawFinding[]> {
  const out: RawFinding[] = [];
  for (const f of files) {
    const lower = f.path.toLowerCase();
    if (!lower.endsWith("package.json") && !lower.endsWith("requirements.txt")) continue;
    if (lower.includes("node_modules/")) continue;
    const deps: Array<{ name: string; version: string; ecosystem: string }> = [];
    if (lower.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(f.content);
        for (const [n, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
          const ver = String(v).replace(/[^0-9.]/g, "");
          if (ver) deps.push({ name: n, version: ver, ecosystem: "npm" });
        }
      } catch { continue; }
    } else {
      for (const line of f.content.split("\n")) {
        const m = /^([A-Za-z0-9_.-]+)[>=!<~^]{0,2}([0-9][0-9.a-z]*)/.exec(line.trim());
        if (m) deps.push({ name: m[1], version: m[2] || "*", ecosystem: "PyPI" });
      }
    }
    for (let i = 0; i < Math.min(deps.length, 60); i += 20) {
      const batch = deps.slice(i, i + 20);
      try {
        const res = await fetch("https://api.osv.dev/v1/querybatch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries: batch.map(d => ({ package: { name: d.name, ecosystem: d.ecosystem }, version: d.version })) }),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (let j = 0; j < (data.results ?? []).length; j++) {
          const result = data.results[j]; const dep = batch[j];
          for (const vuln of (result?.vulns ?? []).slice(0, 3)) {
            const cvss = vuln.severity?.find((s: { type: string; score: string }) => s.type === "CVSS_V3")?.score
              ?? vuln.severity?.[0]?.score ?? 0;
            const cvssNum = typeof cvss === "string" ? parseFloat(cvss) : cvss;
            const sev = cvssNum >= 9 ? "critical" : cvssNum >= 7 ? "high" : cvssNum >= 4 ? "medium" : "low";
            out.push({
              scanner: "dependency", rule_id: vuln.id ?? "OSV-UNKNOWN", rule_name: vuln.id ?? "Known Vulnerability",
              severity: sev, title: `${dep.name}@${dep.version} — ${vuln.id ?? "Known CVE"}`,
              description: vuln.summary ?? vuln.details?.slice(0, 300) ?? "Vulnerable dependency",
              evidence: `${dep.name}@${dep.version}`, file_path: f.path, line_start: 1,
              owasp: ["A06:2021"], cwe: ["CWE-1035"],
              confidence_score: 0.95, risk_score: cvssNum ? Math.round(cvssNum * 10) : 50,
              remediation: `Upgrade ${dep.name} to the latest patched version. Check ${vuln.id} for specific version ranges.`,
            });
          }
        }
      } catch { continue; }
    }
  }
  return out;
}

function collectDependencyInventory(files: ScanFile[]): InventoryItem[] {
  const out: InventoryItem[] = [];
  for (const f of files) {
    const lower = f.path.toLowerCase();
    if (lower.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(f.content);
        const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
        for (const [name, version] of Object.entries(all)) out.push({ name, version: String(version), ecosystem: "npm", file_path: f.path, license: pkg.license });
      } catch { /* validation scanner reports this */ }
    }
    if (lower.endsWith("requirements.txt")) {
      for (const line of f.content.split("\n")) {
        const m = /^([A-Za-z0-9_.-]+)[>=!<~^]{0,2}([0-9][0-9.a-z*+-]*)/.exec(line.trim());
        if (m) out.push({ name: m[1], version: m[2] || "*", ecosystem: "PyPI", file_path: f.path });
      }
    }
    if (lower.endsWith("go.mod")) {
      for (const line of f.content.split("\n")) {
        const m = /^\s*([A-Za-z0-9_.\/-]+)\s+v([0-9][^\s]+)/.exec(line);
        if (m) out.push({ name: m[1], version: `v${m[2]}`, ecosystem: "Go", file_path: f.path });
      }
    }
    if (lower.endsWith("cargo.toml")) {
      for (const line of f.content.split("\n")) {
        const m = /^\s*([A-Za-z0-9_-]+)\s*=\s*["']([^"']+)["']/.exec(line);
        if (m) out.push({ name: m[1], version: m[2], ecosystem: "crates.io", file_path: f.path });
      }
    }
  }
  return out;
}

function runValidation(files: ScanFile[]): RawFinding[] {
  const out: RawFinding[] = [];
  for (const f of files) {
    const lower = f.path.toLowerCase();
    if (lower.endsWith(".json") || lower.endsWith("package.json")) {
      try { JSON.parse(f.content); } catch (err) {
        out.push({
          scanner: "iac", rule_id: "VALIDATION-JSON-001", rule_name: "Invalid JSON", severity: "medium",
          title: "Invalid JSON configuration", description: `JSON parsing failed in ${f.path}. Invalid config can disable security tooling or deployment controls.`,
          evidence: err instanceof Error ? err.message : String(err), file_path: f.path, line_start: 1,
          owasp: ["A05:2021"], cwe: ["CWE-20"], confidence_score: 0.98, risk_score: 45,
          remediation: "Fix the JSON syntax and validate it in CI before deployment.", metadata: { scan_type: "json_validation" },
        });
      }
    }
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
      const badTabs = f.content.split("\n").findIndex(line => /^\t+\S/.test(line));
      if (badTabs >= 0) {
        out.push({
          scanner: "iac", rule_id: "VALIDATION-YAML-001", rule_name: "Invalid YAML indentation", severity: "medium",
          title: "YAML contains tab indentation", description: "YAML parsers reject tab indentation; this can break infrastructure and CI/CD security controls.",
          evidence: f.content.split("\n")[badTabs].slice(0, 120), file_path: f.path, line_start: badTabs + 1,
          owasp: ["A05:2021"], cwe: ["CWE-20"], confidence_score: 0.95, risk_score: 42,
          remediation: "Replace tabs with spaces and run a YAML parser in CI.", metadata: { scan_type: "yaml_validation" },
        });
      }
    }
  }
  return out;
}

function runConfigAndContainer(files: ScanFile[]): RawFinding[] {
  const out: RawFinding[] = [];
  const rules = [
    { id: "CICD-GHA-PIN", name: "GitHub Action not pinned to SHA", type: "github_actions", re: /uses:\s+[^@\s]+@(?:main|master|latest|v\d+)/gi, sev: "medium", cwe: ["CWE-829"], remediation: "Pin third-party GitHub Actions to a full commit SHA." },
    { id: "CICD-AZURE-SECRETS", name: "Azure Pipeline echoes secrets", type: "azure_pipeline", re: /\b(script|bash|powershell):[\s\S]{0,200}\b(echo|Write-Host)\b.*(secret|token|password)/gi, sev: "high", cwe: ["CWE-532"], remediation: "Use masked variables and avoid printing secret-bearing values in pipeline logs." },
    { id: "CFN-IAM-WILDCARD", name: "CloudFormation wildcard IAM permission", type: "cloudformation", re: /Action:\s*['"]?\*['"]?|Resource:\s*['"]?\*['"]?/gi, sev: "high", cwe: ["CWE-266"], remediation: "Scope IAM actions and resources to the minimum required permissions." },
    { id: "ANSIBLE-HOSTKEY", name: "Ansible disables host key checking", type: "ansible", re: /host_key_checking\s*=\s*false/gi, sev: "high", cwe: ["CWE-295"], remediation: "Keep SSH host key checking enabled and manage known_hosts explicitly." },
    { id: "HELM-PRIV", name: "Helm chart deploys privileged container", type: "helm", re: /privileged:\s*true/gi, sev: "critical", cwe: ["CWE-250"], remediation: "Remove privileged mode and grant only required Linux capabilities." },
    { id: "DOCKER-ADD-REMOTE", name: "Dockerfile downloads remote content with ADD", type: "dockerfile", re: /^ADD\s+https?:\/\//gim, sev: "medium", cwe: ["CWE-494"], remediation: "Use curl with checksum verification or vendor trusted artifacts." },
    { id: "DOCKER-NO-HEALTHCHECK", name: "Dockerfile missing healthcheck", type: "dockerfile", re: /^FROM\s+/gim, sev: "low", cwe: ["CWE-693"], remediation: "Add a HEALTHCHECK instruction or document why orchestration provides it." },
  ];
  for (const f of files) {
    const type = classifyFileType(f.path);
    for (const rule of rules.filter(r => r.type === type)) {
      if (rule.id === "DOCKER-NO-HEALTHCHECK" && /HEALTHCHECK\s+/i.test(f.content)) continue;
      rule.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      const seen = new Set<number>();
      while ((m = rule.re.exec(f.content)) !== null) {
        const line = f.content.slice(0, m.index).split("\n").length;
        if (seen.has(line)) continue;
        seen.add(line);
        const confidence = rule.id === "DOCKER-NO-HEALTHCHECK" ? 0.65 : 0.9;
        out.push({
          scanner: rule.type === "dockerfile" ? "container" : "iac", rule_id: rule.id, rule_name: rule.name, severity: rule.sev,
          title: rule.name, description: `${rule.name} in ${f.path}.`, evidence: m[0].slice(0, 180), file_path: f.path, line_start: line,
          owasp: ["A05:2021"], cwe: rule.cwe, confidence_score: confidence, risk_score: sevToRisk(rule.sev, confidence),
          remediation: rule.remediation, metadata: { scan_type: type },
        });
      }
    }
  }
  return out;
}

function runLicenseScan(inventory: InventoryItem[]): RawFinding[] {
  const out: RawFinding[] = [];
  const risky = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-3.0", "SSPL-1.0"]);
  for (const dep of inventory) {
    if (!dep.license || !risky.has(dep.license)) continue;
    out.push({
      scanner: "license", rule_id: "LICENSE-COPYLEFT-001", rule_name: "Restrictive open-source license", severity: dep.license.startsWith("AGPL") || dep.license.startsWith("SSPL") ? "high" : "medium",
      title: `${dep.name} uses ${dep.license}`, description: "Dependency has a restrictive license that may require legal review before enterprise distribution.",
      evidence: `${dep.name}@${dep.version} ${dep.license}`, file_path: dep.file_path, line_start: 1,
      owasp: [], cwe: [], confidence_score: 0.85, risk_score: dep.license.startsWith("AGPL") ? 70 : 45,
      remediation: "Review license obligations and replace the dependency if it conflicts with company policy.", metadata: { package_name: dep.name, package_version: dep.version, license: dep.license },
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// AI PIPELINE — 3 LAYERS
// ─────────────────────────────────────────────────────────────

/**
 * LAYER 1 — Fast triage (Haiku/GPT-4o-mini/Gemini Flash)
 *
 * Purpose: Remove false positives quickly and cheaply before expensive analysis.
 * Input:   Top 20 critical+high findings with evidence + file context
 * Output:  Set of indices to remove
 * Model:   "fast" tier (~$0.001 per scan)
 *
 * Confidence adjustment: If AI marks something as FP with confidence > 0.7,
 * AND the finding's static confidence is already < 0.8, we remove it.
 * High-confidence static matches (conf >= 0.9) require AI confidence >= 0.9 to remove.
 */
async function layer1Triage(
  findings: RawFinding[],
  aiCfg: AIConfig,
  orgId: string,
  scanId: string
): Promise<Set<number>> {
  const fpSet = new Set<number>();
  const candidates = findings
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.severity === "critical" || f.severity === "high")
    .slice(0, 20);
  if (!candidates.length) return fpSet;

  const prompt = `You are a security triage expert. Classify each finding as a real vulnerability (true_positive) or a false positive (false_positive).

Key rules:
- Test files, spec files, example configs, placeholder values → false_positive
- Real API keys in production paths (.env without .example, src/, app/, lib/) → true_positive  
- SQL concatenation in test helpers with hardcoded data → false_positive
- Patterns with "example", "sample", "changeme", "REPLACE_ME" → false_positive
- Comments (lines starting with //, #, *) → false_positive

Findings to triage:
${candidates.map(({ f, i }) =>
  `${i}. [${f.severity.toUpperCase()}] ${f.rule_id}
   File: ${f.file_path}
   Evidence: ${f.evidence}
   Static confidence: ${f.confidence_score.toFixed(2)}`
).join("\n\n")}

Return JSON array ONLY. Example: [{"index":0,"verdict":"true_positive","confidence":0.95,"reason":"Real AWS key in production config"}]`;

  const res = await callAI(aiCfg, prompt, "fast", { orgId, scanId, skipCache: false });
  if (!res) return fpSet;

  const arr = extractJson<Array<{ index: number; verdict: string; confidence: number; reason?: string }>>(res.text);
  if (!arr) return fpSet;

  for (const item of arr) {
    if (item.verdict !== "false_positive") continue;
    const orig = candidates.find(c => c.i === item.index);
    if (!orig) continue;
    // High static confidence requires very high AI confidence to override
    const aiThreshold = orig.f.confidence_score >= 0.9 ? 0.90 : 0.70;
    if ((item.confidence ?? 0) >= aiThreshold) {
      fpSet.add(item.index);
      console.log(`[layer1] Removed FP: ${orig.f.rule_id} in ${orig.f.file_path} (AI: ${item.reason ?? ""})`);
    }
  }
  return fpSet;
}

/**
 * LAYER 2 — Deep analysis (Sonnet/GPT-4o/Gemini Pro)
 *
 * Purpose: Generate specific, actionable code fixes for critical/high findings.
 * Input:   Finding + 20 lines of actual code context + org policy chunks (RAG)
 * Output:  { explanation, remediation, policy_violations[] }
 * Model:   "medium" tier (~$0.01–0.05 per scan)
 *
 * RAG: Before calling AI, we retrieve the top-3 policy chunks whose embedding
 * is most similar to the finding. These are injected into the prompt so the
 * AI can reference org-specific standards.
 */
async function layer2Analyze(
  f: RawFinding,
  fileContent: string,
  aiCfg: AIConfig,
  orgId: string,
  scanId: string
): Promise<{ explanation: string; remediation: string; policy_violations: string[] }> {
  const lines = fileContent.split("\n");
  const ctx = lines.slice(Math.max(0, f.line_start - 5), Math.min(lines.length, f.line_start + 12)).join("\n");

  // RAG: retrieve matching policy chunks
  const policyContext = await retrievePolicyContext(f, orgId);
  const policySection = policyContext.length > 0
    ? `\n\nRelevant organization security policies:\n${policyContext.map((p, i) => `[Policy ${i+1}]: ${p}`).join("\n\n")}`
    : "";

  const prompt = `You are a senior security engineer. Analyze this ${f.severity.toUpperCase()} vulnerability and provide a specific, actionable fix.

FINDING: ${f.title}
Rule: ${f.rule_id} | CWE: ${f.cwe.join(", ")} | OWASP: ${f.owasp.join(", ")}
Location: ${f.file_path}:${f.line_start}
Evidence: ${f.evidence}

Code context (lines ${Math.max(1, f.line_start - 4)}–${f.line_start + 12}):
\`\`\`
${ctx}
\`\`\`
${policySection}

Provide a response with these exact sections:
**WHY THIS IS DANGEROUS** (2 sentences max — specific to this code, not generic)
**EXACT FIX** (show the broken code, then the fixed version with explanation)
**VERIFY** (one command or test to confirm the fix works)
${policyContext.length > 0 ? "**POLICY VIOLATIONS** (list which org policies this violates, one per line)" : ""}

Be specific to the actual code shown. Do not be generic.`;

  const res = await callAI(aiCfg, prompt, "medium", { orgId, scanId, maxTokens: 900 });
  if (!res) return { explanation: f.description, remediation: f.remediation ?? "", policy_violations: [] };

  // Extract policy violations section if present
  const policyViolations: string[] = [];
  const policyMatch = res.text.match(/\*\*POLICY VIOLATIONS\*\*([\s\S]*?)(?:\n\*\*|$)/);
  if (policyMatch) {
    policyViolations.push(...policyMatch[1].trim().split("\n").map(l => l.trim()).filter(l => l.startsWith("-") || l.startsWith("•") || l.match(/^[A-Z]/)).map(l => l.replace(/^[-•]\s*/, "")));
  }

  const whyMatch = res.text.match(/\*\*WHY THIS IS DANGEROUS\*\*([\s\S]*?)(?:\n\*\*|$)/);
  const explanation = whyMatch?.[1]?.trim() ?? f.description;

  return { explanation, remediation: res.text, policy_violations: policyViolations };
}

/**
 * LAYER 3 — Executive Summary (Opus/GPT-4o/Gemini Pro)
 *
 * Purpose: CISO-level 3-paragraph risk narrative for the scan report.
 * Input:   All verified findings, repo name, org name
 * Output:  Executive summary string stored in scans.summary.executive_summary
 * Model:   "deep" tier (~$0.03 per scan)
 * Skip:    If org config has disable_deep_tier=true OR < 5 findings
 */
async function layer3Summary(
  findings: RawFinding[],
  repoName: string,
  aiCfg: AIConfig,
  orgId: string,
  scanId: string
): Promise<string> {
  if (!findings.length) return "";
  if (aiCfg.disable_deep_tier) return "";

  const byScanner = findings.reduce((acc, f) => { acc[f.scanner] = (acc[f.scanner] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const topIssues = findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 8);

  const prompt = `You are a CISO writing a security briefing. Write a 3-paragraph executive summary for this scan.

Repository: ${repoName}
Scan results:
- Total findings: ${findings.length}
- Critical: ${findings.filter(f => f.severity === "critical").length}
- High: ${findings.filter(f => f.severity === "high").length}
- Medium: ${findings.filter(f => f.severity === "medium").length}
- Scanners: ${Object.entries(byScanner).map(([k, v]) => `${k}(${v})`).join(", ")}

Top issues:
${topIssues.map(f => `- [${f.severity.toUpperCase()}] ${f.title} in ${f.file_path}`).join("\n")}

Paragraph 1: Overall risk posture and immediate threat level (2-3 sentences).
Paragraph 2: Most critical specific issues and their business impact (3-4 sentences).  
Paragraph 3: Top 3 immediate actions required, ordered by priority.

Write for a business audience. Be direct, specific, and avoid jargon. No bullet points — flowing paragraphs only.`;

  const res = await callAI(aiCfg, prompt, "deep", { orgId, scanId, maxTokens: 600 });
  return res?.text ?? "";
}

// ─────────────────────────────────────────────────────────────
// RAG — Policy Document Retrieval
// ─────────────────────────────────────────────────────────────

/**
 * Retrieve relevant policy chunks for a finding using pgvector similarity search.
 *
 * Flow:
 * 1. Generate an embedding for the finding's title + rule_id + description (OpenAI text-embedding-3-small)
 * 2. Call match_policy_chunks RPC with the embedding vector
 * 3. Return top-3 chunk contents
 *
 * If no OpenAI key is available, falls back to keyword search.
 */
async function retrievePolicyContext(finding: RawFinding, orgId: string): Promise<string[]> {
  try {
    // First check if org has any policy chunks at all
    const { count } = await supabase.from("policy_chunks").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if (!count || count === 0) return [];

    // Try vector search if we have an OpenAI key
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey) {
      const queryText = `${finding.title} ${finding.rule_id} ${finding.description} ${finding.owasp.join(" ")} ${finding.cwe.join(" ")}`;
      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "text-embedding-3-small", input: queryText.slice(0, 4000) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (embRes.ok) {
        const embData = await embRes.json();
        const embedding = embData.data?.[0]?.embedding;
        if (embedding) {
          const { data } = await supabase.rpc("match_policy_chunks", {
            p_org_id: orgId, query_embedding: embedding, match_count: 3,
          });
          if (data?.length) {
            return (data as Array<{ content: string; similarity: number }>)
              .filter(d => d.similarity > 0.6)
              .map(d => d.content);
          }
        }
      }
    }

    // Keyword fallback: search policy content for related terms
    const keywords = [finding.scanner, ...finding.cwe, ...finding.owasp.map(o => o.split(":")[0])];
    const { data: chunks } = await supabase.from("policy_chunks").select("content")
      .eq("organization_id", orgId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(","))
      .limit(3);
    return (chunks ?? []).map(c => c.content);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────
// GITHUB FILE FETCHER
// ─────────────────────────────────────────────────────────────

async function fetchFromGitHub(
  fullName: string, branch: string, sha: string | null, token: string, changedFiles?: string[]
): Promise<ScanFile[]> {
  const hdrs = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "OmniGuard/1.0",
  };
  const ref = sha ?? branch;
  const files: ScanFile[] = [];

  if (changedFiles?.length) {
    for (const fp of changedFiles.slice(0, 150)) {
      const ext = fp.split(".").pop() ?? "";
      if (!SCAN_EXTS.has(ext.toLowerCase()) && !fp.toLowerCase().startsWith(".env") && !/dockerfile$/i.test(fp)) continue;
      if (SKIP_PATHS.some(s => fp.includes(s))) continue;
      try {
        const r = await fetch(`https://api.github.com/repos/${fullName}/contents/${fp}?ref=${ref}`, { headers: hdrs, signal: AbortSignal.timeout(8_000) });
        if (!r.ok) continue;
        const d = await r.json();
        if (d.encoding === "base64" && d.content) files.push({ path: fp, content: atob(d.content.replace(/\n/g, "")) });
      } catch { continue; }
    }
    return files;
  }

  try {
    const treeRes = await fetch(`https://api.github.com/repos/${fullName}/git/trees/${ref}?recursive=1`, { headers: hdrs, signal: AbortSignal.timeout(20_000) });
    if (!treeRes.ok) return files;
    const tree = await treeRes.json();
    const candidates = (tree.tree ?? []).filter((i: { type: string; path: string; size?: number; sha: string }) => {
      if (i.type !== "blob") return false;
      const fp = i.path;
      const ext = fp.split(".").pop()?.toLowerCase() ?? "";
      const base = fp.split("/").pop()?.toLowerCase() ?? "";
      if (!SCAN_EXTS.has(ext) && !base.startsWith(".env") && !/dockerfile$/i.test(base)) return false;
      if (SKIP_PATHS.some(s => fp.includes(s))) return false;
      if (i.size && i.size > 500_000) return false;
      return true;
    }).slice(0, 250);

    for (let b = 0; b < candidates.length; b += 10) {
      const batch = candidates.slice(b, b + 10);
      const settled = await Promise.allSettled(batch.map(async (item: { path: string; sha: string }) => {
        const r = await fetch(`https://api.github.com/repos/${fullName}/git/blobs/${item.sha}`, { headers: hdrs, signal: AbortSignal.timeout(8_000) });
        if (!r.ok) return null;
        const d = await r.json();
        return d.encoding === "base64" ? { path: item.path, content: atob(d.content.replace(/\n/g, "")) } : null;
      }));
      for (const r of settled) if (r.status === "fulfilled" && r.value) files.push(r.value);
    }
  } catch (e) { console.error("GitHub tree fetch error:", e); }
  return files;
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────

async function checkRateLimit(orgId: string, action: string, windowSec: number, maxCount: number): Promise<boolean> {
  try {
    const { data } = await supabase.rpc("check_rate_limit", {
      p_key: `org:${orgId}:${action}`,
      p_window_seconds: windowSec,
      p_max_count: maxCount,
    });
    return data === true;
  } catch { return true; /* allow on error */ }
}

async function runPolicyRules(files: ScanFile[], orgId: string): Promise<RawFinding[]> {
  const { data: policies } = await supabase.from("policies")
    .select("id, name, severity, content, compliance_mappings, tags")
    .eq("organization_id", orgId).eq("enabled", true).is("deleted_at", null);
  const out: RawFinding[] = [];
  for (const policy of policies ?? []) {
    let parsed: { rules?: Array<{ id?: string; title?: string; pattern?: string; file_glob?: string; severity?: string; remediation?: string; compliance?: string[] }> } | null = null;
    try { parsed = JSON.parse(policy.content); } catch { parsed = null; }
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : [];
    for (const rule of rules) {
      if (!rule.pattern) continue;
      let re: RegExp;
      try { re = new RegExp(rule.pattern, "gim"); } catch { continue; }
      for (const file of files) {
        if (rule.file_glob && !file.path.toLowerCase().includes(rule.file_glob.toLowerCase().replace(/\*/g, ""))) continue;
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        const seen = new Set<number>();
        while ((m = re.exec(file.content)) !== null) {
          const line = file.content.slice(0, m.index).split("\n").length;
          if (seen.has(line)) continue;
          seen.add(line);
          const sev = rule.severity ?? policy.severity ?? "medium";
          out.push({
            scanner: "policy", rule_id: rule.id ?? `POLICY-${policy.id}`, rule_name: rule.title ?? policy.name, severity: sev,
            title: rule.title ?? `Policy violation: ${policy.name}`,
            description: `Organization policy "${policy.name}" matched this code or configuration.`,
            evidence: m[0].slice(0, 180), file_path: file.path, line_start: line,
            owasp: [], cwe: [], confidence_score: 0.88, risk_score: sevToRisk(sev, 0.88),
            remediation: rule.remediation ?? "Update the implementation to satisfy the referenced organization policy.",
            metadata: { policy_id: policy.id, compliance: rule.compliance ?? policy.compliance_mappings ?? [] },
          });
        }
      }
    }
  }
  return out;
}

async function applySuppressionLearning(findings: RawFinding[], orgId: string): Promise<RawFinding[]> {
  const { data: rules } = await supabase.from("organization_suppression_rules")
    .select("*").eq("organization_id", orgId).eq("active", true);
  if (!rules?.length) return findings;
  return findings.map(f => {
    const match = rules.find((r: Record<string, unknown>) =>
      (!r.rule_id || r.rule_id === f.rule_id) &&
      (!r.scanner || r.scanner === f.scanner) &&
      (!r.file_pattern || f.file_path.includes(String(r.file_pattern)))
    );
    if (!match) return f;
    const fp = Math.min(0.95, Number(match.false_positive_likelihood ?? 0.5));
    return {
      ...f,
      severity: fp >= 0.8 ? "info" : f.severity,
      risk_score: Math.round(f.risk_score * (1 - fp * 0.65)),
      confidence_score: Math.max(0.1, f.confidence_score * (1 - fp * 0.4)),
      metadata: { ...(f.metadata ?? {}), suppression_learning: match.id, false_positive_likelihood: fp },
    };
  });
}

function makeCycloneDxSbom(repoName: string, inventory: InventoryItem[]) {
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: repoName } },
    components: inventory.map(dep => ({
      type: "library", name: dep.name, version: dep.version, purl: `pkg:${dep.ecosystem.toLowerCase()}/${dep.name}@${dep.version}`,
      licenses: dep.license ? [{ license: { id: dep.license } }] : undefined,
      properties: [{ name: "omniguard:file_path", value: dep.file_path }],
    })),
  };
}

async function persistScanArtifact(scanId: string, orgId: string, artifactType: string, filename: string, body: unknown): Promise<void> {
  const content = JSON.stringify(body);
  await supabase.from("scan_artifacts").insert({
    scan_id: scanId, organization_id: orgId, artifact_type: artifactType, filename,
    storage_path: `inline://${scanId}/${filename}`, size_bytes: content.length, mime_type: "application/json",
    metadata: { inline: true, content },
  });
}

function calculateRepositoryRisk(findings: RawFinding[], inventory: InventoryItem[]): number {
  if (!findings.length) return inventory.length > 200 ? 8 : 0;
  const openRisk = findings.reduce((sum, f) => sum + f.risk_score, 0) / findings.length;
  const criticalPenalty = findings.filter(f => f.severity === "critical").length * 6;
  const highPenalty = findings.filter(f => f.severity === "high").length * 3;
  const secretPenalty = findings.some(f => f.scanner === "secret") ? 8 : 0;
  const depHealthPenalty = Math.min(10, Math.floor(inventory.length / 75));
  return Math.max(0, Math.min(100, Math.round(openRisk + criticalPenalty + highPenalty + secretPenalty + depHealthPenalty)));
}

// ─────────────────────────────────────────────────────────────
// MAIN SCAN ORCHESTRATOR
// ─────────────────────────────────────────────────────────────

async function processScan(scanId: string, repoId: string, orgId: string): Promise<void> {
  const t0 = Date.now();

  await supabase.from("scans").update({ status: "running", started_at: new Date().toISOString(), worker_id: WORKER_ID }).eq("id", scanId);
  await supabase.from("worker_heartbeats").upsert(
    { worker_id: WORKER_ID, worker_type: "scanner", status: "busy", current_scan_id: scanId, last_heartbeat: new Date().toISOString() },
    { onConflict: "worker_id" }
  );

  try {
    // ── Load scan, repo, org config ───────────────────────────
    const [{ data: scan }, { data: repo }, { data: org }] = await Promise.all([
      supabase.from("scans").select("branch, commit_sha, metadata, scan_type").eq("id", scanId).single(),
      supabase.from("repositories").select("*").eq("id", repoId).single(),
      supabase.from("organizations").select("ai_config, rate_limits").eq("id", orgId).single(),
    ]);
    if (!repo) throw new Error("Repository not found");

    const rateLimits = (org?.rate_limits as Record<string, number> | null) ?? {};
    const scansPerHour = rateLimits.scans_per_hour ?? 20;

    // ── Rate limit check ──────────────────────────────────────
    const allowed = await checkRateLimit(orgId, "scans", 3600, scansPerHour);
    if (!allowed) {
      await supabase.from("scans").update({ status: "failed", error_message: `Rate limit exceeded: max ${scansPerHour} scans per hour`, completed_at: new Date().toISOString() }).eq("id", scanId);
      return;
    }

    // ── Resolve AI config ─────────────────────────────────────
    const aiCfg = await resolveAIConfigFromOrg(orgId);
    console.log(`[scan-worker] ${scanId}: org=${orgId} repo=${repo.full_name} AI=${aiCfg.provider}`);

    // ── Fetch files ───────────────────────────────────────────
    let files: ScanFile[] = [];
    const { data: integration } = await supabase.from("integrations")
      .select("config").eq("organization_id", orgId).eq("provider", "github").eq("status", "active").maybeSingle();
    const token = (integration?.config as Record<string, string>)?.access_token ?? Deno.env.get("GITHUB_TOKEN");
    if (token) {
      const changedFiles = (scan?.metadata as Record<string, unknown>)?.changed_files as string[] | undefined;
      files = await fetchFromGitHub(repo.full_name, scan?.branch ?? repo.default_branch, scan?.commit_sha ?? null, token, changedFiles);
    }

    if (!files.length) {
      const msg = token ? "No scannable files found in repository" : "No GitHub token configured — add one in Settings → Integrations";
      await supabase.from("scans").update({ status: "completed", completed_at: new Date().toISOString(), duration_seconds: Math.round((Date.now() - t0) / 1000), summary: { files_scanned: 0, total: 0, message: msg } }).eq("id", scanId);
      await supabase.from("worker_heartbeats").upsert({ worker_id: WORKER_ID, status: "idle", last_heartbeat: new Date().toISOString() }, { onConflict: "worker_id" });
      return;
    }

    // ── Layer 0: Parallel regex scanners ─────────────────────
    const technology = buildTechnologyInventory(files);
    const inventory = collectDependencyInventory(files);
    const scanType = scan?.scan_type ?? "full";
    const enabled = new Set<string>(
      scanType === "full" ? ["secret", "sast", "iac", "dependency", "container", "license", "policy", "validation"] :
      scanType === "incremental" ? ["secret", "sast", "iac", "dependency", "container", "license", "policy", "validation"] :
      scanType === "quick" ? ["secret", "sast", "iac", "validation"] :
      scanType === "secrets" ? ["secret"] :
      scanType === "dependencies" ? ["dependency", "license"] :
      scanType === "container" ? ["container"] :
      scanType === "dockerfile" ? ["container"] :
      ["terraform", "kubernetes", "github_actions", "azure_pipeline", "cloudformation", "ansible", "helm", "yaml", "json", "config"].includes(scanType) ? ["iac", "validation", "container"] :
      scanType === "license" ? ["license"] :
      scanType === "sbom" || scanType === "inventory" ? ["dependency", "license"] :
      scanType === "policy" ? ["policy"] :
      [scanType]
    );
    const [secrets, sast, iac, deps, validation, configContainer, licenses, policyRules] = await Promise.all([
      enabled.has("secret") ? Promise.resolve(runSecrets(files)) : Promise.resolve([]),
      enabled.has("sast") ? Promise.resolve(runSAST(files)) : Promise.resolve([]),
      enabled.has("iac") ? Promise.resolve(runIaC(files)) : Promise.resolve([]),
      enabled.has("dependency") ? runDependencies(files) : Promise.resolve([]),
      enabled.has("validation") ? Promise.resolve(runValidation(files)) : Promise.resolve([]),
      enabled.has("container") || enabled.has("iac") ? Promise.resolve(runConfigAndContainer(files)) : Promise.resolve([]),
      enabled.has("license") ? Promise.resolve(runLicenseScan(inventory)) : Promise.resolve([]),
      enabled.has("policy") ? runPolicyRules(files, orgId) : Promise.resolve([]),
    ]);
    const rawBeforeLearning = [...secrets, ...sast, ...iac, ...deps, ...validation, ...configContainer, ...licenses, ...policyRules];
    const raw = await applySuppressionLearning(rawBeforeLearning, orgId);
    console.log(`[scan-worker] ${scanId}: Layer 0 → ${raw.length} raw findings (${secrets.length} secrets, ${sast.length} SAST, ${iac.length} IaC, ${deps.length} deps)`);

    // ── Layer 1: AI fast triage — remove false positives ─────
    let verified = raw;
    if (aiCfg.provider !== "none") {
      const fpIndices = await layer1Triage(raw, aiCfg, orgId, scanId);
      verified = raw.filter((_, i) => !fpIndices.has(i));
      console.log(`[scan-worker] ${scanId}: Layer 1 → removed ${fpIndices.size} FPs, ${verified.length} verified`);
    }

    // ── Layer 2: Deep analysis for critical+high ─────────────
    const fileMap = new Map(files.map(f => [f.path, f.content]));
    const l2Map = new Map<string, { explanation: string; remediation: string; policy_violations: string[] }>();

    if (aiCfg.provider !== "none") {
      const critHigh = verified.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 12);
      // Cap total tokens per scan
      const maxTokens = (aiCfg.max_tokens_per_scan ?? 50000);
      let tokensUsed = 0;

      for (const finding of critHigh) {
        if (tokensUsed >= maxTokens) { console.log(`[scan-worker] ${scanId}: Token cap reached, skipping remaining L2 analysis`); break; }
        const key = `${finding.rule_id}:${finding.file_path}:${finding.line_start}`;
        const analysis = await layer2Analyze(finding, fileMap.get(finding.file_path) ?? "", aiCfg, orgId, scanId);
        l2Map.set(key, analysis);
        tokensUsed += 1800; // approximate per finding
      }
      console.log(`[scan-worker] ${scanId}: Layer 2 → analyzed ${l2Map.size} findings`);
    }

    // ── Layer 3: Executive summary ────────────────────────────
    let execSummary = "";
    if (aiCfg.provider !== "none" && verified.length >= 3) {
      execSummary = await layer3Summary(verified, repo.full_name, aiCfg, orgId, scanId);
      if (execSummary) console.log(`[scan-worker] ${scanId}: Layer 3 → executive summary generated`);
    }

    // ── Persist findings ──────────────────────────────────────
    if (verified.length > 0) {
      const rows = verified.map(f => {
        const key = `${f.rule_id}:${f.file_path}:${f.line_start}`;
        const l2 = l2Map.get(key);
        return {
          organization_id: orgId, repository_id: repoId, scan_id: scanId,
          scanner: f.scanner, category: f.rule_name, severity: f.severity,
          title: f.title, description: l2?.explanation ?? f.description,
          evidence: f.evidence, file_path: f.file_path, line_start: f.line_start, line_end: f.line_start,
          rule_id: f.rule_id, rule_name: f.rule_name, owasp: f.owasp, cwe: f.cwe,
          cvss_score: f.cvss_score ?? null, cve_id: f.cve_id ?? null,
          package_name: f.package_name ?? (f.metadata?.package_name as string | undefined) ?? null,
          package_version: f.package_version ?? (f.metadata?.package_version as string | undefined) ?? null,
          status: "open", risk_score: f.risk_score, confidence_score: f.confidence_score,
          false_positive_likelihood: (f.metadata?.false_positive_likelihood as number | undefined) ?? Math.max(0, 1 - f.confidence_score),
          remediation: f.remediation ?? null,
          ai_summary: l2?.explanation ?? null, ai_remediation: l2?.remediation ?? null,
          ai_provider: aiCfg.provider, ai_model: null,
          policy_violations: l2?.policy_violations ?? [],
          business_impact: f.severity === "critical" ? "Potential production compromise, regulatory exposure, or credential loss requiring immediate response." : null,
          suggested_commit: f.remediation ? `fix(security): remediate ${f.rule_id}` : null,
          references: f.references ?? [],
          fingerprint: await hashText(`${orgId}:${repoId}:${f.scanner}:${f.rule_id}:${f.file_path}:${f.line_start}:${f.title}`),
          metadata: { ...(f.metadata ?? {}), ai_remediation_details: l2?.remediation ? { confidence_score: f.confidence_score, root_cause: f.rule_name, regression_warnings: [] } : undefined },
        };
      });
      for (let i = 0; i < rows.length; i += 50) {
        await supabase.from("findings").insert(rows.slice(i, i + 50));
      }
    }

    await persistScanArtifact(scanId, orgId, "sbom", "sbom.cyclonedx.json", makeCycloneDxSbom(repo.full_name, inventory));
    await persistScanArtifact(scanId, orgId, "dependency_tree", "dependency-inventory.json", { repository: repo.full_name, dependencies: inventory });

    // ── Finalize scan record ──────────────────────────────────
    const dur = Math.round((Date.now() - t0) / 1000);
    const summary = {
      files_scanned:         files.length,
      total:                 verified.length,
      critical:              verified.filter(f => f.severity === "critical").length,
      high:                  verified.filter(f => f.severity === "high").length,
      medium:                verified.filter(f => f.severity === "medium").length,
      low:                   verified.filter(f => f.severity === "low").length,
      false_positives_removed: raw.length - verified.length,
      by_scanner: {
        secret: verified.filter(f => f.scanner === "secret").length,
        sast: verified.filter(f => f.scanner === "sast").length,
        iac: verified.filter(f => f.scanner === "iac").length,
        dependency: verified.filter(f => f.scanner === "dependency").length,
        container: verified.filter(f => f.scanner === "container").length,
        license: verified.filter(f => f.scanner === "license").length,
        policy: verified.filter(f => f.scanner === "policy").length,
      },
      scan_type:              scanType,
      technologies:           technology,
      dependency_inventory:   { total: inventory.length, ecosystems: Array.from(new Set(inventory.map(d => d.ecosystem))).sort() },
      ai_provider:           aiCfg.provider,
      ai_layers_used:        aiCfg.provider !== "none" ? 3 : 0,
      executive_summary:     execSummary || undefined,
    };
    await supabase.from("scans").update({ status: "completed", completed_at: new Date().toISOString(), duration_seconds: dur, summary }).eq("id", scanId);

    // ── Update repo risk score ────────────────────────────────
    const repoRisk = calculateRepositoryRisk(verified, inventory);
    await supabase.from("repositories").update({ risk_score: repoRisk, last_scan_at: new Date().toISOString(), language: Object.entries(technology.languages).sort((a, b) => b[1] - a[1])[0]?.[0] ?? repo.language }).eq("id", repoId);
    await supabase.from("project_risk_history").insert({ organization_id: orgId, repository_id: repoId, scan_id: scanId, score: repoRisk, factors: summary });

    // ── Notify org admins of critical findings ────────────────
    if (summary.critical > 0) {
      const { data: admins } = await supabase.from("organization_members").select("user_id").eq("organization_id", orgId).in("role", ["owner", "admin"]);
      if (admins?.length) {
        await supabase.from("notifications").insert(admins.map(a => ({
          organization_id: orgId, user_id: a.user_id, type: "critical_finding",
          title: `${summary.critical} Critical Finding${summary.critical > 1 ? "s" : ""} in ${repo.full_name}`,
          body: execSummary ? execSummary.split(".")[0] + "." : `${summary.critical} critical vulnerabilities require immediate attention.`,
          data: { scan_id: scanId, repository_id: repoId, critical: summary.critical, high: summary.high },
        })));
      }
      // Fire notify-deliver for Slack/email
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ type: "scan_completed", organization_id: orgId, scan_id: scanId }),
      }).catch(() => {});
    }

    // ── Audit log ─────────────────────────────────────────────
    await supabase.from("audit_logs").insert({
      organization_id: orgId, action: "scan_completed", resource_type: "scan", resource_id: scanId,
      metadata: { findings: verified.length, duration_seconds: dur, files: files.length, ai: aiCfg.provider, fp_removed: raw.length - verified.length },
    });
    await supabase.from("worker_heartbeats").upsert({ worker_id: WORKER_ID, status: "idle", current_scan_id: null, last_heartbeat: new Date().toISOString() }, { onConflict: "worker_id" });

  } catch (err) {
    console.error(`[scan-worker] FAILED ${scanId}:`, err);
    await supabase.from("scans").update({ status: "failed", error_message: err instanceof Error ? err.message : String(err), completed_at: new Date().toISOString(), duration_seconds: Math.round((Date.now() - t0) / 1000) }).eq("id", scanId);
    await supabase.from("worker_heartbeats").upsert({ worker_id: WORKER_ID, status: "error", current_scan_id: null, last_heartbeat: new Date().toISOString() }, { onConflict: "worker_id" });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const url = new URL(req.url);
  const j = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return j({ worker_id: WORKER_ID, status: "healthy", timestamp: new Date().toISOString() });
  }

  if (req.method === "GET" && url.pathname.endsWith("/process")) {
    const { data } = await supabase.rpc("claim_next_scan", { p_worker_id: WORKER_ID });
    const job = Array.isArray(data) ? data[0] : data;
    if (!job?.scan_id) return j({ success: true, message: "No pending scans" });
    await processScan(job.scan_id, job.repository_id, job.organization_id);
    return j({ success: true, scan_id: job.scan_id });
  }

  if (req.method === "POST" && url.pathname.endsWith("/process")) {
    const body = await req.json().catch(() => ({}));
    if (!body.scan_id || !body.repository_id || !body.organization_id) return j({ error: "scan_id, repository_id, organization_id required" }, 400);
    // Process async — return immediately so API doesn't time out
    processScan(body.scan_id, body.repository_id, body.organization_id).catch(console.error);
    return j({ success: true, scan_id: body.scan_id, message: "Scan started" });
  }

  return j({ error: "Not found" }, 404);
});
