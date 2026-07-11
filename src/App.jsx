import React, { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './page/LoginPage'
import DashboardPage from './page/DashboardPage'
import AnalyticsPage from './page/AnalyticsPage'
import TrainingPage from './page/TrainingPage'
import InitiativesPage from './page/InitiativesPage'
import CostSavingsPage from './page/CostSavingsPage'
import SitesAndPeriodsPage from './page/SitesAndPeriodsPage'
import ExcelImportPage from './page/ExcellImportPage'
import ScorecardEntryPage from './page/ScorecardEntryPage'
import ScorecardAnalyticsPage from './page/ScorecardAnalyticsPage'
import ScorecardImportPage from './page/ScorecardImportPage'
import CorporateReviewPage from './page/CorporateReviewPage'
import { Spinner } from './components/Feedback'

/* ---------------- Icons (inline SVG, no dependencies) ---------------- */
function Icon({ children }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}
const icons = {
  dashboard: <Icon><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Icon>,
  analytics: <Icon><path d="M3 20h18" /><path d="M6 20v-7" /><path d="M11 20V6" /><path d="M16 20v-10" /><path d="M21 20V9" /></Icon>,
  training: <Icon><path d="M22 9L12 4 2 9l10 5 10-5z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /><path d="M22 9v6" /></Icon>,
  initiatives: <Icon><path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1.3 1.5 1.5 2.5h5c.2-1 .7-1.8 1.5-2.5A6 6 0 0 0 12 3z" /></Icon>,
  costSavings: <Icon><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2a3 3 0 0 0-2.8-1.7c-1.7 0-3 1-3 2.25S10.3 11.6 12 12s3 1 3 2.25-1.3 2.25-3 2.25a3 3 0 0 1-2.8-1.7" /><path d="M12 5.5v2M12 16.5v2" /></Icon>,
  excelImport: <Icon><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>,
  review: <Icon><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 13l2 2 4-4" /></Icon>,
  admin: <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" /><circle cx="17.5" cy="7" r="2.2" /><path d="M15.5 12.6c2.6.3 4.4 2 5 4.9" /></Icon>,
  scorecard: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M9 9v11" /><path d="M15 9v11" /></Icon>,
  scAnalytics: <Icon><path d="M3 17l5-5 4 4 8-8" /><path d="M15 8h5v5" /></Icon>,
  scImport: <Icon><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 11v6" /><path d="M9.5 14.5L12 17l2.5-2.5" /></Icon>
}

/* ---------------- Navigation model: two groups ---------------- */
// Links flagged corporateOnly are hidden from site users and guarded at the route level.
const NAV_GROUPS = [
  {
    key: 'qbx',
    label: 'QBX Data',
    links: [
      { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { to: '/analytics', label: 'Analytics', icon: 'analytics' },
      { to: '/training', label: 'Training', icon: 'training' },
      { to: '/initiatives', label: 'Initiatives', icon: 'initiatives' },
      { to: '/cost-savings', label: 'Cost Savings', icon: 'costSavings' },
      { to: '/excel-import', label: 'Excel Import', icon: 'excelImport' },
      { to: '/review', label: 'Corporate Review', icon: 'review', corporateOnly: true },
      { to: '/admin', label: 'Admin', icon: 'admin', corporateOnly: true }
    ]
  },
  {
    key: 'mr',
    label: 'MR Data',
    links: [
      { to: '/scorecard', label: 'Scorecard', icon: 'scorecard' },
      { to: '/scorecard-analytics', label: 'Scorecard Analytics', icon: 'scAnalytics' },
      { to: '/scorecard-import', label: 'Scorecard Import', icon: 'scImport' }
    ]
  }
]

/* ---------------- Sidebar ---------------- */
function Sidebar({ collapsed, onToggle }) {
  const { user, isCorporate, logout } = useAuth()

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true">Q</span>
        {!collapsed && (
          <span className="sidebar-brand-text">
            <strong>QMS Portal</strong>
            <small>Site Reporting</small>
          </span>
        )}
      </div>

      {/* Groups */}
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => {
          const links = group.links.filter((l) => !l.corporateOnly || isCorporate)
          if (links.length === 0) return null
          return (
            <div className="sidebar-group" key={group.key}>
              <div className="sidebar-group-label">
                {collapsed ? group.label.split(' ')[0] : group.label}
              </div>
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  title={collapsed ? link.label : undefined}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  {icons[link.icon]}
                  {!collapsed && <span className="sidebar-link-label">{link.label}</span>}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Signed-in user + actions */}
      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user.displayName}</span>
            <span className={`role-chip ${isCorporate ? 'role-corporate' : 'role-site'}`}>
              {isCorporate ? 'Corporate' : (user.siteName ? `${user.siteName} (${user.siteCode})` : 'Site user')}
            </span>
          </div>
        )}
        <div className="sidebar-actions">
          <button
            className="sidebar-icon-btn"
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon>{collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}</Icon>
          </button>
          <button className="sidebar-icon-btn" onClick={logout} title="Sign out">
            <Icon><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Icon>
          </button>
        </div>
      </div>
    </aside>
  )
}

// Guard for corporate-only routes: site users get bounced to their dashboard.
function CorporateRoute({ children }) {
  const { isCorporate } = useAuth()
  return isCorporate ? children : <Navigate to="/dashboard" replace />
}

function AuthenticatedApp() {
  // Auto-collapse on narrow screens; the user can still toggle manually.
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900)
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 900) setCollapsed(true) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <AppProvider>
      <div className="app-layout">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/initiatives" element={<InitiativesPage />} />
            <Route path="/cost-savings" element={<CostSavingsPage />} />
            <Route path="/scorecard" element={<ScorecardEntryPage />} />
            <Route path="/scorecard-analytics" element={<ScorecardAnalyticsPage />} />
            <Route path="/scorecard-import" element={<ScorecardImportPage />} />
            <Route path="/excel-import" element={<ExcelImportPage />} />
            <Route
              path="/review"
              element={<CorporateRoute><CorporateReviewPage /></CorporateRoute>}
            />
            <Route
              path="/admin"
              element={<CorporateRoute><SitesAndPeriodsPage /></CorporateRoute>}
            />
            {/* Old bookmark support */}
            <Route path="/sites-periods" element={<Navigate to="/admin" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </AppProvider>
  )
}

function Gate() {
  const { user, initializing } = useAuth()
  if (initializing) {
    return (
      <div className="login-screen">
        <Spinner label="Restoring your session…" />
      </div>
    )
  }
  return user ? <AuthenticatedApp /> : <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
