#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const https = require('https')
const readline = require('readline')
const { execSync, spawn } = require('child_process')

const VERSION = '1.0.0'
const HOME = os.homedir()
const DIR = path.join(HOME, '.omniguard')
const CONFIG_FILE = path.join(DIR, 'config.json')
const PID_FILE = path.join(DIR, 'daemon.pid')
const LOG_FILE = path.join(DIR, 'daemon.log')

const c = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  blue: s => `\x1b[34m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
}

function ensureDir() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true, mode: 0o700 })
}

function readJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

function writeJSON(file, data) {
  ensureDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 })
}

function cfg() {
  const raw = readJSON(CONFIG_FILE, {})
  const profile = raw.activeProfile || 'default'
  const profiles = raw.profiles || {}
  const active = profiles[profile] || {}
  return {
    profile,
    profiles,
    active,
    backendUrl: process.env.OMNIGUARD_URL || active.backendUrl || raw.backendUrl || '',
    apiKey: process.env.OMNIGUARD_API_KEY || active.apiKey || '',
    orgId: process.env.OMNIGUARD_ORG_ID || active.orgId || '',
    failOn: process.env.OMNIGUARD_FAIL_ON || active.failOn || 'critical',
    dashboardUrl: active.dashboardUrl || process.env.OMNIGUARD_DASHBOARD_URL || '',
  }
}

function normalizeBackendUrl(url) {
  if (!url) return ''
  return url.replace(/\/$/, '').replace(/\/functions\/v1$/, '')
}

function functionUrl(base, fn) {
  const normalized = normalizeBackendUrl(base)
  return `${normalized}/functions/v1/${fn}`
}

function saveProfile(patch) {
  const raw = readJSON(CONFIG_FILE, { activeProfile: 'default', profiles: {} })
  const name = patch.profile || raw.activeProfile || 'default'
  raw.activeProfile = name
  raw.profiles = raw.profiles || {}
  raw.profiles[name] = { ...(raw.profiles[name] || {}), ...patch }
  writeJSON(CONFIG_FILE, raw)
}

function removeProfileSecret(profile = 'default') {
  const raw = readJSON(CONFIG_FILE, { activeProfile: 'default', profiles: {} })
  if (raw.profiles?.[profile]) {
    delete raw.profiles[profile].apiKey
    writeJSON(CONFIG_FILE, raw)
  }
}

function request(url, { method = 'GET', headers = {} } = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    }, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        let parsed = data
        try { parsed = data ? JSON.parse(data) : {} } catch {}
        resolve({ ok: (res.statusCode || 0) < 300, status: res.statusCode || 0, body: parsed, headers: res.headers })
      })
    })
    req.on('error', reject)
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

function prompt(question, hidden = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (!hidden) return rl.question(question, answer => { rl.close(); resolve(answer) })
    process.stdout.write(question)
    const stdin = process.stdin
    const onData = chunk => {
      const s = chunk.toString('utf8')
      if (s === '\n' || s === '\r' || s === '\u0004') {
        process.stdout.write('\n')
        stdin.removeListener('data', onData)
        rl.close()
        resolve(buf)
        return
      }
      if (s === '\u0003') process.exit(130)
      buf += s
    }
    let buf = ''
    stdin.on('data', onData)
    stdin.resume()
  })
}

const SECRET_RULES = [
  { id: 'SECRET-AWS-001', name: 'AWS Access Key', re: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, sev: 'critical' },
  { id: 'SECRET-GH-001', name: 'GitHub PAT', re: /gh[pousr]_[A-Za-z0-9_]{36,}/g, sev: 'critical' },
  { id: 'SECRET-OPENAI-001', name: 'OpenAI Key', re: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g, sev: 'critical' },
  { id: 'SECRET-ANTHROPIC-001', name: 'Anthropic Key', re: /sk-ant-[A-Za-z0-9\-_]{95,}/g, sev: 'critical' },
  { id: 'SECRET-DB-001', name: 'Database URL', re: /(postgres|mysql|mongodb|redis|mssql):\/\/[^:\s]+:[^@\s]+@[^\s'"]{5,}/gi, sev: 'critical' },
  { id: 'SECRET-PASS-001', name: 'Hardcoded Password', re: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"'\s]{8,})["']/gim, sev: 'high' },
  { id: 'SECRET-JWT-001', name: 'JWT Token', re: /eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,}/g, sev: 'high' },
]
const SKIP_FP = /(?:test|example|sample|placeholder|changeme|your[-_]?api|xxx|<|>|\$\{|\$\(|foobar|00000000)/i
const SKIP_COMMENT = /^\s*(\/\/|#|\*|<!--)/
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'vendor', 'coverage', '.nyc_output'])
const SCAN_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.cs', '.rs', '.swift', '.kt', '.scala', '.c', '.cpp', '.h', '.env', '.yaml', '.yml', '.json', '.toml', '.ini', '.conf', '.config', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1', '.xml', '.properties', '.tf', '.tfvars', '.hcl', '.dockerfile', '.Dockerfile'])
const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }

function localScan(filePath, content) {
  const findings = []
  const lines = content.split('\n')
  for (const rule of SECRET_RULES) {
    rule.re.lastIndex = 0
    let m
    const seen = new Set()
    while ((m = rule.re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length
      if (seen.has(lineNum)) continue
      seen.add(lineNum)
      const lineText = lines[lineNum - 1] || ''
      if (SKIP_COMMENT.test(lineText) || SKIP_FP.test(m[0])) continue
      findings.push({
        scanner: 'secret',
        rule_id: rule.id,
        severity: rule.sev,
        title: `${rule.name} detected`,
        evidence: m[0].length <= 8 ? '****' : `${m[0].slice(0, 4)}...(${m[0].length})...${m[0].slice(-4)}`,
        file_path: filePath,
        line_start: lineNum,
      })
    }
  }
  return findings
}

function walkDir(dir) {
  const out = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    if (!fs.existsSync(current)) continue
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry)
      try {
        const st = fs.statSync(full)
        if (st.isDirectory()) {
          if (!SKIP_DIRS.has(entry)) stack.push(full)
        } else if (entry === 'Dockerfile' || SCAN_EXTS.has(path.extname(entry))) {
          out.push(full)
        }
      } catch {}
    }
  }
  return out
}

function getGitFiles(args) {
  try {
    const cmd = args?.length ? args.join(' ') : 'git ls-files'
    const raw = args?.length ? execSync(`git diff --name-only ${cmd}`, { encoding: 'utf8' }) : execSync(cmd, { encoding: 'utf8' })
    return raw.split('\n').map(s => s.trim()).filter(Boolean).map(f => path.resolve(f)).filter(f => fs.existsSync(f))
  } catch {
    return walkDir(process.cwd())
  }
}

async function remoteScan(filePath, content) {
  const c = cfg()
  if (!c.backendUrl || !c.apiKey) return null
  try {
    const res = await request(functionUrl(c.backendUrl, 'scan-quick'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.apiKey}` },
    }, { path: filePath, content, organization_id: c.orgId || undefined })
    if (res.ok && res.body && Array.isArray(res.body.findings)) return res.body.findings
  } catch {}
  return null
}

