import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { getTraining, saveTrainingBulk, deleteTraining } from '../client'
import { TRAINING_STATUSES, labelFor } from '../../constants'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import StatusBadge from '../StatusBadge'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// A blank draft row. SerialNo is filled in just before saving so it follows
// on from whatever is already persisted for this site/period.
function blankRow() {
  return {
    topic: '',
    trainingImpartedBy: '',
    department: '',
    status: TRAINING_STATUSES[0].value
  }
}

export default function TrainingPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()

  const [saved, setSaved] = useState([])
  const [draftRows, setDraftRows] = useState([blankRow()])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const canQuery = Boolean(selectedSiteId && selectedPeriodId)

  const load = useCallback(async () => {
    if (!canQuery) return
    setLoading(true)
    setError(null)
    try {
      const data = await getTraining(selectedSiteId, selectedPeriodId)
      setSaved(data)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [canQuery, selectedSiteId, selectedPeriodId])

  useEffect(() => {
    load()
    // Reset the draft editor whenever the target site/period changes.
    setDraftRows([blankRow()])
    setResult(null)
  }, [load])

  const nextSerial = useMemo(() => {
    const maxSaved = saved.reduce((m, r) => Math.max(m, r.serialNo || 0), 0)
    return maxSaved + 1
  }, [saved])

  function updateDraft(index, field, value) {
    setDraftRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function addDraft() {
    setDraftRows((rows) => [...rows, blankRow()])
  }

  function removeDraft(index) {
    setDraftRows((rows) => (rows.length === 1 ? [blankRow()] : rows.filter((_, i) => i !== index)))
  }

  function validDrafts() {
    // Only send rows the user actually filled in (topic + department),
    // mirroring the backend's required-field check so we don't ship empty rows.
    return draftRows.filter((r) => r.topic.trim() && r.department.trim())
  }

  async function handleSave() {
    const rows = validDrafts()
    if (rows.length === 0) {
      setError('Add at least one row with a topic and a department before saving.')
      return
    }
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        siteId: selectedSiteId,
        reportPeriodId: selectedPeriodId,
        rows: rows.map((r, i) => ({
          siteId: selectedSiteId,
          reportPeriodId: selectedPeriodId,
          serialNo: nextSerial + i,
          topic: r.topic.trim(),
          trainingImpartedBy: r.trainingImpartedBy.trim(),
          department: r.department.trim(),
          status: r.status
        }))
      }
      const res = await saveTrainingBulk(payload)
      setResult(res)
      setDraftRows([blankRow()])
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setError(null)
    try {
      await deleteTraining(id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <SiteAndPeriodPicker helpText="Sheet 1 — People Competency / Training. One row per training topic for this site and month." />

      <ErrorBanner message={error} />

      {isPeriodLocked && (
        <p className="warning-box">This report period is locked — adding and deleting rows is disabled.</p>
      )}

      {result && (
        <div className="warning-box" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
          Saved {result.rowsAccepted} row(s).{result.rowsRejected > 0 ? ` Rejected ${result.rowsRejected}.` : ''}
          {result.errors?.length > 0 && (
            <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          )}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Saved trainings</h2>
        {loading ? (
          <Spinner label="Loading training records…" />
        ) : !canQuery ? (
          <EmptyState>Pick a site and report period above.</EmptyState>
        ) : saved.length === 0 ? (
          <EmptyState>No training recorded for this site and period yet.</EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>S.No</th>
                <th>Topic</th>
                <th>Imparted by</th>
                <th>Department</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {saved.map((r) => (
                <tr key={r.id}>
                  <td>{r.serialNo}</td>
                  <td>{r.topic}</td>
                  <td>{r.trainingImpartedBy}</td>
                  <td>{r.department}</td>
                  <td><StatusBadge status={r.status} label={labelFor(TRAINING_STATUSES, r.status)} /></td>
                  <td>
                    <button
                      className="danger"
                      disabled={isPeriodLocked}
                      onClick={() => handleDelete(r.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Add new trainings</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          New rows are appended to the saved list; serial numbers continue from {nextSerial}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Topic *</th>
              <th>Imparted by</th>
              <th>Department *</th>
              <th style={{ width: 150 }}>Status</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {draftRows.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={row.topic}
                    disabled={isPeriodLocked}
                    onChange={(e) => updateDraft(index, 'topic', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.trainingImpartedBy}
                    disabled={isPeriodLocked}
                    onChange={(e) => updateDraft(index, 'trainingImpartedBy', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.department}
                    disabled={isPeriodLocked}
                    onChange={(e) => updateDraft(index, 'department', e.target.value)}
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <select
                    value={row.status}
                    disabled={isPeriodLocked}
                    onChange={(e) => updateDraft(index, 'status', e.target.value)}
                  >
                    {TRAINING_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="secondary"
                    disabled={isPeriodLocked}
                    onClick={() => removeDraft(index)}
                    title="Remove this draft row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" disabled={isPeriodLocked} onClick={addDraft}>
            + Add row
          </button>
          <button disabled={isPeriodLocked || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save new trainings'}
          </button>
        </div>
      </div>
    </>
  )
}