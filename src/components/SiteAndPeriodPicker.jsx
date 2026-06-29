// Used by ExcelImportPage (and can be reused by any data-entry page) to let
// the user pick which site and which report period they are entering data for.

import React from 'react'
import { useAppContext } from '../context/AppContext'
import { formatPeriodLabel } from '../../constants'
import { Spinner } from './Feedback'

export default function SiteAndPeriodPicker({ helpText }) {
  const {
    sites,
    reportPeriods,
    loading,
    selectedSiteId,
    setSelectedSiteId,
    selectedPeriodId,
    setSelectedPeriodId,
    selectedPeriod
  } = useAppContext()

  if (loading) return <Spinner label="Loading sites and periods…" />

  const periodStatus = selectedPeriod?.status ?? null

  return (
    <div className="card">
      <div className="row">
        <label className="picker-label">
          Site
          <select
            value={selectedSiteId ?? ''}
            onChange={(e) => setSelectedSiteId(Number(e.target.value))}
          >
            {sites.length === 0 && <option value="">— no sites —</option>}
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>

        <label className="picker-label">
          Report Period
          <select
            value={selectedPeriodId ?? ''}
            onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
          >
            {reportPeriods.length === 0 && <option value="">— no periods —</option>}
            {reportPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {formatPeriodLabel(p)}{p.status !== 'Open' ? ` (${p.status})` : ''}
              </option>
            ))}
          </select>
        </label>

        {periodStatus && periodStatus !== 'Open' && (
          <span className={`status-badge status-${periodStatus}`}>{periodStatus}</span>
        )}
      </div>

      {helpText && <p className="muted" style={{ margin: 0 }}>{helpText}</p>}
    </div>
  )
}
