import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { MarketingSite } from './pages/MarketingSite'
import { Dashboard } from './pages/Dashboard'
import { Repositories } from './pages/Repositories'
import { Findings } from './pages/Findings'
import { Scans } from './pages/Scans'
import { Policies } from './pages/Policies'
import { Compliance } from './pages/Compliance'
import { Teams } from './pages/Teams'
import { AuditLogs } from './pages/AuditLogs'
import { Notifications } from './pages/Notifications'
import { Settings } from './pages/Settings'
import { Organizations } from './pages/Organizations'
import { Reports } from './pages/Reports'
import { AttackSurface } from './pages/AttackSurface'
import { Projects } from './pages/Projects'
import { CloudAssets } from './pages/CloudAssets'
import { SBOMInventory } from './pages/SBOMInventory'
import { AICenter } from './pages/AICenter'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { PolicyMarketplace } from './pages/PolicyMarketplace'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { WebhooksPage } from './pages/WebhooksPage'
import { AgentsPage } from './pages/AgentsPage'
import { SBOMGeneration } from './pages/SBOMGeneration'

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <MarketingSite page="home" />} />
      <Route path="/product" element={<MarketingSite page="product" />} />
      <Route path="/platform" element={<MarketingSite page="platform" />} />
      <Route path="/solutions" element={<MarketingSite page="solutions" />} />
      <Route path="/enterprise" element={<MarketingSite page="enterprise" />} />
      <Route path="/pricing" element={<MarketingSite page="pricing" />} />
      <Route path="/docs" element={<MarketingSite page="documentation" />} />
      <Route path="/security" element={<MarketingSite page="security" />} />
      <Route path="/customers" element={<MarketingSite page="customers" />} />
      <Route path="/about" element={<MarketingSite page="about" />} />
      <Route path="/careers" element={<MarketingSite page="careers" />} />
      <Route path="/blog" element={<MarketingSite page="blog" />} />
      <Route path="/contact" element={<MarketingSite page="contact" />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Auth />} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <Auth initialMode="signup" />} />

      <Route path="/*" element={
        <Guard>
          <Layout>
            <Routes>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/security-posture" element={<Dashboard />} />
              <Route path="/attack-surface" element={<AttackSurface />} />
              <Route path="/threat-insights" element={<Findings />} />
              <Route path="/organizations" element={<Organizations />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/repositories" element={<Repositories />} />
              <Route path="/cloud-assets" element={<CloudAssets />} />
              <Route path="/sbom" element={<SBOMInventory />} />
              <Route path="/findings" element={<Findings />} />
              <Route path="/scans" element={<Scans />} />
              <Route path="/policies" element={<Policies />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/risk-analysis" element={<Reports />} />
              <Route path="/ai-center" element={<AICenter />} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/policy-marketplace" element={<PolicyMarketplace />} />
              <Route path="/developers" element={<Teams />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/scorecards" element={<AuditLogs />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/webhooks" element={<WebhooksPage />} />
              <Route path="/api-keys" element={<Settings />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/billing" element={<Settings />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/sbom-generation" element={<SBOMGeneration />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Layout>
        </Guard>
      } />
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>
}
