import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { Layout } from './components/Layout'
import { LoadingSpinner } from './components/ui'
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
import { CloudAssets } from './pages/CloudAssets'
import { AICenter } from './pages/AICenter'
import { KnowledgeBase } from './pages/KnowledgeBase'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { WebhooksPage } from './pages/WebhooksPage'
import { APIKeysPage } from './pages/APIKeysPage'
import { SecurityPosture } from './pages/SecurityPosture'

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size={32} /></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size={32} /></div>

  return (
    <Routes>
      {/* Public routes */}
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

      {/* Protected routes — each path maps to a UNIQUE page component */}
      <Route path="/app" element={<Guard><Layout><Dashboard /></Layout></Guard>} />
      <Route path="/app/security-posture" element={<Guard><Layout><SecurityPosture /></Layout></Guard>} />
      <Route path="/app/attack-surface" element={<Guard><Layout><AttackSurface /></Layout></Guard>} />
      <Route path="/app/organizations" element={<Guard><Layout><Organizations /></Layout></Guard>} />
      <Route path="/app/repositories" element={<Guard><Layout><Repositories /></Layout></Guard>} />
      <Route path="/app/cloud-assets" element={<Guard><Layout><CloudAssets /></Layout></Guard>} />
      <Route path="/app/findings" element={<Guard><Layout><Findings /></Layout></Guard>} />
      <Route path="/app/scans" element={<Guard><Layout><Scans /></Layout></Guard>} />
      <Route path="/app/policies" element={<Guard><Layout><Policies /></Layout></Guard>} />
      <Route path="/app/compliance" element={<Guard><Layout><Compliance /></Layout></Guard>} />
      <Route path="/app/ai-center" element={<Guard><Layout><AICenter /></Layout></Guard>} />
      <Route path="/app/knowledge-base" element={<Guard><Layout><KnowledgeBase /></Layout></Guard>} />
      <Route path="/app/teams" element={<Guard><Layout><Teams /></Layout></Guard>} />
      <Route path="/app/integrations" element={<Guard><Layout><IntegrationsPage /></Layout></Guard>} />
      <Route path="/app/webhooks" element={<Guard><Layout><WebhooksPage /></Layout></Guard>} />
      <Route path="/app/api-keys" element={<Guard><Layout><APIKeysPage /></Layout></Guard>} />
      <Route path="/app/audit-logs" element={<Guard><Layout><AuditLogs /></Layout></Guard>} />
      <Route path="/app/reports" element={<Guard><Layout><Reports /></Layout></Guard>} />
      <Route path="/app/notifications" element={<Guard><Layout><Notifications /></Layout></Guard>} />
      <Route path="/app/settings" element={<Guard><Layout><Settings /></Layout></Guard>} />

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