async function scanFiles(files) {
  const findings = []
  for (const f of files) {
    let content = ''
    try { content = fs.readFileSync(f, 'utf8') } catch { continue }
    if (!content.trim()) continue
    const remote = await remoteScan(f, content)
    findings.push(...(remote || localScan(f, content)))
  }
  return findings
}

function printFinding(f) {
  const color = { critical: c.red, high: c.yellow, medium: c.yellow, low: c.cyan, info: c.dim }[f.severity] || c.dim
  console.log(`  ${color(`[${String(f.severity || 'info').toUpperCase()}]`)} ${c.bold(f.title)}`)
  console.log(`    ${c.dim('File:')} ${f.file_path}:${f.line_start}  ${c.dim('Rule:')} ${f.rule_id}${f.fingerprint ? `  ${c.dim('Fingerprint:')} ${f.fingerprint.slice(0, 12)}` : ''}`)
  if (f.evidence) console.log(`    ${c.dim('Evidence:')} ${f.evidence}`)
  if (f.ai_explanation) console.log(`    ${c.dim('AI:')} ${f.ai_explanation}`)
}

function shouldFail(findings) {
  const threshold = SEVERITY_ORDER[cfg().failOn] ?? 4
  return findings.some(f => (SEVERITY_ORDER[f.severity] ?? 0) >= threshold)
}

