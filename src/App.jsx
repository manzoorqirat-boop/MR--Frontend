import React, { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './page/LoginPage'
import SitesAndPeriodsPage from './page/SitesAndPeriodsPage'
import ScorecardEntryPage from './page/ScorecardEntryPage'
import ScorecardAnalyticsPage from './page/ScorecardAnalyticsPage'
import CorporateReviewPage from './page/CorporateReviewPage'
import QaItCompliancePage from './page/QaItCompliancePage'
import MasterDataPage from './page/MasterDataPage'
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
  scorecard: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M9 9v11" /><path d="M15 9v11" /></Icon>,
  scAnalytics: <Icon><path d="M3 17l5-5 4 4 8-8" /><path d="M15 8h5v5" /></Icon>,
  review: <Icon><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 13l2 2 4-4" /></Icon>,
  admin: <Icon><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" /><circle cx="17.5" cy="7" r="2.2" /><path d="M15.5 12.6c2.6.3 4.4 2 5 4.9" /></Icon>,
  qaIt: <Icon><path d="M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></Icon>,
  masterData: <Icon><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6" /><path d="M4.5 11.5v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6" /></Icon>
}

/* ---------------- Navigation: Monthly Site Scorecard (MR) ---------------- */
// Links flagged corporateOnly are hidden from site users and guarded at the route level.
const NAV_GROUPS = [
  {
    key: 'mr',
    label: 'MR Data',
    links: [
      { to: '/scorecard', label: 'Scorecard', icon: 'scorecard' },
      { to: '/scorecard-analytics', label: 'Scorecard Analytics', icon: 'scAnalytics' }
    ]
  },
  {
    key: 'qait',
    label: 'QA-IT Compliance',
    links: [
      { to: '/qa-it-compliance', label: 'Compliance Activities', icon: 'qaIt' }
    ]
  },
  {
    key: 'workflow',
    label: 'Workflow',
    links: [
      { to: '/review', label: 'Corporate Review', icon: 'review', corporateOnly: true },
      { to: '/master-data', label: 'Master Data', icon: 'masterData', corporateOnly: true },
      { to: '/admin', label: 'Admin', icon: 'admin', corporateOnly: true }
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
        <span className="sidebar-logo" aria-hidden="true">MR</span>
        {!collapsed && (
          <span className="sidebar-brand-text">
            <strong>Site Scorecard</strong>
            <small>Monthly Reporting</small>
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

// Guard for corporate-only routes: site users get bounced to the scorecard.
function CorporateRoute({ children }) {
  const { isCorporate } = useAuth()
  return isCorporate ? children : <Navigate to="/scorecard" replace />
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
            <Route path="/" element={<Navigate to="/scorecard" replace />} />
            <Route path="/scorecard" element={<ScorecardEntryPage />} />
            <Route path="/scorecard-analytics" element={<ScorecardAnalyticsPage />} />
            <Route path="/qa-it-compliance" element={<QaItCompliancePage />} />
            <Route
              path="/review"
              element={<CorporateRoute><CorporateReviewPage /></CorporateRoute>}
            />
            <Route
              path="/master-data"
              element={<CorporateRoute><MasterDataPage /></CorporateRoute>}
            />
            <Route
              path="/admin"
              element={<CorporateRoute><SitesAndPeriodsPage /></CorporateRoute>}
            />
            <Route path="*" element={<Navigate to="/scorecard" replace />} />
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
