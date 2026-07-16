import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  getQaItRegister, saveQaItRegister, getEquipmentMaster, getMasterList,
  downloadQaItTemplate, importQaItRegister
} from '../client'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// ============================================================================
//  QA-IT Compliance Activities — Periodic Review register for computerized
//  systems, kept per site per YEAR. Mirrors the paper form:
//  LOCATION / VERSION / YEAR header + one row per equipment/instrument.
//  The "Actual review" deadline is the planned month + 2 months; each row
//  gets an automatic compliance status chip from that rule.
// ============================================================================

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const blankRow = () => ({
  equipmentName: '',
  equipmentCode: '',
  softwareNameVersion: '',
  departmentArea: '',
  systemCategory: '',
  initialQualificationDate: '',
  lastPeriodicReviewDate: '',
  nextPlannedDue: '',
  dueJustification: '',
  actualDoneOn: '',
  actualDoneBy: ''
})

// "yyyy-MM" -> months since year 0 (for easy comparisons); null if unset/invalid
function monthIndex(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '')
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null
}
const fmtMonth = (ym) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '')
  return m ? `${MONTHS_SHORT[Number(m[2]) - 1]}/${m[1]}` : ''
}

// Auto planned month per the frequency table: base date (last review, else
// initial qualification) + the category's frequency in years -> "yyyy-MM".
function computeAutoDue(row, categories) {
  const cat = categories.find((c) => c.value === row.systemCategory)
  if (!cat?.frequencyYears) return null
  const base = row.lastPeriodicReviewDate || row.initialQualificationDate
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base || '')
  if (!m) return null
  const y = Number(m[1]) + cat.frequencyYears
  return `${y}-${m[2]}`
}

// Compliance status per the form's "+2 months" rule.
function rowStatus(row) {
  const due = monthIndex(row.nextPlannedDue)
  if (due == null) return { key: 'unplanned', label: 'No plan', cls: 'qa-st-unplanned' }
  const deadline = due + 2
  const done = monthIndex(row.actualDoneOn)
  const now = new Date()
  const nowIdx = now.getFullYear() * 12 + now.getMonth()
  if (done != null) {
    return done <= deadline
      ? { key: 'done', label: 'Compliant', cls: 'qa-st-done' }
      : { key: 'late', label: 'Done late', cls: 'qa-st-late' }
  }
  if (nowIdx > deadline) return { key: 'overdue', label: 'Overdue', cls: 'qa-st-overdue' }
  if (nowIdx >= due) return { key: 'due', label: 'Due window', cls: 'qa-st-due' }
  return { key: 'planned', label: 'Planned', cls: 'qa-st-planned' }
}