async function backendCall(method, endpoint, body) {
  const c0 = cfg()
  if (!c0.backendUrl || !c0.apiKey) throw new Error('Not authenticated. Run `omniguard login`.')
  return request(`${c0.backendUrl}${endpoint}`, { method, headers: { Authorization: `Bearer ${c0.apiKey}` } }, body)
}

async function cmdLogin() {
  const current = cfg()
  console.log(c.bold('\nOmniGuard Login\n'))
  const backendUrl = normalizeBackendUrl((await prompt(`Supabase URL (${current.backendUrl || 'https://xyz.supabase.co'}): `)).trim() || current.backendUrl)
  const apiKey = (await prompt('API Key: ', true)).trim()
  if (!backendUrl || !apiKey) throw new Error('Backend URL and API key are required')
  const res = await request(functionUrl(backendUrl, 'api-v1-status'), { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) throw new Error(`Login failed (${res.status})`)
  saveProfile({ profile: current.profile, backendUrl, apiKey, orgId: res.body?.organization_id || current.orgId || '' })
  console.log(c.green('✓ Logged in'))
}

async function cmdLogout() {
  const current = cfg()
  removeProfileSecret(current.profile)
  console.log(c.green('✓ Logged out'))
}

async function cmdWhoami() {
  const c0 = cfg()
  console.log(JSON.stringify({ profile: c0.profile, backendUrl: c0.backendUrl, organizationId: c0.orgId || null, authenticated: !!c0.apiKey }, null, 2))
}

async function cmdOrganizations() {
  const c0 = cfg()
  if (!c0.backendUrl || !c0.apiKey) throw new Error('Run `omniguard login` first')
  const res = await request(functionUrl(c0.backendUrl, 'api-v1-status'), { headers: { Authorization: `Bearer ${c0.apiKey}` } })
  if (!res.ok) throw new Error(`Status check failed (${res.status})`)
  console.log(c.bold('Organization context'))
  console.log(`  active org: ${c0.orgId || 'not selected'}`)
  console.log(`  health: ${res.body?.status || 'unknown'}`)
}

async function cmdSwitchOrg(args) {
  const orgId = args[0]
  if (!orgId) throw new Error('Usage: omniguard switch-org <organization-id>')
  const current = cfg()
  saveProfile({ profile: current.profile, backendUrl: current.backendUrl, apiKey: current.apiKey, orgId })
  console.log(c.green(`✓ Switched active org to ${orgId}`))
}

async function cmdScan(args) {
  const c0 = cfg()
  const sub = args[0]
  if (sub === 'remote') return cmdScanRemote(args.slice(1))
  const staged = args.includes('--staged')
  const json = args.includes('--json')
  const files = staged ? getGitFiles() : (args.filter(a => !a.startsWith('-')).length ? args.filter(a => !a.startsWith('-')).flatMap(p => fs.existsSync(p) && fs.statSync(p).isDirectory() ? walkDir(path.resolve(p)) : [path.resolve(p)]) : walkDir(process.cwd()))
  if (!files.length) return console.log(c.green('✓ No files to scan'))
  const findings = await scanFiles(files)
  if (json) return console.log(JSON.stringify({ files_scanned: files.length, total: findings.length, findings }, null, 2))
  console.log(c.blue(`Scanning ${files.length} file(s)...`))
  if (!findings.length) return console.log(c.green('✓ No findings'))
  for (const f of findings.sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0))) printFinding(f)
  process.exitCode = shouldFail(findings) ? 1 : 0
}

