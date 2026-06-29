import React from 'react'
import { statusBadgeClass } from '../constants'

export default function StatusBadge({ status, label }) {
  return <span className={statusBadgeClass(status)}>{label ?? status}</span>
}
