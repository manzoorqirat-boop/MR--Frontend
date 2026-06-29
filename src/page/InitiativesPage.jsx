import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { getInitiatives, saveInitiativesBulk, deleteInitiative } from '../client'
import { INITIATIVE_TYPES, COMPLETION_STATUSES, labelFor } from '../../constants'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import StatusBadge from '../StatusBadge'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

function blankRow() {
  return {
    name: '',
    department: '',
    category: '',
    facilitatorName: '',
    departmentHead: '',
    status: COMPLETION_STATUSES[0].value,
    remarks: ''
  }
}

export default function InitiativesPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()

  const [type, setType] = useState(INITIATIVE_TYPES[0].value)
  const [saved, setSaved] = useState([])
  const [draftRows, setDraftRows] = useState([blankRow()])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const typeMeta = useMemo(
    () => INITIATIVE_TYPES.find((t) => t.value === type) || INITIATIVE_TYPES[0],
    [type]
  )
  const showCategory = typeMeta.hasCategory
  const canQuery = Boolean(selectedSiteId && selectedPeriodId && type)

  const load = useCallback(async () => {
    if (!canQuery) return
    setLoading(true)
    setError(null)
    try {
      const data = await getInitiatives(selectedSiteId, selectedPeriodId, type)
      setSaved(data)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [canQuery, selectedSiteId, selectedPeriodId, type])

  useEffect(() => {
    load()
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
    return draftRows.filter((r) => r.name.trim() && r.department.trim())
  }

  async function handleSave() {
    const rows = validDrafts()
    if (rows.length === 0) {
      setError('Add at least one row with a name and a department before saving.')
      return
    }
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        siteId: selectedSiteId,
        reportPeriodId: selectedPeriodId,
        type,
        rows: rows.map((r, i) => ({
          siteId: selectedSiteId,
          reportPeriodId: selectedPeriodId,
          type,
          serialNo: nextSerial + i,
          name: r.name.trim(),
          department: r.department.trim(),
          // Category only applies to Lean Laboratory & Digitalization; send null otherwise.
          category: showCategory ? (r.category.trim() || null) : null,
          facilitatorName: r.facilitatorName.trim(),
          departmentHead: r.departmentHead.trim(),
          status: r.status,
          remarks: r.remarks.trim() || null
        }))
      }
      const res = await saveInitiativesBulk(payload)
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
      await deleteInitiative(id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <SiteAndPeriodPicker helpText="Sheets 2–6 — improvement initiatives. Pick the initiative type below; rows are stored per site, period and type." />

      <div className="card">
        <label className="picker-label">
          Initiative type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {INITIATIVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        {showCategory && (
          <p className="muted" style={{ marginBottom: 0 }}>
            This type uses the optional <strong>Category</strong> column.
          </p>
        )}
      </div>

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
        <h2 style={{ marginBottom: 4 }}>Saved — {typeMeta.label}</h2>
        {loading ? (
          <Spinner label="Loading initiatives…" />
        ) : !canQuery ? (
          <EmptyState>Pick a site and report period above.</EmptyState>
        ) : saved.length === 0 ? (
          <EmptyState>No {typeMeta.label} initiatives for this site and period yet.</EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 45 }}>S.No</th>
                  <th>Name</th>
                  <th>Department</th>
                  {showCategory && <th>Category</th>}
                  <th>Facilitator</th>
                  <th>Dept. head</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th>Remarks</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {saved.map((r) => (
                  <tr key={r.id}>
                    <td>{r.serialNo}</td>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    {showCategory && <td>{r.category || '—'}</td>}
                    <td>{r.facilitatorName}</td>
                    <td>{r.departmentHead}</td>
                    <td><StatusBadge status={r.status} label={labelFor(COMPLETION_STATUSES, r.status)} /></td>
                    <td>{r.remarks || '—'}</td>
                    <td>
                      <button className="danger" disabled={isPeriodLocked} onClick={() => handleDelete(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Add new — {typeMeta.label}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          New rows are appended; serial numbers continue from {nextSerial}.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name *</th>
                <th>Department *</th>
                {showCategory && <th>Category</th>}
                <th>Facilitator</th>
                <th>Dept. head</th>
                <th style={{ width: 140 }}>Status</th>
                <th>Remarks</th>
                <th style={{ width: 45 }}></th>
              </tr>
            </thead>
            <tbody>
              {draftRows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <input type="text" value={row.name} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'name', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <input type="text" value={row.department} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'department', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  {showCategory && (
                    <td>
                      <input type="text" value={row.category} disabled={isPeriodLocked}
                        onChange={(e) => updateDraft(index, 'category', e.target.value)} style={{ width: '100%' }} />
                    </td>
                  )}
                  <td>
                    <input type="text" value={row.facilitatorName} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'facilitatorName', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <input type="text" value={row.departmentHead} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'departmentHead', e.target.value)} style={{ width: '100%' }} />
                  </td>
                  <td>
                    <select value={row.status} disabled={isPeriodLocked}
                      onChange={(e) => updateDraft(index, 'status', e.target.value)}>
                      {COMPLETION_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
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
            {saving ? 'Saving…' : 'Save new initiatives'}
          </button>
        </div>
      </div>
    </>
  )
}