import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import {
  getScorecardSchema, getScorecardRows, saveScorecardRows,
  importScorecard, downloadScorecardTemplate
} from '../client'
import { formatPeriodLabel } from '../../constants'
import SubmissionBar from '../components/SubmissionBar'
import { Spinner, EmptyState } from '../components/Feedback'
import { computeRow } from '../scorecardSchema'

// ============================================================================
//  Monthly Site Scorecard — single-screen grid.
//  All 20 metrics are on screen at once (no page scrolling):
//   - single-row metrics are edited directly on their card
//   - multi-row metrics open a popup table editor
//   - one "Save all" pushes every changed sheet in one go
//   - Excel import lives in a popup behind one button
// ============================================================================

const CATEGORY_COLORS = {
  'Quality & Compliance': '#2563eb',
  'Laboratory Performance': '#0d9488',
  'Event & Investigation': '#d97706',
  'Market & Product Quality': '#7c3aed',
  'Governance & Sustainability': '#059669',
  'Qualification/Validation': '#db2777',
  'Manpower': '#475569'
}

const blankCells = (inputCols) => {
  const c = {}
  for (const col of inputCols) c[col.key] = ''
  return c
}
const inputColsOf = (m) => m.columns.filter((c) => c.type !== 'computed')
const computedColsOf = (m) => m.columns.filter((c) => c.type === 'computed')

