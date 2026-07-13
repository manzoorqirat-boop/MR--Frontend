import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  getInitiatives, saveInitiativesBulk, deleteInitiative, updateInitiative,
  getInitiativeAttachments, uploadInitiativeAttachment,
  downloadInitiativeAttachment, deleteInitiativeAttachment,
  getSiteSubmissions, createChangeRequest, getChangeRequestsFor
} from '../client'
import { INITIATIVE_TYPES, COMPLETION_STATUSES } from '../../constants'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// ============================================================================
//  Initiatives — complete workflow:
//   1. ADD      — draft rows below, "Save new initiatives"
//   2. PROGRESS — saved rows are editable in place (status, remarks, details);
//                 a row with changes shows Save/Undo
//   3. EVIDENCE — 📎 attach files per initiative (photos, SOPs, approvals);
//                 upload/download/delete in a popup
//   4. SUBMIT   — once the month is submitted to corporate everything freezes
//                 (server-enforced) until returned for revision
// ============================================================================

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

const editableOf = (r) => ({
  name: r.name || '',
  department: r.department || '',
  category: r.category || '',
  facilitatorName: r.facilitatorName || '',
  departmentHead: r.departmentHead || '',
  status: r.status,
  remarks: r.remarks || ''
})

export default function InitiativesPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()

  const [type, setType] = useState(INITIATIVE_TYPES[0].value)
  const [saved, setSaved] = useState([])          // rows as returned by the API
  const [edits, setEdits] = useState({})          // id -> edited fields
  const [draftRows, setDraftRows] = useState([blankRow()])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowBusyId, setRowBusyId] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [attachFor, setAttachFor] = useState(null) // initiative row for popup
  const [crFor, setCrFor] = useState(null)          // initiative row for change-request popup
  const [submissionStatus, setSubmissionStatus] = useState('NotStarted')

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
      const e = {}
      for (const r of data) e[r.id] = editableOf(r)
      setEdits(e)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [canQuery, selectedSiteId, selectedPeriodId, type])

  useEffect(() => {
    load()
    setDraftRows([blankRow()])
    setNotice(null)
  }, [load])

  // The month's workflow state decides the editing mode: open months are
  // edited directly; Submitted/Approved months take change requests instead.
  useEffect(() => {
    if (!selectedSiteId || !selectedPeriodId) return
    getSiteSubmissions(selectedPeriodId)
      .then((subs) => {
        const own = subs.find((x) => x.siteId === selectedSiteId)
        setSubmissionStatus(own?.status ?? 'NotStarted')
      })
      .catch(() => setSubmissionStatus('NotStarted'))
  }, [selectedSiteId, selectedPeriodId])

  const frozen = submissionStatus === 'Submitted' || submissionStatus === 'Approved'
  const readOnly = isPeriodLocked || frozen

  const isRowDirty = useCallback(
    (r) => JSON.stringify(edits[r.id]) !== JSON.stringify(editableOf(r)),
    [edits]
  )

  function setEdit(id, field, value) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: value } }))
  }

  async function saveRow(r) {
    const e = edits[r.id]
    if (!e.name.trim() || !e.department.trim()) {
      setError('Name and Department are required.')
      return
    }
    setRowBusyId(r.id)
    setError(null)
    try {
      await updateInitiative(r.id, {
        name: e.name, department: e.department, category: e.category || null,
        facilitatorName: e.facilitatorName, departmentHead: e.departmentHead,
        status: e.status, remarks: e.remarks || null
      })
      setNotice(`Updated "${e.name}".`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setRowBusyId(null)
    }
  }

  function undoRow(r) {
    setEdits((e) => ({ ...e, [r.id]: editableOf(r) }))
  }

  async function removeRow(r) {
    if (!window.confirm(`Delete initiative "${r.name}"? Its attachments will be deleted too.`)) return
    setRowBusyId(r.id)
    setError(null)
    try {
      await deleteInitiative(r.id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setRowBusyId(null)
    }
  }

  // ---- Draft (new) rows ----
  const nextSerial = useMemo(
    () => saved.reduce((m, r) => Math.max(m, r.serialNo || 0), 0) + 1,
    [saved]
  )
  function updateDraft(i, field, value) {
    setDraftRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }
  const addDraft = () => setDraftRows((rows) => [...rows, blankRow()])
  const removeDraft = (i) =>
    setDraftRows((rows) => (rows.length === 1 ? [blankRow()] : rows.filter((_, idx) => idx !== i)))

  async function handleSaveNew() {
    const rows = draftRows.filter((r) => r.name.trim() && r.department.trim())
    if (!rows.length) {
      setError('Fill at least Name and Department on one row.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveInitiativesBulk({
        siteId: selectedSiteId,
        reportPeriodId: selectedPeriodId,
        type,
        rows: rows.map((r, i) => ({
          serialNo: nextSerial + i,
          name: r.name, department: r.department,
          category: showCategory ? r.category : null,
          facilitatorName: r.facilitatorName, departmentHead: r.departmentHead,
          status: r.status, remarks: r.remarks || null
        }))
      })
      setNotice(`Added ${rows.length} initiative(s).`)
      setDraftRows([blankRow()])
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const cols = 6 + (showCategory ? 1 : 0)

  return (
    <>
      <SiteAndPeriodPicker helpText="Improvement initiatives — add, progress their status, attach evidence, then submit the month to corporate from the Dashboard." />

      <div className="card">
        <label className="picker-label" style={{ maxWidth: 480 }}>
          Initiative type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {INITIATIVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <ErrorBanner message={error} />
      {notice && <div className="success-banner">{notice}</div>}
      {isPeriodLocked && <p className="warning-box">This report period is locked — editing is disabled.</p>}
      {frozen && !isPeriodLocked && (
        <p className="warning-box">
          This month is {submissionStatus === 'Approved' ? 'approved' : 'with corporate for review'} —
          initiatives are frozen. Use <strong>Request change</strong> on a row to propose a correction;
          it applies only after corporate approves it.
        </p>
      )}

      {/* ================= Saved initiatives: the living register ================= */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{typeMeta.label} — {saved.length} initiative(s)</h2>
        {loading ? (
          <Spinner label="Loading initiatives…" />
        ) : saved.length === 0 ? (
          <EmptyState>No {typeMeta.label} initiatives for this site and period yet — add the first below.</EmptyState>
        ) : (
          <div className="scorecard-table-wrap">
            <table className="initiative-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Name *</th>
                  <th>Department *</th>
                  {showCategory && <th>Category</th>}
                  <th>Facilitator</th>
                  <th>Dept. head</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th>Remarks</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {saved.map((r) => {
                  const e = edits[r.id] || editableOf(r)
                  const dirty = isRowDirty(r)
                  const busy = rowBusyId === r.id
                  return (
                    <tr key={r.id} className={dirty ? 'row-dirty' : ''}>
                      <td className="muted">{r.serialNo}</td>
                      <td><input value={e.name} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'name', ev.target.value)} /></td>
                      <td><input value={e.department} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'department', ev.target.value)} /></td>
                      {showCategory && (
                        <td><input value={e.category} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'category', ev.target.value)} /></td>
                      )}
                      <td><input value={e.facilitatorName} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'facilitatorName', ev.target.value)} /></td>
                      <td><input value={e.departmentHead} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'departmentHead', ev.target.value)} /></td>
                      <td>
                        <select value={e.status} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'status', ev.target.value)}>
                          {COMPLETION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td><input value={e.remarks} disabled={readOnly} onChange={(ev) => setEdit(r.id, 'remarks', ev.target.value)} /></td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="secondary attach-btn"
                            title="Attachments — evidence files"
                            onClick={() => setAttachFor(r)}
                          >
                            📎 {r.attachmentCount > 0 ? r.attachmentCount : ''}
                          </button>
                          {frozen && !isPeriodLocked ? (
                            r.pendingCrCount > 0 ? (
                              <span className="cr-pending-chip" title="A change request is awaiting corporate decision">CR pending</span>
                            ) : (
                              <button type="button" className="secondary" onClick={() => setCrFor(r)} title="Propose a change for corporate approval">
                                Request change
                              </button>
                            )
                          ) : dirty ? (
                            <>
                              <button type="button" disabled={busy || readOnly} onClick={() => saveRow(r)}>
                                {busy ? '…' : 'Save'}
                              </button>
                              <button type="button" className="secondary" disabled={busy} onClick={() => undoRow(r)}>Undo</button>
                            </>
                          ) : (
                            <button type="button" className="secondary" disabled={busy || readOnly} onClick={() => removeRow(r)} title="Delete initiative">
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {saved.length > 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Edit any cell and a Save button appears on that row. Use 📎 to attach evidence
            (photos, SOPs, approval mails — max 10 MB per file).
          </p>
        )}
      </div>

      {/* ================= Add new initiatives ================= */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add new — {typeMeta.label}</h2>
        <p className="muted">New rows are appended; serial numbers continue from {nextSerial}.</p>
        <div className="scorecard-table-wrap">
          <table className="initiative-table">
            <thead>
              <tr>
                <th>Name *</th>
                <th>Department *</th>
                {showCategory && <th>Category</th>}
                <th>Facilitator</th>
                <th>Dept. head</th>
                <th style={{ width: 130 }}>Status</th>
                <th>Remarks</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {draftRows.map((r, i) => (
                <tr key={i}>
                  <td><input value={r.name} disabled={readOnly} onChange={(e) => updateDraft(i, 'name', e.target.value)} /></td>
                  <td><input value={r.department} disabled={readOnly} onChange={(e) => updateDraft(i, 'department', e.target.value)} /></td>
                  {showCategory && (
                    <td><input value={r.category} disabled={readOnly} onChange={(e) => updateDraft(i, 'category', e.target.value)} /></td>
                  )}
                  <td><input value={r.facilitatorName} disabled={readOnly} onChange={(e) => updateDraft(i, 'facilitatorName', e.target.value)} /></td>
                  <td><input value={r.departmentHead} disabled={readOnly} onChange={(e) => updateDraft(i, 'departmentHead', e.target.value)} /></td>
                  <td>
                    <select value={r.status} disabled={readOnly} onChange={(e) => updateDraft(i, 'status', e.target.value)}>
                      {COMPLETION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td><input value={r.remarks} disabled={readOnly} onChange={(e) => updateDraft(i, 'remarks', e.target.value)} /></td>
                  <td>
                    <button type="button" className="secondary" disabled={readOnly} onClick={() => removeDraft(i)} title="Remove row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
          <button type="button" className="secondary" disabled={readOnly} onClick={addDraft}>+ Add row</button>
          <button type="button" disabled={readOnly || saving} onClick={handleSaveNew}>
            {saving ? 'Saving…' : 'Save new initiatives'}
          </button>
          <span className="muted">Tip: attach evidence with 📎 after saving.</span>
        </div>
      </div>

      {/* ================= Change request popup ================= */}
      {crFor && (
        <ChangeRequestModal
          initiative={crFor}
          showCategory={showCategory}
          onDone={async () => { setCrFor(null); await load() }}
          onClose={() => setCrFor(null)}
        />
      )}

      {/* ================= Attachments popup ================= */}
      {attachFor && (
        <AttachmentsModal
          initiative={attachFor}
          locked={isPeriodLocked}
          onChanged={load}
          onClose={() => setAttachFor(null)}
        />
      )}
    </>
  )
}

/* ==================== Attachments popup ==================== */
function AttachmentsModal({ initiative, locked, onChanged, onClose }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFiles(await getInitiativeAttachments(initiative.id))
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [initiative.id])

  useEffect(() => { load() }, [load])

  async function handleUpload(ev) {
    const chosen = [...(ev.target.files || [])]
    if (!chosen.length) return
    setUploading(true)
    setError(null)
    try {
      for (const f of chosen) {
        await uploadInitiativeAttachment(initiative.id, f)
      }
      await load()
      await onChanged()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDownload(f) {
    setError(null)
    try {
      const blob = await downloadInitiativeAttachment(f.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = f.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  async function handleDelete(f) {
    if (!window.confirm(`Delete "${f.fileName}"?`)) return
    setError(null)
    try {
      await deleteInitiativeAttachment(f.id)
      await load()
      await onChanged()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  const fmtSize = (b) =>
    b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>📎 Attachments — {initiative.name}</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          Evidence for this initiative: photos, SOPs, approval mails. PDF, Office, images,
          CSV/TXT and mail files up to 10 MB each.
        </p>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <Spinner label="Loading attachments…" />
        ) : files.length === 0 ? (
          <EmptyState>No files attached yet.</EmptyState>
        ) : (
          <ul className="attachment-list">
            {files.map((f) => (
              <li key={f.id} className="attachment-item">
                <button type="button" className="attachment-name" onClick={() => handleDownload(f)} title="Download">
                  {f.fileName}
                </button>
                <span className="attachment-meta">
                  {fmtSize(f.sizeBytes)} · {f.uploadedBy} · {new Date(f.uploadedAtUtc).toLocaleDateString()}
                </span>
                {!locked && (
                  <button type="button" className="secondary attachment-del" onClick={() => handleDelete(f)} title="Delete file">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!locked && (
          <div className="row" style={{ marginTop: 12 }}>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.csv,.txt,.msg,.eml"
              disabled={uploading}
              onChange={handleUpload}
            />
            {uploading && <Spinner label="Uploading…" />}
          </div>
        )}

        <div className="row" style={{ marginTop: 12, marginBottom: 0, justifyContent: 'flex-end' }}>
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* ==================== Change request popup (site side) ==================== */
function ChangeRequestModal({ initiative, showCategory, onDone, onClose }) {
  const [requestType, setRequestType] = useState('Update')
  const [proposed, setProposed] = useState(editableOf(initiative))
  const [justification, setJustification] = useState('')
  const [history, setHistory] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getChangeRequestsFor(initiative.id).then(setHistory).catch(() => setHistory([]))
  }, [initiative.id])

  const set = (field, value) => setProposed((p) => ({ ...p, [field]: value }))

  async function handleSubmit() {
    if (!justification.trim()) {
      setError('A justification is required — corporate needs to know why the change is needed.')
      return
    }
    if (requestType === 'Update' && (!proposed.name.trim() || !proposed.department.trim())) {
      setError('Name and Department are required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createChangeRequest(initiative.id, {
        requestType,
        justification: justification.trim(),
        proposed: requestType === 'Update'
          ? {
              name: proposed.name, department: proposed.department,
              category: proposed.category || null,
              facilitatorName: proposed.facilitatorName, departmentHead: proposed.departmentHead,
              status: proposed.status, remarks: proposed.remarks || null
            }
          : null
      })
      await onDone()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
      setSubmitting(false)
    }
  }

  const changed = (field) =>
    requestType === 'Update' && String(proposed[field] ?? '') !== String(editableOf(initiative)[field] ?? '')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Change request — {initiative.name}</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          This month is frozen, so the correction applies only after corporate approves it.
        </p>

        <div className="row" style={{ marginBottom: 12 }}>
          <label className="cr-type-option">
            <input type="radio" checked={requestType === 'Update'} onChange={() => setRequestType('Update')} />
            Update fields
          </label>
          <label className="cr-type-option">
            <input type="radio" checked={requestType === 'Delete'} onChange={() => setRequestType('Delete')} />
            Delete this initiative
          </label>
        </div>

        {requestType === 'Update' && (
          <div className="cr-fields">
            <label className="picker-label">Name *
              <input className={changed('name') ? 'cr-changed' : ''} value={proposed.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="picker-label">Department *
              <input className={changed('department') ? 'cr-changed' : ''} value={proposed.department} onChange={(e) => set('department', e.target.value)} />
            </label>
            {showCategory && (
              <label className="picker-label">Category
                <input className={changed('category') ? 'cr-changed' : ''} value={proposed.category} onChange={(e) => set('category', e.target.value)} />
              </label>
            )}
            <label className="picker-label">Facilitator
              <input className={changed('facilitatorName') ? 'cr-changed' : ''} value={proposed.facilitatorName} onChange={(e) => set('facilitatorName', e.target.value)} />
            </label>
            <label className="picker-label">Dept. head
              <input className={changed('departmentHead') ? 'cr-changed' : ''} value={proposed.departmentHead} onChange={(e) => set('departmentHead', e.target.value)} />
            </label>
            <label className="picker-label">Status
              <select className={changed('status') ? 'cr-changed' : ''} value={proposed.status} onChange={(e) => set('status', e.target.value)}>
                {COMPLETION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="picker-label" style={{ gridColumn: '1 / -1' }}>Remarks
              <input className={changed('remarks') ? 'cr-changed' : ''} value={proposed.remarks} onChange={(e) => set('remarks', e.target.value)} />
            </label>
          </div>
        )}

        <label className="picker-label" style={{ marginTop: 10 }}>
          Justification * (why is this change needed?)
          <textarea
            rows={3}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={requestType === 'Delete'
              ? 'e.g. Duplicate of initiative #4; entered twice by mistake.'
              : 'e.g. Status was reported as Completed but validation finished only on 12-Aug.'}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        {history.length > 0 && (
          <div className="cr-history">
            <strong style={{ fontSize: 13 }}>Previous requests</strong>
            {history.map((h) => (
              <div key={h.id} className="cr-history-item">
                <span className={`status-badge cr-badge-${h.status}`}>{h.status}</span>
                <span>{h.requestType} · {h.requestedBy} · {new Date(h.requestedAtUtc).toLocaleDateString()}</span>
                {h.decisionComments && <span className="muted">— “{h.decisionComments}”</span>}
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 14, marginBottom: 0, justifyContent: 'flex-end' }}>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={requestType === 'Delete' ? 'danger' : ''} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : requestType === 'Delete' ? 'Request deletion' : 'Submit change request'}
          </button>
        </div>
      </div>
    </div>
  )
}
