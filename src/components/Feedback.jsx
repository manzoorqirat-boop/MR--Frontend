// DashboardPage and ExcelImportPage both import Spinner/ErrorBanner/EmptyState
// from '../components/Feedback', but the file only existed at '../Feedback'.
// This file is the canonical location; the old src/Feedback.jsx can be removed.

import React from 'react'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-row">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label}</span>
    </div>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return <div className="error-banner">{message}</div>
}

export function EmptyState({ children }) {
  return <div className="empty-state muted">{children}</div>
}
