import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, supabaseAuth } from '../lib/supabase'
import { ArrowRight, Eye, EyeOff, Github, Globe, Mail, Shield, Sparkles } from 'lucide-react'

type Mode = 'signin' | 'signup' | 'magic'

export function Auth({ initialMode }: { initialMode?: Mode }) {
  const { signIn, signInWithMagicLink, signInWithOAuth, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>(initialMode ?? 'signin')
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPw, setShowPw] = useState(false)
  const navigate = useNavigate()

  const handle = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'magic') {
      const { error: err } = await signInWithMagicLink(form.email)
      setLoading(false)
      if (err) return setError(err)
      return setSuccess('Magic link sent. Check your inbox and return to OmniGuard.')
    }

    if (mode === 'signin') {
      const { error: err } = await signIn(form.email, form.password)
      setLoading(false)
      if (err) return setError(err)
      navigate('/app')
      return
    }

    if (!form.firstName.trim()) {
      setLoading(false)
      return setError('First name is required.')
    }

    const { error: err } = await signUp(form.email, form.password, form.firstName, form.lastName)
    if (err) {
      setLoading(false)
      return setError(err)
    }

    const slug = form.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString(36)
    const { data: org } = await supabase.from('organizations').insert({
      name: `${form.firstName}'s Organization`,
      slug,
      plan: 'enterprise',
      settings: {},
      ai_config: {},
    }).select().single()
    if (org) {
      const { data: { user } } = await supabaseAuth.getUser()
      if (user) await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'owner', status: 'active' })
    }

    const { error: si } = await signIn(form.email, form.password)
    setLoading(false)
    if (si) return setError(si)
    navigate('/app')
  }

  const oauth = async (provider: 'github' | 'google' | 'azure' | 'okta') => {
    setError('')
    setLoading(true)
    const { error: err } = await signInWithOAuth(provider)
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <div className="hidden lg:flex lg:w-1/2 p-10 items-end bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_45%),linear-gradient(135deg,_#0f172a,_#020617)]">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5" /> Enterprise AppSec platform
          </div>
          <h1 className="text-5xl font-semibold tracking-tight">AI-native security, backed by policy and context.</h1>
          <p className="text-slate-300 text-lg">
            Sign in to access live scans, policies, API keys, integrations, and enterprise governance controls.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
            {['Magic links', 'GitHub OAuth', 'Google OAuth', 'Single org auth flow'].map(item => (
              <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">{item}</div>
            ))}
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
            Back to website <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">OmniGuard</h2>
                <p className="text-xs text-slate-400">Secure enterprise access</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-800/70 mb-6">
              {(['signin', 'magic', 'signup'] as Mode[]).map(item => (
                <button key={item} onClick={() => { setMode(item); setError(''); setSuccess('') }} className={`rounded-xl py-2 text-sm ${mode === item ? 'bg-white text-slate-950' : 'text-slate-300'}`}>
                  {item === 'signin' ? 'Password' : item === 'magic' ? 'Magic Link' : 'Create'}
                </button>
              ))}
            </div>

            <form onSubmit={handle} className="space-y-4">
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">First name</label><input className="input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="Jane" required /></div>
                  <div><label className="label">Last name</label><input className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Smith" /></div>
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" required autoComplete="email" />
              </div>
              {mode !== 'magic' && (
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className="input pr-10" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" minLength={6} required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
              {success && <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div>}

              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-950">
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : mode === 'magic' ? 'Send magic link' : 'Create account'}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <button onClick={() => oauth('github')} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm">
                <Github className="w-4 h-4" /> Continue with GitHub
              </button>
              <button onClick={() => oauth('google')} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm">
                <Globe className="w-4 h-4" /> Continue with Google
              </button>
              <button onClick={() => oauth('okta')} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm">
                <Mail className="w-4 h-4" /> Continue with SSO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
