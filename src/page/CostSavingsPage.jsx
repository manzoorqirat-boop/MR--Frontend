import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { getCostSavings, saveCostSavingsBulk, deleteCostSaving } from '../client'
import { PROJECT_STATUSES, labelFor } from '../../constants'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import StatusBadge from '../StatusBadge'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

function blankRow() {
  return {
    projectName: '',
    potentialSavingLacs: '',
    projectStatus: PROJECT_STATUSES[0].value,
    validatedByFinance: false,
    remarks: ''
  }
}

export default function CostSavingsPage() {
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
      const data = await getCostSavings(selectedSiteId, selectedPeriodId)
      setSaved(data)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [canQuery, selectedSiteId, selectedPeriodId])

  useEffect(() => {
    load()
    setDraftRows([blankRow()])
    setResult(null)
  }, [load])

  const nextSerial = useMemo(() => {
    const maxSaved = saved.reduce((m, r) => Math.max(m, r.serialNo || 0), 0)
    return maxSaved + 1
  }, [saved])

  const totals = useMemo(() => {
    const potential = saved.reduce((s, r) => s + Number(r.potentialSavingLacs || 0), 0)
    const validated = saved
      .filter((r) => r.validatedByFinance)
      .reduce((s, r) => s + Number(r.potentialSavingLacs || 0), 0)
    return { potential, validated }
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
    return draftRows.filter((r) => r.projectName.trim())
  }

  async function handleSave() {
    const rows = validDrafts()
    if (rows.length === 0) {
      setError('Add at least one row with a project name before saving.')
      return
    }
    // Mirror the backend guard: potential saving cannot be negative.
    const bad = rows.find((r) => Number(r.potentialSavingLacs || 0) < 0)
    if (bad) {
      setError('Potential saving cannot be negative.')
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
          projectName: r.projectName.trim(),
          potentialSavingLacs: Number(r.potentialSavingLacs || 0),
          projectStatus: r.projectStatus,
          validatedByFinance: Boolean(r.validatedByFinance),
          remarks: r.remarks.trim() || null
        }))
      }
      const res = await saveCostSavingsBulk(payload)
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
      await deleteCostSaving(id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <SiteAndPeriodPicker helpText="Sheet 7 — Cost Savings. Amounts are in Lacs; finance-validated projects feed the validated-savings figure on the dashboard." />

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
        <h2 style={{ marginBottom: 4 }}>Saved cost-saving projects</h2>
        {loading ? (
          <Spinner label="Loading cost-saving projects…" />
        ) : !canQuery ? (
          <EmptyState>Pick a site and report period above.</EmptyState>
        ) : saved.length === 0 ? (
          <EmptyState>No cost-saving projects for this site and period yet.</EmptyState>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>S.No</th>
                  <th>Project</th>
                  <th style={{ width: 120 }}>Potential (Lacs)</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 90 }}>Validated</th>
                  <th>Remarks</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {saved.map((r) => (
                  <tr key={r.id}>
                    <td>{r.serialNo}</td>
                    <td>{r.projectName}</td>
                    <td>{Number(r.potentialSavingLacs).toFixed(2)}</td>
                    <td><StatusBadge status={r.projectStatus} label={labelFor(PROJECT_STATUSES, r.projectStatus)} /></td>
                    <td>{r.validatedByFinance ? 'Yes' : 'No'}</td>
                    <td>{r.remarks || '—'}</td>
                    <td>
                      <button className="danger" disabled={isPeriodLocked} onClick={() => handleDelete(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600 }}>Totals</td>
                  <td style={{ fontWeight: 600 }}>{totals.potential.toFixed(2)}</td>
                  <td colSpan={4} className="muted">{totals.validated.toFixed(2)} Lacs validated</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Add new cost-saving projects</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          New rows are appended; serial numbers continue from {nextSerial}.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Project name *</th>
                <th style={{ width: 140 }}>Potential (Lacs)</th>
                <th style={{ width: 150 }}>Status</th>
                <th style={{ width: 90 }}>Validated</th>
                <th>Remarks</th>
                <th style={{ width: 45 }}></th>
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input type="text" value={row.projectName} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'projectName', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" value={row.potentialSavingLacs} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'potentialSavingLacs', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <select value={row.projectStatus} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'projectStatus', e.target.value)}>
                      {PROJECT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={row.validatedByFinance} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'validatedByFinance', e.target.checked)} />
                  </td>
                  <td>
                    <input type="text" value={row.remarks} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'remarks', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <button className="secondary" disabled={isPeriodLocked}
                      onClick={() => removeDraft(index)} title="Remove this draft row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="secondary" disabled={isPeriodLocked} onClick={addDraft}>+ Add row</button>
          <button disabled={isPeriodLocked || saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save new projects'}
          </button>
        </div>
      </div>
    </>
  )
}