export default function ScorecardEntryPage() {
  const { user, isCorporate } = useAuth()
  const {
    sites, reportPeriods, selectedSiteId, setSelectedSiteId,
    selectedPeriodId, setSelectedPeriodId, isPeriodLocked
  } = useAppContext()

  const [schema, setSchema] = useState([])
  const [dataByKey, setDataByKey] = useState({})       // metricKey -> editable rows
  const snapshots = useRef({})                          // metricKey -> JSON snapshot at load/save
  const [loading, setLoading] = useState(true)
  const [savingAll, setSavingAll] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [editorKey, setEditorKey] = useState(null)      // multi-row popup editor
  const [showImport, setShowImport] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState('NotStarted')

  const canQuery = Boolean(selectedSiteId && selectedPeriodId)

  // ---- Load schema + ALL metric rows in one shot ----
  const loadAll = useCallback(async () => {
    if (!canQuery) return
    setLoading(true)
    setError(null)
    try {
      const sch = schema.length ? schema : await getScorecardSchema()
      if (!schema.length) setSchema(sch)
      const results = await Promise.all(
        sch.map((m) =>
          getScorecardRows(selectedSiteId, selectedPeriodId, m.key)
            .then((rows) => [m.key, rows])
            .catch(() => [m.key, []])
        )
      )
      const next = {}
      for (const [key, rows] of results) {
        const metric = sch.find((m) => m.key === key)
        const inputCols = inputColsOf(metric)
        const editable = rows.map((r) => {
          const cells = {}
          for (const c of inputCols) cells[c.key] = r.cells?.[c.key] ?? ''
          return cells
        })
        next[key] = editable.length ? editable : [blankCells(inputCols)]
        snapshots.current[key] = JSON.stringify(next[key])
      }
      setDataByKey(next)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuery, selectedSiteId, selectedPeriodId, schema.length])

  useEffect(() => { setNotice(null); loadAll() }, [loadAll])

  const ordered = useMemo(() => [...schema].sort((a, b) => a.order - b.order), [schema])

  const isDirty = useCallback(
    (key) => JSON.stringify(dataByKey[key] ?? []) !== (snapshots.current[key] ?? ''),
    [dataByKey]
  )
  const dirtyKeys = ordered.filter((m) => isDirty(m.key)).map((m) => m.key)

  const hasData = useCallback((m) => {
    const rows = dataByKey[m.key] ?? []
    const inputCols = inputColsOf(m)
    return rows.some((r) => inputCols.some((c) => String(r[c.key] ?? '').trim() !== ''))
  }, [dataByKey])
  const filledCount = ordered.filter(hasData).length

  // ---- Cell edits (single-row cards edit row 0; the popup edits any row) ----
  function updateCell(metricKey, rowIdx, colKey, value) {
    setDataByKey((d) => ({
      ...d,
      [metricKey]: d[metricKey].map((r, i) => (i === rowIdx ? { ...r, [colKey]: value } : r))
    }))
  }
  function addRow(metric) {
    setDataByKey((d) => ({ ...d, [metric.key]: [...d[metric.key], blankCells(inputColsOf(metric))] }))
  }
  function removeRow(metric, rowIdx) {
    setDataByKey((d) => {
      const rows = d[metric.key]
      const next = rows.length === 1 ? [blankCells(inputColsOf(metric))] : rows.filter((_, i) => i !== rowIdx)
      return { ...d, [metric.key]: next }
    })
  }

  // ---- Save one metric ----
  const saveMetric = useCallback(async (metric) => {
    const rows = dataByKey[metric.key] ?? []
    const inputCols = inputColsOf(metric)
    const nonEmpty = rows.filter((r) => inputCols.some((c) => String(r[c.key] ?? '').trim() !== ''))
    await saveScorecardRows({
      siteId: selectedSiteId,
      reportPeriodId: selectedPeriodId,
      metricKey: metric.key,
      rows: nonEmpty.map((r, i) => ({ rowIndex: i, cells: r }))
    })
    snapshots.current[metric.key] = JSON.stringify(rows)
  }, [dataByKey, selectedSiteId, selectedPeriodId])

  // ---- Save all changed sheets in one click ----
  async function handleSaveAll() {
    if (!dirtyKeys.length) return
    setSavingAll(true)
    setError(null)
    setNotice(null)
    const failed = []
    for (const key of dirtyKeys) {
      const metric = ordered.find((m) => m.key === key)
      try {
        await saveMetric(metric)
      } catch (err) {
        failed.push(`${metric.title}: ${err?.response?.data?.error || err.message}`)
      }
    }
    setSavingAll(false)
    setDataByKey((d) => ({ ...d })) // re-render dirty state
    if (failed.length) setError(`Some sheets failed to save — ${failed.join(' · ')}`)
    else setNotice(`Saved ${dirtyKeys.length} sheet(s).`)
  }

  const selectedPeriod = reportPeriods.find((p) => p.id === selectedPeriodId)
  const editorMetric = ordered.find((m) => m.key === editorKey) || null
  const frozen = submissionStatus === 'Submitted' || submissionStatus === 'Approved'
  const readOnly = isPeriodLocked || frozen

  return (
    <div className="sc-page">
      {/* ================= Top bar: everything in one row ================= */}
      <div className="sc-topbar card">
        <div className="sc-topbar-left">
          <span className="sc-topbar-title">Monthly Site Scorecard</span>
          {isCorporate ? (
            <select value={selectedSiteId ?? ''} onChange={(e) => setSelectedSiteId(Number(e.target.value))}>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          ) : (
            <span className="site-chip sc-site-chip">{user?.siteName} ({user?.siteCode})</span>
          )}
          <select value={selectedPeriodId ?? ''} onChange={(e) => setSelectedPeriodId(Number(e.target.value))}>
            {reportPeriods.map((p) => (
              <option key={p.id} value={p.id}>{formatPeriodLabel(p)}{p.status === 'Locked' ? ' 🔒' : ''}</option>
            ))}
          </select>
        </div>

        <div className="sc-topbar-right">
          <span className="sc-progress-chip" title="Sheets with at least one value">
            <span className="sc-progress-dot" style={{ background: filledCount === ordered.length && ordered.length ? '#16a34a' : '#f59e0b' }} />
            {filledCount} / {ordered.length || 20} filled
          </span>
          <button className="secondary" type="button" onClick={() => setShowImport(true)}>
            ⇪ Excel
          </button>
          <button
            type="button"
            disabled={readOnly || savingAll || dirtyKeys.length === 0}
            onClick={handleSaveAll}
            title={dirtyKeys.length ? `Sheets with changes: ${dirtyKeys.length}` : 'No unsaved changes'}
          >
            {savingAll ? 'Saving…' : dirtyKeys.length ? `Save all (${dirtyKeys.length})` : 'All saved ✓'}
          </button>
        </div>
      </div>

      {!isCorporate && (
        <SubmissionBar
          siteId={selectedSiteId}
          reportPeriodId={selectedPeriodId}
          period={selectedPeriod}
          filledCount={filledCount}
          totalCount={ordered.length}
          isPeriodLocked={isPeriodLocked}
          onStatusChange={setSubmissionStatus}
        />
      )}

      {(error || notice || isPeriodLocked) && (
        <div className="sc-msgbar">
          {isPeriodLocked && <span className="status-badge status-Locked">Period locked — read-only</span>}
          {error && <span className="sc-msg-error">{error}</span>}
          {notice && <span className="sc-msg-ok">{notice}</span>}
        </div>
      )}

      {/* ================= The grid: all 20 sheets, one screen ================= */}
      {loading ? (
        <div className="sc-loading"><Spinner label="Loading all scorecard sheets…" /></div>
      ) : !canQuery ? (
        <EmptyState>Pick a site and report period above.</EmptyState>
      ) : (
        <div className="sc-grid">
          {ordered.map((m) => (
            <MetricCard
              key={m.key}
              metric={m}
              rows={dataByKey[m.key] ?? []}
              dirty={isDirty(m.key)}
              filled={hasData(m)}
              locked={readOnly}
              onCell={(rowIdx, colKey, v) => updateCell(m.key, rowIdx, colKey, v)}
              onOpenEditor={() => setEditorKey(m.key)}
            />
          ))}
        </div>
      )}

      {/* ================= Popup: multi-row table editor ================= */}
      {editorMetric && (
        <RowsEditorModal
          metric={editorMetric}
          rows={dataByKey[editorMetric.key] ?? []}
          locked={readOnly}
          dirty={isDirty(editorMetric.key)}
          onCell={(rowIdx, colKey, v) => updateCell(editorMetric.key, rowIdx, colKey, v)}
          onAddRow={() => addRow(editorMetric)}
          onRemoveRow={(i) => removeRow(editorMetric, i)}
          onSave={async () => {
            await saveMetric(editorMetric)
            setDataByKey((d) => ({ ...d }))
            setNotice(`Saved ${editorMetric.title}.`)
          }}
          onClose={() => setEditorKey(null)}
        />
      )}

      {/* ================= Popup: Excel import ================= */}
      {showImport && (
        <ImportModal
          siteId={selectedSiteId}
          reportPeriodId={selectedPeriodId}
          locked={readOnly}
          onImported={loadAll}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

/* ============================ One metric card ============================ */
function MetricCard({ metric, rows, dirty, filled, locked, onCell, onOpenEditor }) {
  const color = CATEGORY_COLORS[metric.category] || '#64748b'
  const inputCols = inputColsOf(metric)
  const computedCols = computedColsOf(metric)
  const row0 = rows[0] ?? {}
  const computed = computeRow(metric, row0)
  const rowCount = rows.filter((r) => inputCols.some((c) => String(r[c.key] ?? '').trim() !== '')).length

  return (
    <div className={`sc-card${dirty ? ' dirty' : ''}${filled ? ' filled' : ''}`} style={{ '--cat': color }}>
      <div className="sc-card-head" title={`${metric.title} — ${metric.category}`}>
        <span className="sc-card-title">{metric.title}</span>
        {dirty && <span className="sc-dot-dirty" title="Unsaved changes" />}
        {!dirty && filled && <span className="sc-dot-ok" title="Has data" />}
      </div>

      {metric.multiRow ? (
        /* ---- Multi-row sheets: summary + popup editor ---- */
        <button type="button" className="sc-card-rows" onClick={onOpenEditor}>
          <span className="sc-rows-count">{rowCount}</span>
          <span className="sc-rows-label">row{rowCount === 1 ? '' : 's'} · {inputCols.length} cols</span>
          <span className="sc-rows-open">{locked ? 'View table →' : 'Edit table →'}</span>
        </button>
      ) : (
        /* ---- Single-row sheets: edit right here ---- */
        <div className="sc-fields">
          {inputCols.map((c) => (
            <label key={c.key} className="sc-field" title={c.label}>
              <span className="sc-field-label">{c.label}</span>
              <input
                type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                step="any"
                value={row0[c.key] ?? ''}
                disabled={locked}
                onChange={(e) => onCell(0, c.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      )}

      {computedCols.length > 0 && (
        <div className="sc-computed">
          {computedCols.map((c) => {
            const v = metric.multiRow ? null : computed[c.key]
            return (
              <span key={c.key} className="sc-chip" title={`${c.label} (auto: ${c.formula})`}>
                {shortLabel(c.label)}: <strong>{v === null || v === undefined || Number.isNaN(v) ? '–' : v}</strong>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function shortLabel(label) {
  return label.length > 18 ? label.slice(0, 17) + '…' : label
}

/* ==================== Popup table editor (multi-row) ==================== */
function RowsEditorModal({ metric, rows, locked, dirty, onCell, onAddRow, onRemoveRow, onSave, onClose }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputCols = inputColsOf(metric)
  const computedCols = computedColsOf(metric)

  async function handleSave(close) {
    setSaving(true)
    setError(null)
    try {
      await onSave()
      if (close) onClose()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (dirty && !window.confirm('Close without saving? Your edits stay on the card until you Save all, but nothing has been sent yet.')) return
    onClose()
  }

  function onKeyDown(e, rowIdx) {
    if (e.key === 'Enter' && rowIdx === rows.length - 1) { e.preventDefault(); onAddRow() }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card sc-editor" onClick={(e) => e.stopPropagation()}>
        <div className="sc-editor-head">
          <div>
            <h3 style={{ margin: 0 }}>{metric.title}</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {metric.category} · press Enter in the last row to add another
            </span>
          </div>
          <button className="secondary" type="button" onClick={handleClose}>✕</button>
        </div>

        <div className="sc-editor-body scorecard-table-wrap">
          <table className="scorecard-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                {inputCols.map((c) => <th key={c.key}>{c.label}{c.type === 'date' ? ' (date)' : ''}</th>)}
                {computedCols.map((c) => (
                  <th key={c.key} className="computed-col" title={`Auto: ${c.formula}`}>{c.label} <span className="calc-tag">auto</span></th>
                ))}
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const computed = computeRow(metric, row)
                return (
                  <tr key={rowIdx}>
                    <td className="muted">{rowIdx + 1}</td>
                    {inputCols.map((c) => (
                      <td key={c.key}>
                        <input
                          type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                          step="any"
                          value={row[c.key] ?? ''}
                          disabled={locked}
                          onChange={(e) => onCell(rowIdx, c.key, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, rowIdx)}
                          style={{ width: '100%' }}
                        />
                      </td>
                    ))}
                    {computedCols.map((c) => {
                      const v = computed[c.key]
                      return <td key={c.key} className="computed-cell">{v === null || v === undefined ? '–' : v}</td>
                    })}
                    <td>
                      <button className="secondary" disabled={locked} onClick={() => onRemoveRow(rowIdx)} title="Remove row" type="button">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="sc-editor-foot">
          <button className="secondary" disabled={locked} onClick={onAddRow} type="button">+ Add row</button>
          <div className="row" style={{ marginBottom: 0, gap: 8 }}>
            <button className="secondary" onClick={handleClose} type="button">Close</button>
            <button disabled={locked || saving} onClick={() => handleSave(true)} type="button">
              {saving ? 'Saving…' : 'Save & close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================= Popup: Excel import ========================= */
function ImportModal({ siteId, reportPeriodId, locked, onImported, onClose }) {
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function handleTemplate() {
    setDownloading(true)
    setError(null)
    try {
      const blob = await downloadScorecardTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Monthly_Site_Scorecard_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setDownloading(false)
    }
  }

  async function handleImport() {
    if (!file) { setError('Choose a .xlsx file first.'); return }
    if (!file.name.toLowerCase().endsWith('.xlsx')) { setError('Only .xlsx files are supported.'); return }
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const data = await importScorecard(siteId, reportPeriodId, file)
      setResult(data)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      await onImported()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setImporting(false)
    }
  }

  const matched = result?.sheets?.filter((s) => s.matched).length ?? 0
  const totalRows = result?.sheets?.reduce((n, s) => n + (s.rowsAccepted || 0), 0) ?? 0

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Fill from Excel</h3>
        <p className="muted">
          Download the blank template (one tab per metric; grey columns are auto-calculated — leave
          them blank), fill it offline, then upload. Existing data for a matched metric is replaced.
        </p>
        <div className="row">
          <button className="secondary" onClick={handleTemplate} disabled={downloading} type="button">
            {downloading ? 'Preparing…' : '⬇ Download blank template'}
          </button>
        </div>
        <div className="row" style={{ marginBottom: 0 }}>
          <input ref={inputRef} type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(null) }} />
          <button onClick={handleImport} disabled={locked || importing || !file} type="button">
            {importing ? 'Importing…' : 'Import workbook'}
          </button>
        </div>

        {locked && <p className="warning-box" style={{ marginTop: 10 }}>This period is locked — import is disabled.</p>}
        {error && <p className="error-text">{error}</p>}
        {importing && <Spinner label="Parsing and saving the workbook…" />}
        {result && (
          <div className="success-banner">
            Imported {matched} sheet(s) · {totalRows} rows. The grid has been refreshed.
            {result.warnings?.length > 0 && (
              <ul style={{ margin: '6px 0 0 18px' }}>
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="row" style={{ marginTop: 12, marginBottom: 0, justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={onClose} type="button">Close</button>
        </div>
      </div>
    </div>
  )
}
