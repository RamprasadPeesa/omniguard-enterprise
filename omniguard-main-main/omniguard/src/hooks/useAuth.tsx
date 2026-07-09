import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, supabaseAuth, Tables } from '../lib/supabase'

type Profile = Tables<'user_profiles'>
type Membership = Tables<'organization_members'>

interface AuthCtx {
  user: { id: string; email?: string | null } | null
  profile: Profile | null
  session: any | null
  memberships: Membership[]
  currentOrganizationId: string | null
  currentRole: string | null
  canManageOrg: boolean
  setCurrentOrganizationId: (id: string) => void
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signInWithOAuth: (provider: 'github' | 'google' | 'azure' | 'okta') => Promise<{ error: string | null }>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabaseAuth.getSession().then(({ data: { session } }: any) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabaseAuth.onAuthStateChange((_event: unknown, session: any) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setMemberships([]); setCurrentOrganizationId(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const [{ data: prof }, { data: mems }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('organization_members').select('*').eq('user_id', userId).eq('status', 'active'),
    ])
    setProfile(prof)
    setMemberships(mems || [])
    if (mems?.length) {
      setCurrentOrganizationId(mems[0].organization_id)
      setCurrentRole(mems[0].role)
    }
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabaseAuth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  async function signInWithMagicLink(email: string) {
    const { error } = await supabaseAuth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/app' },
    })
    return { error: error?.message || null }
  }

  async function signInWithOAuth(provider: 'github' | 'google' | 'azure' | 'okta') {
    const providerMap: Record<typeof provider, 'github' | 'google' | 'azure' | 'oidc'> = {
      github: 'github',
      google: 'google',
      azure: 'azure',
      okta: 'oidc',
    }
    const { error } = await supabaseAuth.signInWithOAuth({
      provider: providerMap[provider],
      options: { redirectTo: window.location.origin + '/app' },
    })
    return { error: error?.message || null }
  }

  async function signUp(email: string, password: string, firstName: string, lastName: string) {
    const { data, error } = await supabaseAuth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName } },
    })
    if (error) return { error: error.message }
    if (data.user && !error) {
      await supabase.from('user_profiles').upsert({ id: data.user.id, email, first_name: firstName, last_name: lastName })
    }
    return { error: null }
  }

  async function signOut() {
    await supabaseAuth.signOut()
    setUser(null); setProfile(null); setSession(null); setMemberships([]); setCurrentOrganizationId(null); setCurrentRole(null)
  }

  const canManageOrg = ['owner', 'admin'].includes(currentRole || '')

  return (
    <Ctx.Provider value={{ user, profile, session, memberships, currentOrganizationId, currentRole, canManageOrg, setCurrentOrganizationId, loading, signIn, signInWithMagicLink, signInWithOAuth, signUp, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
