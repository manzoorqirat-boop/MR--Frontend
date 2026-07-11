import React from 'react'
import { BrowserRouter, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
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

// Two top-level modules, each with its own set of sub-tabs.
// QBX Data = the original report suite; MR Data = the Monthly Site Scorecard.
// Links flagged corporateOnly are hidden from site users and guarded at the route level.
const MODULES = [
  {
    key: 'qbx',
    label: 'QBX Data',
    hint: 'Reports, training, initiatives & cost savings',
    links: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/analytics', label: 'Analytics' },
      { to: '/training', label: 'Training' },
      { to: '/initiatives', label: 'Initiatives' },
      { to: '/cost-savings', label: 'Cost Savings' },
      { to: '/excel-import', label: 'Excel Import' },
      { to: '/review', label: 'Corporate Review', corporateOnly: true },
      { to: '/admin', label: 'Admin', corporateOnly: true }
    ]
  },
  {
    key: 'mr',
    label: 'MR Data',
    hint: 'Monthly Site Scorecard \u2014 entry, analytics & import',
    links: [
      { to: '/scorecard', label: 'Scorecard' },
      { to: '/scorecard-analytics', label: 'Scorecard Analytics' },
      { to: '/scorecard-import', label: 'Scorecard Import' }
    ]
  }
]

// Which module owns the current route (so refresh / deep-link keeps the right module open).
function moduleForPath(pathname) {
  const inMr = MODULES[1].links.some((l) => pathname.startsWith(l.to))
  return inMr ? 'mr' : 'qbx'
}

function visibleLinks(module, isCorporate) {
  return module.links.filter((l) => !l.corporateOnly || isCorporate)
}

function Navigation() {
  const location = useLocation()
  const { isCorporate } = useAuth()
  const activeModuleKey = moduleForPath(location.pathname)
  const activeModule = MODULES.find((m) => m.key === activeModuleKey) || MODULES[0]

  return (
    <div className="module-nav">
      {/* ---- Module tiles ---- */}
      <div className="module-tiles">
        {MODULES.map((mod) => {
          const isActive = mod.key === activeModuleKey
          // Selecting a module jumps to its first tab.
          return (
            <NavLink
              key={mod.key}
              to={visibleLinks(mod, isCorporate)[0].to}
              className={`module-tile${isActive ? ' active' : ''}`}
            >
              <span className="module-tile-label">{mod.label}</span>
              <span className="module-tile-hint">{mod.hint}</span>
            </NavLink>
          )
        })}
      </div>

      {/* ---- Sub-tabs for the active module ---- */}
      <div className="submodule-tabs">
        {visibleLinks(activeModule, isCorporate).map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `subtab${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// App header: brand + who is signed in (and for site users, which site they
// are locked to) + sign out.
function AppHeader() {
  const { user, isCorporate, logout } = useAuth()
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand">
          <span className="app-brand-logo" aria-hidden="true">QMS</span>
          <span className="app-brand-name">Site Reporting Portal</span>
        </div>
        <div className="app-user">
          <div className="app-user-info">
            <span className="app-user-name">{user.displayName}</span>
            <span className={`role-chip ${isCorporate ? 'role-corporate' : 'role-site'}`}>
              {isCorporate ? 'Corporate' : (user.siteName ? `${user.siteName} (${user.siteCode})` : 'Site user')}
            </span>
          </div>
          <button className="secondary header-logout" onClick={logout}>Sign out</button>
        </div>
      </div>
    </header>
  )
}

// Guard for corporate-only routes: site users get bounced to their dashboard.
function CorporateRoute({ children }) {
  const { isCorporate } = useAuth()
  return isCorporate ? children : <Navigate to="/dashboard" replace />
}

function AuthenticatedApp() {
  return (
    <AppProvider>
      <AppHeader />
      <div className="app-shell">
        <Navigation />

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