async function cmdWatch(args) {
  const dir = args.find(a => !a.startsWith('-')) || '.'
  const abs = path.resolve(dir)
  console.log(c.blue(`Watching ${abs}...`))
  const seen = new Map()
  const timer = setInterval(async () => {
    const files = walkDir(abs)
    const target = files.filter(f => {
      try {
        const m = fs.statSync(f).mtimeMs
        if (seen.get(f) === m) return false
        seen.set(f, m)
        return true
      } catch { return false }
    })
    if (!target.length) return
    const findings = await scanFiles(target)
    if (findings.length) console.log(c.yellow(`Detected ${findings.length} finding(s) in ${target.length} changed file(s)`))
  }, 1500)
  process.on('SIGINT', () => { clearInterval(timer); process.exit(0) })
}

async function cmdStatus() {
  const c0 = cfg()
  if (!c0.backendUrl || !c0.apiKey) throw new Error('Not authenticated')
  const res = await request(functionUrl(c0.backendUrl, 'api-v1-status'), { headers: { Authorization: `Bearer ${c0.apiKey}` } })
  if (!res.ok) throw new Error(`Status check failed (${res.status})`)
  console.log(c.green(`✓ OmniGuard ${res.body?.status || 'healthy'}`))
  if (res.body?.checks) console.log(`  AI: ${res.body.checks.ai?.provider || 'none'}  DB: ${res.body.checks.database?.status || 'unknown'}`)
}

async function cmdDoctor() {
  const checks = []
  checks.push(['node', !!process.version, process.version])
  checks.push(['git', (() => { try { execSync('git --version', { stdio: 'ignore' }); return true } catch { return false } })()])
  const c0 = cfg()
  checks.push(['config', !!c0.backendUrl, c0.backendUrl || 'unset'])
  for (const [name, ok, detail] of checks) console.log(`${ok ? c.green('✓') : c.yellow('!')} ${name}: ${detail}`)
}

async function cmdConfig(args) {
  const [sub, key, value] = args
  const current = cfg()
  if (!sub || sub === 'show') return console.log(JSON.stringify(current, null, 2))
  if (sub === 'set') {
    if (!key) throw new Error('Usage: omniguard config set <key> <value>')
    saveProfile({ profile: current.profile, backendUrl: key === 'backendUrl' ? value : current.backendUrl, apiKey: key === 'apiKey' ? value : current.apiKey, orgId: key === 'orgId' ? value : current.orgId, failOn: key === 'failOn' ? value : current.failOn })
    return console.log(c.green(`✓ Updated ${key}`))
  }
  if (sub === 'profile') {
    const name = key || 'default'
    saveProfile({ profile: name, ...(current.profiles?.[name] || {}) })
    return console.log(c.green(`✓ Active profile set to ${name}`))
  }
  throw new Error('Usage: omniguard config [show|set|profile]')
}

