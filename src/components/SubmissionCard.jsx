import React, { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  getSiteSubmissions,
  submitToCorporate,
  getTraining,
  getCostSavings,
  getScorecardStatus
} from '../client'
import { formatPeriodLabel } from '../../constants'
import { Spinner } from './Feedback'

// Shown to site users on the Dashboard: the workflow state of their month,
// a quick completeness summary, corporate's comments if the month was
// returned, and the "Submit to corporate" action.
export default function SubmissionCard() {
  const { user } = useAuth()
  const { selectedSiteId, selectedPeriodId, selectedPeriod, isPeriodLocked } = useAppContext()

  const [submission, setSubmission] = useState(null)
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [justSubmitted, setJustSubmitted] = useState(false)

  const load = useCallback(async () => {
    if (!selectedSiteId || !selectedPeriodId) return
    setLoading(true)
    setError(null)
    try {
      const [subs, training, costSavings, scorecardStatus] = await Promise.all([
        getSiteSubmissions(selectedPeriodId),
        getTraining(selectedSiteId, selectedPeriodId),
        getCostSavings(selectedSiteId, selectedPeriodId),
        getScorecardStatus(selectedSiteId, selectedPeriodId).catch(() => null)
      ])
      setSubmission(subs.find((s) => s.siteId === selectedSiteId) || null)
      const scorecardSheets = scorecardStatus
        ? Object.values(scorecardStatus).filter((n) => n > 0).length
        : null
      setCounts({
        training: training.length,
        costSavings: costSavings.length,
        scorecardSheets
      })
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, selectedPeriodId])

  useEffect(() => {
    setJustSubmitted(false)
    load()
  }, [load])

  async function handleSubmit() {
    const label = selectedPeriod ? formatPeriodLabel(selectedPeriod) : 'this month'
    const ok = window.confirm(
      `Submit ${label} to corporate for review?\n\n` +
      'Once submitted, your data for this month becomes read-only until ' +
      'corporate approves it or returns it for revision.'
    )
    if (!ok) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitToCorporate({ siteId: selectedSiteId, reportPeriodId: selectedPeriodId })
      setSubmission(result)
      setJustSubmitted(true)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!selectedSiteId || !selectedPeriodId) return null

  const status = submission?.status ?? 'NotStarted'
  const periodLabel = selectedPeriod ? formatPeriodLabel(selectedPeriod) : ''
  const canSubmit = !isPeriodLocked && (status === 'NotStarted' || status === 'Returned')

  return (
    <div className={`card submission-card submission-${status}`}>
      <div className="submission-head">
        <div>
          <h2>Submission to corporate — {periodLabel}</h2>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {user?.siteName ? `${user.siteName} (${user.siteCode})` : 'Your site'}
          </p>
        </div>
        <SubmissionStatusPill status={status} />
      </div>

      {loading && <Spinner label="Checking submission status…" />}

      {!loading && (
        <>
          {counts && (
            <div className="submission-checklist">
              <ChecklistItem label="Training rows" count={counts.training} />
              <ChecklistItem label="Cost saving projects" count={counts.costSavings} />
              {counts.scorecardSheets != null && (
                <ChecklistItem label="Scorecard sheets with data" count={counts.scorecardSheets} />
              )}
            </div>
          )}

          {status === 'Returned' && submission?.reviewComments && (
            <div className="warning-box">
              <strong>Returned by {submission.reviewedBy || 'corporate'}:</strong>{' '}
              {submission.reviewComments}
              <div className="muted" style={{ marginTop: 4 }}>
                Make the requested corrections, then resubmit below.
              </div>
            </div>
          )}

          {status === 'Submitted' && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Submitted by {submission?.submittedBy || 'your site'}
              {submission?.submittedAtUtc
                ? ` on ${new Date(submission.submittedAtUtc).toLocaleString()}`
                : ''}. Your data for this month is read-only while corporate reviews it.
            </p>
          )}

          {status === 'Approved' && (
            <p className="muted" style={{ marginBottom: 0 }}>
              Approved by {submission?.reviewedBy || 'corporate'}
              {submission?.reviewedAtUtc
                ? ` on ${new Date(submission.reviewedAtUtc).toLocaleString()}`
                : ''}. This month is complete — thank you!
            </p>
          )}

          {justSubmitted && (
            <div className="success-banner">
              Submitted to corporate. You'll be able to edit again if the month is returned for revision.
            </div>
          )}

          {error && <div className="error-banner" role="alert">{error}</div>}

          {canSubmit && (
            <div className="row" style={{ marginTop: 12, marginBottom: 0 }}>
              <button disabled={submitting} onClick={handleSubmit}>
                {submitting
                  ? 'Submitting…'
                  : status === 'Returned' ? 'Resubmit to corporate' : 'Submit to corporate'}
              </button>
              <span className="muted">
                Check the counts above before submitting — data becomes read-only under review.
              </span>
            </div>
          )}

          {isPeriodLocked && (
            <p className="muted" style={{ marginBottom: 0 }}>
              This period has been locked by corporate; submissions are closed.
            </p>
          )}
        </>
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

function ChecklistItem({ label, count }) {
  return (
    <div className={`checklist-item${count > 0 ? ' has-data' : ''}`}>
      <span className="checklist-count">{count}</span>
      <span className="checklist-label">{label}</span>
    </div>
  )
}
