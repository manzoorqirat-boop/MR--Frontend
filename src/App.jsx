import React from 'react'
import { BrowserRouter, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import DashboardPage from './page/DashboardPage'
import AnalyticsPage from './page/AnalyticsPage'
import TrainingPage from './page/TrainingPage'
import InitiativesPage from './page/InitiativesPage'
import CostSavingsPage from './page/CostSavingsPage'
import SitesAndPeriodsPage from './page/SitesAndPeriodsPage'
import ExcelImportPage from './page/ExcellImportPage'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/training', label: 'Training' },
  { to: '/initiatives', label: 'Initiatives' },
  { to: '/cost-savings', label: 'Cost Savings' },
  { to: '/sites-periods', label: 'Sites & Periods' },
  { to: '/excel-import', label: 'Excel Import' }
]

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app-shell">
          <nav className="nav">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/initiatives" element={<InitiativesPage />} />
            <Route path="/cost-savings" element={<CostSavingsPage />} />
            <Route path="/sites-periods" element={<SitesAndPeriodsPage />} />
            <Route path="/excel-import" element={<ExcelImportPage />} />
          </Routes>
        </div>
      </AppProvider>
    </BrowserRouter>
  )
}