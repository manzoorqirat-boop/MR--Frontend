import React, { useCallback, useEffect, useState } from 'react'
import { getSiteSubmissions, submitToCorporate } from '../client'
import { formatPeriodLabel } from '../../constants'

// Compact submission workflow bar shown on the Scorecard page (site users):
// current status, corporate's comments when returned, and the submit action.
// Reports the status upward so the page can freeze editing while under review.
export default function SubmissionBar({
  siteId, reportPeriodId, period, filledCount, totalCount, isPeriodLocked, onStatusChange
}) {
  const [submission, setSubmission] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const status = submission?.status ?? 'NotStarted'

  const load = useCallback(async () => {
    if (!siteId || !reportPeriodId) return
    try {
      const subs = await getSiteSubmissions(reportPeriodId)
      const own = subs.find((s) => s.siteId === siteId) || null
      setSubmission(own)
      onStatusChange?.(own?.status ?? 'NotStarted')
    } catch {
      /* bar is best-effort; entry still guarded server-side */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, reportPeriodId])

  useEffect(() => { setError(null); load() }, [load])

  async function handleSubmit() {
    const label = period ? formatPeriodLabel(period) : 'this month'
    const unfilled = totalCount - filledCount
    const ok = window.confirm(
      `Submit ${label} to corporate for review?\n\n` +
      (unfilled > 0 ? `Note: ${unfilled} of ${totalCount} sheets have no data yet.\n\n` : '') +
      'Once submitted, the scorecard becomes read-only until corporate approves it or returns it for revision.'
    )
    if (!ok) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitToCorporate({ siteId, reportPeriodId })
      setSubmission(result)
      onStatusChange?.(result.status)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!siteId || !reportPeriodId) return null
  const canSubmit = !isPeriodLocked && (status === 'NotStarted' || status === 'Returned')

  return (
    <div className={`sub-bar sub-bar-${status}`}>
      <SubmissionStatusPill status={status} />

      <span className="sub-bar-text">
        {status === 'NotStarted' && 'This month has not been submitted to corporate yet.'}
        {status === 'Submitted' && (
          <>Submitted by {submission?.submittedBy || 'your site'}
            {submission?.submittedAtUtc ? ` on ${new Date(submission.submittedAtUtc).toLocaleString()}` : ''} — read-only while corporate reviews.</>
        )}
        {status === 'Approved' && (
          <>Approved by {submission?.reviewedBy || 'corporate'}
            {submission?.reviewedAtUtc ? ` on ${new Date(submission.reviewedAtUtc).toLocaleString()}` : ''}. This month is complete.</>
        )}
        {status === 'Returned' && (
          <><strong>Returned by {submission?.reviewedBy || 'corporate'}:</strong> {submission?.reviewComments || 'see comments'} — fix and resubmit.</>
        )}
      </span>

      {error && <span className="sub-bar-error">{error}</span>}

      {canSubmit && (
        <button type="button" disabled={submitting} onClick={handleSubmit} className="sub-bar-btn">
          {submitting ? 'Submitting…' : status === 'Returned' ? 'Resubmit to corporate' : 'Submit to corporate'}
        </button>
      )}
    </div>
  )
}

export function SubmissionStatusPill({ status }) {
  const labels = {
    NotStarted: 'Not submitted',
    Submitted: 'Awaiting review',
    Approved: 'Approved',
    Returned: 'Returned for revision'
  }
  return (
    <span className={`status-badge status-sub-${status}`}>
      {labels[status] ?? status}
    </span>
  )
}
