import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  getSubmissionOverview,
  reviewSubmission,
  lockReportPeriod,
  listChangeRequests,
  decideChangeRequest
} from '../client'
import { formatPeriodLabel } from '../../constants'
import { SubmissionStatusPill } from '../components/SubmissionCard'
import StatCard from '../components/StatCard'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// Corporate-only. One period at a time: every site's submission state, how
// much data each actually entered, approve / return actions, and a lock
// button once everything is approved. The collated numbers themselves live
// on the Dashboard & Analytics pages — this page manages the workflow.
export default function CorporateReviewPage() {
  const { reportPeriods, selectedPeriodId, setSelectedPeriodId, selectedPeriod, refreshReportPeriods } =
    useAppContext()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionBusyId, setActionBusyId] = useState(null)
  const [returning, setReturning] = useState(null) // { submissionId, siteName }
  const [returnComments, setReturnComments] = useState('')

  const load = useCallback(async () => {
    if (!selectedPeriodId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await getSubmissionOverview(selectedPeriodId))
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodId])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const total = rows.length
    const submitted = rows.filter((r) => r.status === 'Submitted').length
    const approved = rows.filter((r) => r.status === 'Approved').length
    const returned = rows.filter((r) => r.status === 'Returned').length
    const pending = total - submitted - approved - returned
    return { total, submitted, approved, returned, pending }
  }, [rows])

  const allApproved = rows.length > 0 && stats.approved === rows.length
  const isLocked = selectedPeriod?.status === 'Locked'

  async function handleApprove(row) {
    if (!window.confirm(`Approve ${row.siteName}'s submission for ${formatPeriodLabel(selectedPeriod)}?`)) return
    setActionBusyId(row.submissionId)
    setError(null)
    try {
      await reviewSubmission(row.submissionId, 'Approve', null)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleReturn() {
    if (!returnComments.trim()) {
      setError('Please tell the site what needs to be corrected.')
      return
    }
    setActionBusyId(returning.submissionId)
    setError(null)
    try {
      await reviewSubmission(returning.submissionId, 'Return', returnComments.trim())
      setReturning(null)
      setReturnComments('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleLockPeriod() {
    const label = formatPeriodLabel(selectedPeriod)
    if (!window.confirm(
      `Lock ${label}?\n\nOnce locked, no site can submit or edit data for this month. ` +
      'Do this only after collating the final report.'
    )) return
    setError(null)
    try {
      await lockReportPeriod(selectedPeriodId)
      await refreshReportPeriods()
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 0 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>Corporate review</h2>
            <label className="picker-label">
              Period
              <select
                value={selectedPeriodId ?? ''}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              >
                {reportPeriods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPeriodLabel(p)}{p.status !== 'Open' ? ` (${p.status})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedPeriod && !isLocked && (
            <button
              className={allApproved ? '' : 'secondary'}
              onClick={handleLockPeriod}
              title={allApproved
                ? 'All sites approved — lock the month to finalize it'
                : 'You can lock early, but sites with pending data will be cut off'}
            >
              Lock {formatPeriodLabel(selectedPeriod)}
            </button>
          )}
          {isLocked && <span className="status-badge status-Locked">Period locked</span>}
        </div>
      </div>

      <ErrorBanner message={error} />

      {rows.length > 0 && (
        <div className="grid-stats grid-stats-4">
          <StatCard label="Sites reporting" value={stats.total} />
          <StatCard label="Awaiting review" value={stats.submitted} />
          <StatCard label="Approved" value={`${stats.approved} / ${stats.total}`} />
          <StatCard
            label="Not yet submitted"
            value={stats.pending + stats.returned}
            sublabel={stats.returned > 0 ? `${stats.returned} returned for revision` : undefined}
          />
        </div>
      )}

      {loading && <Spinner label="Loading submissions…" />}

      {!loading && reportPeriods.length === 0 && (
        <EmptyState>No report periods exist yet. Create one on the Admin page.</EmptyState>
      )}

      {!loading && rows.length === 0 && reportPeriods.length > 0 && (
        <EmptyState>No active sites yet. Add sites on the Admin page.</EmptyState>
      )}

      {!loading && rows.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 10 }}>Site submissions — {formatPeriodLabel(selectedPeriod)}</h3>
          <div className="scorecard-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Data entered</th>
                  <th>Submitted</th>
                  <th>Last review</th>
                  <th style={{ width: 190 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.siteId}>
                    <td>
                      <strong>{r.siteName}</strong>
                      <span className="muted"> ({r.siteCode})</span>
                    </td>
                    <td><SubmissionStatusPill status={r.status} /></td>
                    <td>
                      <span className="data-counts">
                        <DataCount label="training" value={r.trainingCount} />
                        <DataCount label="initiatives" value={r.initiativeCount} />
                        <DataCount label="cost savings" value={r.costSavingCount} />
                        <DataCount label="scorecard sheets" value={r.scorecardMetricCount} />
                      </span>
                    </td>
                    <td>
                      {r.submittedAtUtc ? (
                        <>
                          {r.submittedBy || '—'}
                          <div className="muted">{new Date(r.submittedAtUtc).toLocaleString()}</div>
                        </>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {r.reviewedBy ? (
                        <>
                          {r.reviewedBy}
                          {r.reviewComments && (
                            <div className="muted" title={r.reviewComments}>
                              “{r.reviewComments.length > 60
                                ? r.reviewComments.slice(0, 60) + '…'
                                : r.reviewComments}”
                            </div>
                          )}
                        </>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>
                      {r.status === 'Submitted' && !isLocked ? (
                        <div className="row" style={{ marginBottom: 0, gap: 6 }}>
                          <button
                            disabled={actionBusyId === r.submissionId}
                            onClick={() => handleApprove(r)}
                          >
                            Approve
                          </button>
                          <button
                            className="secondary"
                            disabled={actionBusyId === r.submissionId}
                            onClick={() => { setReturning({ submissionId: r.submissionId, siteName: r.siteName }); setReturnComments('') }}
                          >
                            Return
                          </button>
                        </div>
                      ) : (
                        <span className="muted">
                          {r.status === 'Approved' ? 'Done'
                            : r.status === 'Returned' ? 'With site'
                            : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            The collated numbers for approved sites appear on the Dashboard and Analytics pages.
            Lock the period once the month is finalized.
          </p>
        </div>
      )}

      <ChangeRequestQueue />

      {/* ---- Return-for-revision dialog ---- */}
      {returning && (
        <div className="modal-backdrop" onClick={() => setReturning(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Return {returning.siteName}'s submission</h3>
            <p className="muted">
              Tell the site what needs to be corrected. They'll see these comments and be
              able to edit and resubmit their month.
            </p>
            <textarea
              rows={4}
              value={returnComments}
              autoFocus
              onChange={(e) => setReturnComments(e.target.value)}
              placeholder="e.g. Cost savings sheet is missing finance validation for projects 3 and 4."
            />
            <div className="row" style={{ marginTop: 12, marginBottom: 0, justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={() => setReturning(null)}>Cancel</button>
              <button
                className="danger"
                disabled={actionBusyId === returning.submissionId}
                onClick={handleReturn}
              >
                {actionBusyId === returning.submissionId ? 'Returning…' : 'Return for revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DataCount({ label, value }) {
  return (
    <span className={`data-count${value > 0 ? '' : ' data-count-zero'}`}>
      {value} {label}
    </span>
  )
}

/* ============ Initiative change requests: corporate approval queue ============ */
const CR_FIELD_LABELS = {
  name: 'Name', department: 'Department', category: 'Category',
  facilitatorName: 'Facilitator', departmentHead: 'Dept. head',
  status: 'Status', remarks: 'Remarks'
}

function ChangeRequestQueue() {
  const [pending, setPending] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState(null)
  const [rejecting, setRejecting] = React.useState(null) // cr being rejected
  const [rejectComments, setRejectComments] = React.useState('')
  const [error, setError] = React.useState(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPending(await listChangeRequests('Pending'))
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { load() }, [load])

  async function approve(cr) {
    const verb = cr.requestType === 'Delete' ? 'delete this initiative' : 'apply these changes'
    if (!window.confirm(`Approve the request from ${cr.siteName} and ${verb}?`)) return
    setBusyId(cr.id)
    setError(null)
    try {
      await decideChangeRequest(cr.id, 'Approve', null)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function reject() {
    if (!rejectComments.trim()) { setError('Comments are required when rejecting.'); return }
    setBusyId(rejecting.id)
    setError(null)
    try {
      await decideChangeRequest(rejecting.id, 'Reject', rejectComments.trim())
      setRejecting(null)
      setRejectComments('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setBusyId(null)
    }
  }

  function diffOf(cr) {
    try {
      const before = JSON.parse(cr.originalJson || '{}')
      const after = JSON.parse(cr.proposedJson || '{}')
      return Object.keys(CR_FIELD_LABELS)
        .filter((k) => String(before[k] ?? '') !== String(after[k] ?? ''))
        .map((k) => ({ label: CR_FIELD_LABELS[k], before: before[k] ?? '—', after: after[k] ?? '—' }))
    } catch {
      return []
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>
        Initiative change requests
        {pending.length > 0 && <span className="cr-count-badge">{pending.length} pending</span>}
      </h3>
      <p className="muted" style={{ marginTop: -6 }}>
        Corrections proposed by sites on months that are already submitted or approved.
        Approving applies the change immediately; rejecting sends your comments back to the site.
      </p>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {loading ? (
        <Spinner label="Loading change requests…" />
      ) : pending.length === 0 ? (
        <EmptyState>No pending change requests. 🎉</EmptyState>
      ) : (
        <div className="cr-queue">
          {pending.map((cr) => {
            const diff = diffOf(cr)
            return (
              <div key={cr.id} className={`cr-item${cr.requestType === 'Delete' ? ' cr-delete' : ''}`}>
                <div className="cr-item-head">
                  <div>
                    <strong>{cr.initiativeName}</strong>
                    <span className="muted"> · {cr.siteName} · {cr.periodLabel} · {cr.initiativeType}</span>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {cr.requestType === 'Delete' ? 'Deletion requested' : 'Update requested'} by {cr.requestedBy}
                      {' '}on {new Date(cr.requestedAtUtc).toLocaleString()}
                    </div>
                  </div>
                  <div className="row" style={{ marginBottom: 0, gap: 6 }}>
                    <button type="button" disabled={busyId === cr.id} onClick={() => approve(cr)}>
                      {cr.requestType === 'Delete' ? 'Approve deletion' : 'Approve & apply'}
                    </button>
                    <button type="button" className="secondary" disabled={busyId === cr.id}
                      onClick={() => { setRejecting(cr); setRejectComments('') }}>
                      Reject
                    </button>
                  </div>
                </div>

                <div className="cr-just"><strong>Justification:</strong> {cr.justification}</div>

                {cr.requestType === 'Update' && diff.length > 0 && (
                  <table className="cr-diff">
                    <thead>
                      <tr><th>Field</th><th>Current</th><th>Proposed</th></tr>
                    </thead>
                    <tbody>
                      {diff.map((d) => (
                        <tr key={d.label}>
                          <td>{d.label}</td>
                          <td className="cr-before">{String(d.before)}</td>
                          <td className="cr-after">{String(d.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rejecting && (
        <div className="modal-backdrop" onClick={() => setRejecting(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Reject change request — {rejecting.initiativeName}</h3>
            <p className="muted">The site will see these comments on the initiative.</p>
            <textarea rows={3} autoFocus value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              placeholder="e.g. Status change needs the completed validation report attached first." />
            <div className="row" style={{ marginTop: 12, marginBottom: 0, justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setRejecting(null)}>Cancel</button>
              <button type="button" className="danger" disabled={busyId === rejecting.id} onClick={reject}>
                {busyId === rejecting.id ? 'Rejecting…' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
