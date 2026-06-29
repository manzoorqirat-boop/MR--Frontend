// DashboardPage imports from '../components/StatCard' (PascalCase).
// The original file was named statcard.jsx (lowercase), which fails on
// case-sensitive file systems (Linux/Docker). Canonical file is now StatCard.jsx.

import React from 'react'

export default function StatCard({ label, value, sublabel }) {
  return (
    <div className="card stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="muted">{sublabel}</div>}
    </div>
  )
}