async function cmdProvider(args) {
  const [sub, provider, ...rest] = args
  if (!sub || sub === 'list') {
    const res = await backendCall('GET', '/secrets-proxy/ai-config')
    const keys = res.body?.keys_configured || {}
    console.log(JSON.stringify({ provider: res.body?.provider || 'none', fallback_provider: res.body?.fallback_provider || null, keys }, null, 2))
    return
  }
  if (sub === 'add') {
    const body = { provider, ...Object.fromEntries(rest.map(pair => pair.split('=').map(s => s.trim())).filter(p => p.length === 2)) }
    const res = await backendCall('POST', '/secrets-proxy/ai-config', body)
    if (!res.ok) throw new Error(res.body?.error || `Provider save failed (${res.status})`)
    console.log(c.green(`✓ Saved provider ${provider}`))
    return
  }
  if (sub === 'remove') {
    const keyName = provider
    const res = await backendCall('DELETE', `/secrets-proxy/ai-config/key/${encodeURIComponent(keyName)}`)
    if (!res.ok) throw new Error(res.body?.error || `Remove failed (${res.status})`)
    console.log(c.green(`✓ Removed key ${keyName}`))
    return
  }
  if (sub === 'test') {
    const res = await backendCall('POST', '/secrets-proxy/test-ai', provider ? { provider } : {})
    if (!res.ok || res.body?.success === false) throw new Error(res.body?.message || `Provider test failed (${res.status})`)
    console.log(c.green(`✓ ${res.body?.message || 'Provider connected'}`))
    return
  }
  throw new Error('Usage: omniguard provider [list|add|remove|test]')
}

async function cmdKeys(args) {
  const [sub, ...rest] = args
  if (!sub || sub === 'list') {
    const res = await backendCall('GET', '/api-v1-api-keys')
    if (!res.ok) throw new Error(res.body?.error || `Key list failed (${res.status})`)
    const keys = Array.isArray(res.body?.data) ? res.body.data : []
    if (!keys.length) return console.log(c.dim('No API keys found'))
    for (const key of keys) {
      console.log(`${key.is_active ? c.green('[active]') : c.yellow('[revoked]')} ${key.name}  ${c.dim(key.key_prefix + '…')}  ${c.dim(key.id)}`)
      if (key.fingerprint) console.log(`  ${c.dim('Fingerprint:')} ${key.fingerprint}`)
    }
    return
  }
  if (sub === 'create') {
    const name = rest[0]
    if (!name) throw new Error('Usage: omniguard keys create <name> [scope scope...]')
    const scopes = rest.slice(1).length ? rest.slice(1) : ['scans:read', 'scans:write', 'findings:read']
    const res = await backendCall('POST', '/api-v1-api-keys', { name, scopes })
    if (!res.ok || !res.body?.success) throw new Error(res.body?.error || `Key create failed (${res.status})`)
    console.log(c.green('✓ API key created'))
    console.log(`  ${c.dim('Name:')} ${name}`)
    console.log(`  ${c.dim('Prefix:')} ${res.body.data?.key_prefix || ''}`)
    console.log(`  ${c.dim('One-time key:')} ${res.body.raw_key}`)
    return
  }
  if (sub === 'revoke') {
    const id = rest[0]
    if (!id) throw new Error('Usage: omniguard keys revoke <id>')
    const res = await backendCall('DELETE', '/api-v1-api-keys', { id })
    if (!res.ok || !res.body?.success) throw new Error(res.body?.error || `Key revoke failed (${res.status})`)
    console.log(c.green('✓ API key revoked'))
    return
  }
  throw new Error('Usage: omniguard keys [list|create|revoke]')
}