export default function QaItCompliancePage() {
  const { user, isCorporate } = useAuth()
  const { sites, selectedSiteId, setSelectedSiteId } = useAppContext()

  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [version, setVersion] = useState('')
  const [rows, setRows] = useState([blankRow()])
  const [meta, setMeta] = useState(null)        // { updatedBy, updatedAtUtc }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [snapshot, setSnapshot] = useState('')
  const [openRows, setOpenRows] = useState([true])   // accordion: which cards are expanded

  const [equipment, setEquipment] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])

  const canQuery = Boolean(selectedSiteId && year)
  const dirty = JSON.stringify({ version, rows }) !== snapshot

  // Master data: equipment is per site; the two lists are global.
  const loadMasters = useCallback(() => {
    if (selectedSiteId)
      getEquipmentMaster(selectedSiteId).then(setEquipment).catch(() => setEquipment([]))
    getMasterList('department').then(setDepartments).catch(() => setDepartments([]))
    getMasterList('systemCategory').then(setCategories).catch(() => setCategories([]))
  }, [selectedSiteId])
  useEffect(() => { loadMasters() }, [loadMasters])

  const load = useCallback(async () => {
    if (!canQuery) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const data = await getQaItRegister(selectedSiteId, year)
      const loaded = data.rows.length
        ? data.rows.map((r) => ({
            equipmentName: r.equipmentName, equipmentCode: r.equipmentCode,
            softwareNameVersion: r.softwareNameVersion,
            departmentArea: r.departmentArea, systemCategory: r.systemCategory,
            initialQualificationDate: r.initialQualificationDate,
            lastPeriodicReviewDate: r.lastPeriodicReviewDate,
            nextPlannedDue: r.nextPlannedDue, dueJustification: r.dueJustification || '',
            actualDoneOn: r.actualDoneOn, actualDoneBy: r.actualDoneBy
          }))
        : [blankRow()]
      setRows(loaded)
      // Loaded systems start collapsed for a compact overview; a fresh blank
      // register starts with its single empty card open for immediate entry.
      setOpenRows(loaded.map(() => data.rows.length === 0))
      setVersion(data.version || '')
      setMeta(data.updatedAtUtc ? { updatedBy: data.updatedBy, updatedAtUtc: data.updatedAtUtc } : null)
      setSnapshot(JSON.stringify({ version: data.version || '', rows: loaded }))
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [canQuery, selectedSiteId, year])

  useEffect(() => { load() }, [load])

  function setCell(i, field, value) {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r
      const next = { ...r, [field]: value }
      // Auto-fill: when the inputs of the frequency rule change, refresh the
      // planned month IF the user hasn't manually overridden it (empty or
      // still equal to the previous auto value). Manual confirmation stays
      // with the user — they can change it, but then justify (enforced on save).
      if (field === 'systemCategory' || field === 'lastPeriodicReviewDate' || field === 'initialQualificationDate') {
        const oldAuto = computeAutoDue(r, categories)
        const newAuto = computeAutoDue(next, categories)
        if (newAuto && (!r.nextPlannedDue || r.nextPlannedDue === oldAuto)) {
          next.nextPlannedDue = newAuto
          next.dueJustification = ''
        }
      }
      if (field === 'nextPlannedDue') {
        const auto = computeAutoDue(next, categories)
        if (auto && value === auto) next.dueJustification = ''
      }
      return next
    }))
  }

  // Master-data pick: store a snapshot of Name + ID on the row.
  function pickEquipment(i, code) {
    const eq = equipment.find((e) => e.code === code)
    setRows((rs) => rs.map((r, idx) => (idx === i
      ? { ...r, equipmentCode: eq?.code ?? '', equipmentName: eq?.name ?? '' }
      : r)))
  }
  const addRow = () => {
    setRows((rs) => [...rs, blankRow()])
    setOpenRows((os) => [...os, true])   // new system opens ready for entry
  }
  const removeRow = (i) => {
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((_, idx) => idx !== i)))
    setOpenRows((os) => (rows.length === 1 ? [true] : os.filter((_, idx) => idx !== i)))
  }
  const toggleRow = (i) => setOpenRows((os) => os.map((o, idx) => (idx === i ? !o : o)))
  const setAllOpen = (open) => setOpenRows(rows.map(() => open))

  async function handleSave() {
    // Frequency rule: a planned month differing from the computed one needs a
    // justification. Checked here for a friendly message; the API enforces it too.
    const missing = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (!(r.equipmentName || '').trim()) return false
        const auto = computeAutoDue(r, categories)
        return auto && r.nextPlannedDue !== auto && !(r.dueJustification || '').trim()
      })
      .map(({ i }) => i + 1)
    if (missing.length) {
      setError(`Row(s) ${missing.join(', ')}: the planned month differs from the frequency-based date — justification is mandatory.`)
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await saveQaItRegister({ siteId: selectedSiteId, year: Number(year), version, rows })
      setNotice(`Register saved — ${res.saved} system(s).`)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---- Excel template + import ----
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState(null)

  async function handleDownloadTemplate() {
    setError(null)
    try {
      const blob = await downloadQaItTemplate(selectedSiteId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'QaIt_PeriodicReview_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  async function handleImport(ev) {
    const file = ev.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportSummary(null)
    setError(null)
    setNotice(null)
    try {
      const res = await importQaItRegister(selectedSiteId, file)

      // Merge into the grid: rows whose Equipment ID is already present are
      // skipped (no repeats in the register either); new ones are appended.
      const existingCodes = new Set(
        rows.map((r) => (r.equipmentCode || '').toLowerCase()).filter(Boolean)
      )
      const fresh = res.rows.filter((r) => !existingCodes.has(r.equipmentCode.toLowerCase()))
      const skippedInGrid = res.rows.length - fresh.length
      if (fresh.length) {
        setRows((rs) => {
          const base = rs.length === 1 && !(rs[0].equipmentName || '').trim() ? [] : rs
          return [...base, ...fresh.map((r) => ({ ...r }))]
        })
        setOpenRows((os) => {
          const base = rows.length === 1 && !(rows[0].equipmentName || '').trim() ? [] : os
          return [...base, ...fresh.map(() => false)]
        })
      }
      await loadMasters()   // dropdowns must know the newly added master values

      setImportSummary({
        rows: fresh.length,
        skippedInGrid,
        eq: res.equipmentAddedToMaster,
        dept: res.departmentsAddedToMaster,
        cat: res.categoriesAddedToMaster,
        errors: res.errors || []
      })
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const stats = useMemo(() => {
    const withName = rows.filter((r) => (r.equipmentName || '').trim())
    const st = withName.map(rowStatus)
    return {
      total: withName.length,
      overdue: st.filter((s) => s.key === 'overdue').length,
      due: st.filter((s) => s.key === 'due').length,
      compliant: st.filter((s) => s.key === 'done').length
    }
  }, [rows])

  const siteName = isCorporate
    ? (sites.find((s) => s.id === selectedSiteId)?.name || '')
    : user?.siteName

  const yearOptions = []
  for (let y = thisYear - 3; y <= thisYear + 2; y++) yearOptions.push(y)

  return (
    <div className="qa-page">
      {/* ============ Header: LOCATION / VERSION / YEAR (like the form) ============ */}
      <div className="card qa-topbar">
        <div className="qa-topbar-left">
          <span className="sc-topbar-title">QA-IT Compliance — Periodic Review of Computerized Systems</span>
          <label className="qa-inline">
            <span>Location</span>
            {isCorporate ? (
              <select value={selectedSiteId ?? ''} onChange={(e) => setSelectedSiteId(Number(e.target.value))}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            ) : (
              <span className="site-chip sc-site-chip">{user?.siteName} ({user?.siteCode})</span>
            )}
          </label>
          <label className="qa-inline">
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="qa-inline">
            <span>Version</span>
            <input
              type="text"
              value={version}
              placeholder="e.g. 02"
              style={{ width: 90 }}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
        </div>
        <div className="qa-topbar-right">
          <button type="button" className="secondary" onClick={handleDownloadTemplate}>⬇ Template</button>
          <button type="button" className="secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Importing…' : '⬆ Import Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
          <button type="button" className="secondary" onClick={() => window.print()}>🖨 Print</button>
          <button type="button" disabled={saving || !dirty} onClick={handleSave}>
            {saving ? 'Saving…' : dirty ? 'Save register' : 'Saved ✓'}
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />
      {notice && <div className="success-banner">{notice}</div>}
      {importSummary && (
        <div className={`card md-import-result qa-noprint${importSummary.errors.length ? ' has-errors' : ''}`}>
          <strong>Import complete.</strong>{' '}
          {importSummary.rows} system(s) added to the register below
          {importSummary.skippedInGrid > 0 && <> · {importSummary.skippedInGrid} skipped (Equipment ID already in the register)</>}
          {' '}· Master data updated: {importSummary.eq} equipment, {importSummary.dept} department(s), {importSummary.cat} categor{importSummary.cat === 1 ? 'y' : 'ies'} added (existing ones matched, never repeated).
          {importSummary.cat > 0 && <> New categories have no review frequency yet — set it on the Master Data page to enable auto-fill.</>}
          {' '}<strong>Review the rows and click Save register.</strong>
          {importSummary.errors.length > 0 && (
            <ul className="md-import-errors">
              {importSummary.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button type="button" className="qa-linkbtn" onClick={() => setImportSummary(null)}>Dismiss</button>
        </div>
      )}

      {/* ============ Compliance summary ============ */}
      {stats.total > 0 && (
        <div className="qa-stats">
          <span className="qa-stat">Systems: <strong>{stats.total}</strong></span>
          <span className="qa-stat qa-stat-green">Compliant: <strong>{stats.compliant}</strong></span>
          <span className="qa-stat qa-stat-amber">In due window: <strong>{stats.due}</strong></span>
          <span className="qa-stat qa-stat-red">Overdue: <strong>{stats.overdue}</strong></span>
          {meta && (
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
              Last saved by {meta.updatedBy} on {new Date(meta.updatedAtUtc).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* ============ The register ============ */}
      <div className="card qa-register">
        {/* Print-only heading replicating the paper form header */}
        <div className="qa-print-head">
          <span>LOCATION: <strong>{siteName}</strong></span>
          <span>VERSION: <strong>{version || '____'}</strong></span>
          <span>YEAR: <strong>{year}</strong></span>
        </div>

        {loading ? (
          <Spinner label="Loading register…" />
        ) : !canQuery ? (
          <EmptyState>Pick a location and year above.</EmptyState>
        ) : (
          <>
            {/* ---------- Screen view: top-to-bottom collapsible cards ---------- */}
            <div className="qa-acc qa-noprint">
              <div className="qa-acc-toolbar">
                <button type="button" className="qa-linkbtn" onClick={() => setAllOpen(true)}>Expand all</button>
                <span className="qa-linksep">·</span>
                <button type="button" className="qa-linkbtn" onClick={() => setAllOpen(false)}>Collapse all</button>
              </div>

              {rows.map((r, i) => {
                const st = rowStatus(r)
                const auto = computeAutoDue(r, categories)
                const overridden = auto && r.nextPlannedDue && r.nextPlannedDue !== auto
                const open = openRows[i] ?? false
                return (
                  <div key={i} className={`qa-acc-card qa-b-${st.key}${open ? ' open' : ''}`}>
                    {/* ---- Collapsed header: the at-a-glance summary ---- */}
                    <button type="button" className="qa-acc-head" onClick={() => toggleRow(i)}>
                      <span className={`qa-acc-chev${open ? ' open' : ''}`}>▸</span>
                      <span className="qa-acc-sr">{i + 1}</span>
                      <span className="qa-acc-title">
                        {r.equipmentName || <em className="muted">New system — pick equipment</em>}
                        {r.equipmentCode && <span className="qa-acc-code">{r.equipmentCode}</span>}
                      </span>
                      <span className="qa-acc-meta">
                        {[r.departmentArea, r.systemCategory].filter(Boolean).join(' · ') || '—'}
                      </span>
                      <span className="qa-acc-due">
                        {r.nextPlannedDue ? <>Due {fmtMonth(r.nextPlannedDue)}</> : 'No plan'}
                      </span>
                      <span className={`qa-status ${st.cls}`}>{st.label}</span>
                    </button>

                    {/* ---- Expanded body: fields flow top-to-bottom, wrapping ---- */}
                    {open && (
                      <div className="qa-acc-body">
                        <div className="qa-form-grid">
                          <label className="qa-f">
                            <span>Equipment/Instrument ID *</span>
                            <select value={r.equipmentCode} onChange={(e) => pickEquipment(i, e.target.value)}>
                              <option value="">— select —</option>
                              {equipment.map((eq) => (
                                <option key={eq.id} value={eq.code}>{eq.code} — {eq.name}</option>
                              ))}
                              {r.equipmentCode && !equipment.some((eq) => eq.code === r.equipmentCode) && (
                                <option value={r.equipmentCode}>{r.equipmentCode} — {r.equipmentName} (retired)</option>
                              )}
                            </select>
                          </label>
                          <label className="qa-f">
                            <span>Name of the Equipment/Instrument</span>
                            <input value={r.equipmentName} readOnly placeholder="auto from ID" className="qa-ro" tabIndex={-1} />
                          </label>
                          <label className="qa-f">
                            <span>Software Name &amp; Version</span>
                            <input value={r.softwareNameVersion} onChange={(e) => setCell(i, 'softwareNameVersion', e.target.value)} placeholder="e.g. Empower 3 FR5" />
                          </label>
                          <label className="qa-f">
                            <span>Department / Area</span>
                            <select value={r.departmentArea} onChange={(e) => setCell(i, 'departmentArea', e.target.value)}>
                              <option value="">— select —</option>
                              {departments.map((d) => <option key={d.id} value={d.value}>{d.value}</option>)}
                              {r.departmentArea && !departments.some((d) => d.value === r.departmentArea) && (
                                <option value={r.departmentArea}>{r.departmentArea} (retired)</option>
                              )}
                            </select>
                          </label>
                          <label className="qa-f">
                            <span>System Category</span>
                            <select value={r.systemCategory} onChange={(e) => setCell(i, 'systemCategory', e.target.value)}>
                              <option value="">— select —</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.value}>
                                  {c.value}{c.frequencyYears ? ` (every ${c.frequencyYears} yr)` : ''}
                                </option>
                              ))}
                              {r.systemCategory && !categories.some((c) => c.value === r.systemCategory) && (
                                <option value={r.systemCategory}>{r.systemCategory} (retired)</option>
                              )}
                            </select>
                          </label>
                          <label className="qa-f">
                            <span>Initial Qualification Date</span>
                            <input type="date" value={r.initialQualificationDate} onChange={(e) => setCell(i, 'initialQualificationDate', e.target.value)} />
                          </label>
                          <label className="qa-f">
                            <span>Last Periodic Review Date</span>
                            <input type="date" value={r.lastPeriodicReviewDate} onChange={(e) => setCell(i, 'lastPeriodicReviewDate', e.target.value)} />
                          </label>
                          <label className="qa-f">
                            <span>
                              Next Planned Review Due
                              {auto && !overridden && r.nextPlannedDue && <span className="qa-chip-auto">auto</span>}
                            </span>
                            <span className="qa-due-cell">
                              <input type="month" value={r.nextPlannedDue} onChange={(e) => setCell(i, 'nextPlannedDue', e.target.value)} />
                              {overridden && (
                                <button type="button" className="qa-due-reset" title={`Reset to frequency-based ${fmtMonth(auto)}`}
                                  onClick={() => setCell(i, 'nextPlannedDue', auto)}>↺</button>
                              )}
                            </span>
                            {overridden && (
                              <>
                                <span className="qa-chip-manual">manual (auto: {fmtMonth(auto)})</span>
                                <input
                                  type="text"
                                  className={`qa-justif${(r.dueJustification || '').trim() ? '' : ' qa-justif-missing'}`}
                                  value={r.dueJustification}
                                  placeholder="Justification (mandatory)"
                                  onChange={(e) => setCell(i, 'dueJustification', e.target.value)}
                                />
                              </>
                            )}
                          </label>
                          <label className="qa-f">
                            <span>Actual Review Done On <small className="muted">(window: planned +2 months)</small></span>
                            <input type="month" value={r.actualDoneOn} onChange={(e) => setCell(i, 'actualDoneOn', e.target.value)} />
                          </label>
                          <label className="qa-f">
                            <span>Done By</span>
                            <input value={r.actualDoneBy} onChange={(e) => setCell(i, 'actualDoneBy', e.target.value)} placeholder="Name / initials" />
                          </label>
                        </div>
                        <div className="qa-acc-actions">
                          <button type="button" className="secondary" onClick={() => removeRow(i)}>✕ Remove system</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ---------- Print view: the classic paper-form table ---------- */}
            <table className="qa-table qa-print-table">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Name of the Equipment/Instrument</th>
                  <th>Equipment/Instrument ID</th>
                  <th>Software Name &amp; Version</th>
                  <th>Department /Area</th>
                  <th>System Category</th>
                  <th>Initial Qualification Date</th>
                  <th>Last Periodic Review Date</th>
                  <th>Next Planned Periodic Review Due On</th>
                  <th>Actual Periodic Review Done On / By</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => (r.equipmentName || '').trim()).map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{r.equipmentName}</td>
                    <td>{r.equipmentCode}</td>
                    <td>{r.softwareNameVersion}</td>
                    <td>{r.departmentArea}</td>
                    <td>{r.systemCategory}</td>
                    <td>{r.initialQualificationDate}</td>
                    <td>{r.lastPeriodicReviewDate}</td>
                    <td>{fmtMonth(r.nextPlannedDue)}</td>
                    <td>{fmtMonth(r.actualDoneOn)}{r.actualDoneBy ? ` / ${r.actualDoneBy}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="row qa-noprint" style={{ marginTop: 10, marginBottom: 0 }}>
          <button type="button" className="secondary" onClick={addRow}>+ Add system</button>
          <button type="button" disabled={saving || !dirty} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save register'}
          </button>
          <span className="muted">
            Planned month auto-fills from the category frequency (base date + N years); changing it
            requires a justification. Status is automatic: compliant when done within the planned month +2 months.
            {equipment.length === 0 && ' No equipment in this location\u2019s master yet — corporate adds it on the Admin page.'}
          </span>
        </div>
      </div>
    </div>
  )
}
