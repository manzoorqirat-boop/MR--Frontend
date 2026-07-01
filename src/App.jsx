import React from 'react'
import { BrowserRouter, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
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

// Two top-level modules, each with its own set of sub-tabs.
// QBX Data = the original report suite; MR Data = the Monthly Site Scorecard.
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
      { to: '/sites-periods', label: 'Sites & Periods' },
      { to: '/excel-import', label: 'Excel Import' }
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

function Navigation() {
  const location = useLocation()
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
              to={mod.links[0].to}
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
        {activeModule.links.map((link) => (
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

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
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
            <Route path="/sites-periods" element={<SitesAndPeriodsPage />} />
            <Route path="/excel-import" element={<ExcelImportPage />} />
          </Routes>
        </div>
      </AppProvider>
    </BrowserRouter>
  )
}