async function cmdScanRemote(args) {
  const c0 = cfg()
  if (!c0.backendUrl || !c0.apiKey) throw new Error('Run `omniguard login` first')
  const target = args.find(a => !a.startsWith('-'))
  if (!target) throw new Error('Usage: omniguard scan remote <file-or-directory>')
  const abs = path.resolve(target)
  const files = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? walkDir(abs) : [abs]
  const findings = []
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8')
    const res = await request(functionUrl(c0.backendUrl, 'scan-quick'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${c0.apiKey}` },
    }, { path: f, content })
    if (res.ok && Array.isArray(res.body?.findings)) findings.push(...res.body.findings)
  }
  console.log(JSON.stringify({ files_scanned: files.length, total: findings.length, findings }, null, 2))
}

async function cmdPolicies(args) {
  const [sub] = args
  if (!sub || sub === 'list') {
    console.log('Policies are managed in the backend and surfaced through the dashboard. Use `omniguard policy import <file>` to upload a policy bundle.')
    return
  }
  if (sub === 'import') {
    const file = args[1]
    if (!file || !fs.existsSync(file)) throw new Error('Usage: omniguard policy import <file>')
    const res = await backendCall('POST', '/policy-ingest', { content: fs.readFileSync(file, 'utf8') })
    if (!res.ok) throw new Error(res.body?.error || `Policy import failed (${res.status})`)
    console.log(c.green('✓ Policy imported'))
    return
  }
  throw new Error('Usage: omniguard policies|policy import')
}

async function cmdDashboard() {
  const c0 = cfg()
  const url = c0.dashboardUrl || c0.backendUrl.replace(/\/functions\/v1\/?$/, '')
  if (!url) throw new Error('Dashboard URL not configured')
  console.log(url)
}

async function cmdInstallHooks() {
  const hooks = path.join(process.cwd(), '.git', 'hooks')
  if (!fs.existsSync(hooks)) throw new Error('Not a git repository')
  const preCommit = `#!/usr/bin/env sh\nomniguard scan --staged\n`
  const prePush = `#!/usr/bin/env sh\nomniguard scan --staged --json >/dev/null\n`
  fs.writeFileSync(path.join(hooks, 'pre-commit'), preCommit, { mode: 0o755 })
  fs.writeFileSync(path.join(hooks, 'pre-push'), prePush, { mode: 0o755 })
  console.log(c.green('✓ Git hooks installed'))
}

async function cmdUninstallHooks() {
  const hooks = path.join(process.cwd(), '.git', 'hooks')
  for (const name of ['pre-commit', 'pre-push']) {
    const file = path.join(hooks, name)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  }
  console.log(c.green('✓ Git hooks removed'))
}

async function cmdDaemon(args) {
  const [sub] = args
  ensureDir()
  if (sub === 'status') {
    if (!fs.existsSync(PID_FILE)) return console.log(c.dim('Daemon: not running'))
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
    try { process.kill(pid, 0); console.log(c.green(`Daemon: running (PID ${pid})`)) } catch { console.log(c.dim('Daemon: stale')); fs.unlinkSync(PID_FILE) }
    return
  }
  if (sub === 'restart') { await cmdDaemon(['stop']); await cmdDaemon(['start']); return }
  if (sub === 'stop') {
    if (!fs.existsSync(PID_FILE)) return console.log(c.dim('Daemon: not running'))
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
    try { process.kill(pid, 'SIGTERM') } catch {}
    fs.unlinkSync(PID_FILE)
    console.log(c.green('✓ Daemon stopped'))
    return
  }
  if (sub === 'logs') {
    if (fs.existsSync(LOG_FILE)) console.log(fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-100).join('\n'))
    return
  }
  if (sub === 'start' || !sub) {
    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
      try { process.kill(pid, 0); return console.log(c.yellow(`Daemon already running (PID ${pid})`)) } catch {}
    }
    const child = spawn(process.execPath, [__filename, 'watch', '.'], { detached: true, stdio: ['ignore', fs.openSync(LOG_FILE, 'a'), fs.openSync(LOG_FILE, 'a')] })
    child.unref()
    fs.writeFileSync(PID_FILE, String(child.pid))
    console.log(c.green(`✓ Daemon started (PID ${child.pid})`))
    return
  }
  throw new Error('Usage: omniguard daemon [start|stop|status|restart|logs]')
}

async function cmdVersion() {
  console.log(`omniguard/${VERSION} node/${process.version} ${process.platform}`)
}

async function cmdCompletion() {
  console.log('Available shells: bash, zsh, fish, powershell')
}

async function cmdInit() {
  saveProfile({ profile: cfg().profile, backendUrl: cfg().backendUrl || '', orgId: cfg().orgId || '', failOn: 'critical' })
  console.log(c.green('✓ OmniGuard initialized'))
}

async function cmdUpdate() {
  console.log('Use your package manager or GitHub Releases to update OmniGuard.')
}

