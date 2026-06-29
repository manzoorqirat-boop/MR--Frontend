import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  createSite,
  createReportPeriod,
  lockReportPeriod,
  getSiteSubmissions,
  markSiteSubmitted
} from '../client'
import { formatPeriodLabel, MONTH_NAMES } from '../../constants'
import StatusBadge from '../StatusBadge'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

const now = new Date()

export default function SitesAndPeriodsPage() {
  const {
    sites,
    reportPeriods,
    loading,
    selectedPeriodId,
    setSelectedPeriodId,
    selectedPeriod,
    refreshSites,
    refreshReportPeriods
  } = useAppContext()

  const [error, setError] = useState(null)

  // ---- New site form ----
  const [siteName, setSiteName] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [savingSite, setSavingSite] = useState(false)

  async function handleCreateSite() {
    if (!siteName.trim() || !siteCode.trim()) {
      setError('Site name and code are both required.')
      return
    }
    setSavingSite(true)
    setError(null)
    try {
      await createSite({ name: siteName.trim(), code: siteCode.trim(), isActive: true })
      setSiteName('')
      setSiteCode('')
      await refreshSites()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSavingSite(false)
    }
  }

  // ---- New period form ----
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [savingPeriod, setSavingPeriod] = useState(false)

  async function handleCreatePeriod() {
    setSavingPeriod(true)
    setError(null)
    try {
      await createReportPeriod({ month: Number(month), year: Number(year) })
      await refreshReportPeriods()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSavingPeriod(false)
    }
  }

  async function handleLock(id) {
    const period = reportPeriods.find((p) => p.id === id)
    const label = period ? formatPeriodLabel(period) : 'this period'
    if (!window.confirm(`Lock ${label}? Once locked, no further data can be entered or deleted for it.`)) return
    setError(null)
    try {
      await lockReportPeriod(id)
      await refreshReportPeriods()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <ErrorBanner message={error} />

      {loading && <Spinner label="Loading sites and periods…" />}

      <div className="grid-2">
        {/* ---------------- Sites ---------------- */}
        <div className="card">
          <h2>Sites</h2>
          {sites.length === 0 ? (
            <EmptyState>No sites yet. Add the first one below.</EmptyState>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th style={{ width: 110 }}>Code</th></tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}><td>{s.name}</td><td>{s.code}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginBottom: 8 }}>Add a site</h3>
          <div className="row">
            <label className="picker-label">
              Name
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Plant North" />
            </label>
            <label className="picker-label">
              Code
              <input type="text" value={siteCode} onChange={(e) => setSiteCode(e.target.value)} placeholder="e.g. SITE-A" />
            </label>
            <button disabled={savingSite} onClick={handleCreateSite} style={{ alignSelf: 'flex-end' }}>
              {savingSite ? 'Adding…' : 'Add site'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>Codes must be unique.</p>
        </div>

        {/* ---------------- Report periods ---------------- */}
        <div className="card">
          <h2>Report periods</h2>
          {reportPeriods.length === 0 ? (
            <EmptyState>No report periods yet. Create one below.</EmptyState>
          ) : (
            <table>
              <thead>
                <tr><th>Period</th><th style={{ width: 110 }}>Status</th><th style={{ width: 80 }}></th></tr>
              </thead>
              <tbody>
                {reportPeriods.map((p) => (
                  <tr key={p.id}>
                    <td>{formatPeriodLabel(p)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      {p.status !== 'Locked' ? (
                        <button className="secondary" onClick={() => handleLock(p.id)}>Lock</button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginBottom: 8 }}>Create a period</h3>
          <div className="row">
            <label className="picker-label">
              Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </label>
            <label className="picker-label">
              Year
              <input type="number" value={year} min="2000" max="2100" onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} />
            </label>
            <button disabled={savingPeriod} onClick={handleCreatePeriod} style={{ alignSelf: 'flex-end' }}>
              {savingPeriod ? 'Saving…' : 'Create period'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Creating an existing month/year just returns the existing period.
          </p>
        </div>
      </div>

      <SubmissionPanel
        sites={sites}
        reportPeriods={reportPeriods}
        selectedPeriodId={selectedPeriodId}
        setSelectedPeriodId={setSelectedPeriodId}
        selectedPeriod={selectedPeriod}
        onError={setError}
      />
    </>
  )
}

// ---- Submission tracking for a chosen period ----
function SubmissionPanel({ sites, reportPeriods, selectedPeriodId, setSelectedPeriodId, selectedPeriod, onError }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittedBy, setSubmittedBy] = useState('')
  const [markSiteId, setMarkSiteId] = useState('')
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    if (!selectedPeriodId) return
    setLoading(true)
    try {
      const data = await getSiteSubmissions(selectedPeriodId)
      setSubmissions(data)
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId, onError])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (sites.length > 0 && !sites.some((s) => s.id === Number(markSiteId))) {
      setMarkSiteId(String(sites[0].id))
    }
  }, [sites, markSiteId])

  // Build a row per active site: submitted or not.
  const rows = useMemo(() => {
    const byId = new Map(submissions.map((s) => [s.siteId, s]))
    return sites.map((site) => {
      const sub = byId.get(site.id)
      return {
        siteId: site.id,
        siteName: site.name,
        isSubmitted: Boolean(sub?.isSubmitted),
        submittedBy: sub?.submittedBy || null,
        submittedAtUtc: sub?.submittedAtUtc || null
      }
    })
  }, [sites, submissions])

  const isLocked = selectedPeriod?.status === 'Locked'

  async function handleMark() {
    if (!markSiteId) return
    setMarking(true)
    onError(null)
    try {
      await markSiteSubmitted({
        siteId: Number(markSiteId),
        reportPeriodId: selectedPeriodId,
        submittedBy: submittedBy.trim()
      })
      setSubmittedBy('')
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Submission status</h2>
        <label className="picker-label">
          Period
          <select value={selectedPeriodId ?? ''} onChange={(e) => setSelectedPeriodId(Number(e.target.value))}>
            {reportPeriods.length === 0 && <option value="">— no periods —</option>}
            {reportPeriods.map((p) => (
              <option key={p.id} value={p.id}>{formatPeriodLabel(p)}</option>
            ))}
          </select>
        </label>
      </div>

      {!selectedPeriodId ? (
        <EmptyState>Create a report period first.</EmptyState>
      ) : loading ? (
        <Spinner label="Loading submission status…" />
      ) : sites.length === 0 ? (
        <EmptyState>Add a site to track submissions.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>Site</th><th style={{ width: 120 }}>Submitted</th><th>By</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.siteId}>
                <td>{r.siteName}</td>
                <td>
                  {r.isSubmitted
                    ? <span className="status-badge status-Completed">Submitted</span>
                    : <span className="status-badge status-NotStarted">Pending</span>}
                </td>
                <td>{r.submittedBy || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedPeriodId && sites.length > 0 && (
        <>
          <h3 style={{ marginBottom: 8 }}>Mark a site as submitted</h3>
          <div className="row">
            <label className="picker-label">
              Site
              <select value={markSiteId} onChange={(e) => setMarkSiteId(e.target.value)}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </label>
            <label className="picker-label">
              Submitted by
              <input type="text" value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} placeholder="Your name" />
            </label>
            <button disabled={marking} onClick={handleMark} style={{ alignSelf: 'flex-end' }}>
              {marking ? 'Saving…' : 'Mark submitted'}
            </button>
          </div>
          {isLocked && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Note: this period is locked. Submission status can still be recorded, but no data rows can be edited.
            </p>
          )}
        </>
      )}
    </div>
  )
}