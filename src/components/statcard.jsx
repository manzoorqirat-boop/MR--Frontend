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