const handlers = {
  login: cmdLogin,
  logout: cmdLogout,
  whoami: cmdWhoami,
  organizations: cmdOrganizations,
  'switch-org': cmdSwitchOrg,
  scan: cmdScan,
  watch: cmdWatch,
  fix: async () => { throw new Error('`fix` requires a scan finding identifier and backend remediation workflow not yet wired in this branch.') },
  explain: async () => { throw new Error('`explain` requires a finding identifier or file context.') },
  policies: cmdPolicies,
  policy: cmdPolicies,
  provider: cmdProvider,
  keys: cmdKeys,
  config: cmdConfig,
  status: cmdStatus,
  logs: async () => { if (fs.existsSync(LOG_FILE)) console.log(fs.readFileSync(LOG_FILE, 'utf8')) },
  dashboard: cmdDashboard,
  version: cmdVersion,
  update: cmdUpdate,
  doctor: cmdDoctor,
  completion: cmdCompletion,
  init: cmdInit,
  'install-hooks': cmdInstallHooks,
  'uninstall-hooks': cmdUninstallHooks,
  daemon: cmdDaemon,
  auth: async args => {
    const [sub] = args
    if (sub === 'status' || !sub) return cmdStatus()
    throw new Error('Usage: omniguard auth status')
  },
  report: async () => {
    const files = getGitFiles()
    const findings = await scanFiles(files)
    const report = { generated_at: new Date().toISOString(), directory: process.cwd(), files_scanned: files.length, total_findings: findings.length, findings }
    fs.writeFileSync('omniguard-report.json', JSON.stringify(report, null, 2))
    console.log(c.green('✓ Report written to omniguard-report.json'))
  },
  remediate: async args => {
    const id = args[0]
    if (!id) throw new Error('Usage: omniguard remediate <finding-id>')
    const res = await backendCall('GET', `/api-v1-findings/${encodeURIComponent(id)}/ai-remediation`)
    if (!res.ok) throw new Error(res.body?.error?.message || `Remediation failed (${res.status})`)
    console.log(res.body?.data?.ai_remediation || res.body?.data?.remediation || 'No remediation available')
  },
  diff: async args => {
    const from = args[0] || 'HEAD~1'
    const to = args[1] || 'HEAD'
    const raw = execSync(`git diff --name-only ${from} ${to}`, { encoding: 'utf8' })
    const files = raw.split('\n').filter(Boolean).map(f => path.resolve(f)).filter(f => fs.existsSync(f))
    const findings = await scanFiles(files)
    if (!findings.length) return console.log(c.green('✓ No new security issues in diff'))
    for (const f of findings) printFinding(f)
    process.exitCode = 1
  },
  monitor: cmdWatch,
  serve: async () => { throw new Error('The local HTTP server has been superseded by the backend API.') },
  docs: async () => {
    console.log(c.bold('\nOmniGuard Documentation\n'))
    console.log('  README: ./README.md')
    console.log('  Local setup: ./docs/LOCAL-DEVELOPMENT-GUIDE.md')
    console.log('  Cloud deploy: ./docs/CLOUD-DEPLOYMENT-GUIDE.md')
    console.log('  Enterprise: ./docs/ENTERPRISE-GUIDE.md')
  },
  help: async () => {
    console.log(c.bold('\nOmniGuard CLI\n'))
    console.log('Usage: omniguard <command> [options]\n')
    console.log('Commands: login logout whoami organizations switch-org scan watch fix explain policies policy provider keys config status logs dashboard version update doctor completion init install-hooks uninstall-hooks daemon auth report remediate diff monitor docs')
  },
}

async function main() {
  const [, , cmd = 'help', ...args] = process.argv
  const handler = handlers[cmd] || handlers.help
  try {
    const rc = await handler(args)
    if (typeof rc === 'number') process.exit(rc)
  } catch (err) {
    console.error(c.red(err.message || String(err)))
    process.exit(1)
  }
}

main()
