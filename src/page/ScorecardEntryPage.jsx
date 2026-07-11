import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  getScorecardSchema, getScorecardRows, saveScorecardRows, getScorecardStatus,
  importScorecard, downloadScorecardTemplate
} from '../client'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'
import { computeRow } from '../scorecardSchema'

// Dynamic data-entry for the 20-sheet Monthly Site Scorecard, with the Excel
// import built in (no separate page). Designed for fast fill:
//  - "Save & next" walks through every sheet without touching the sidebar
//  - Enter in the last row adds a new row
//  - fill progress + per-sheet counts in the sidebar
//  - unsaved changes are guarded when switching sheets
export default function ScorecardEntryPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()

  const [schema, setSchema] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [activeKey, setActiveKey] = useState(null)
  const [rows, setRows] = useState([])
  const [loadingSchema, setLoadingSchema] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedNote, setSavedNote] = useState(null)

  // Snapshot of the rows as loaded, to detect unsaved edits.
  const loadedSnapshot = useRef('')
  const isDirty = JSON.stringify(rows) !== loadedSnapshot.current

  const canQuery = Boolean(selectedSiteId && selectedPeriodId)
  const activeMetric = useMemo(
    () => schema.find((m) => m.key === activeKey) || null,
    [schema, activeKey]
  )

  // Ordered flat list of metric keys — powers "Save & next".
  const orderedKeys = useMemo(
    () => [...schema].sort((a, b) => a.order - b.order).map((m) => m.key),
    [schema]
  )

  // ---- Load schema once ----
  useEffect(() => {
    let alive = true
    getScorecardSchema()
      .then((data) => {
        if (!alive) return
        setSchema(data)
        if (data.length && !activeKey) setActiveKey(data[0].key)
      })
      .catch((err) => setError(err?.response?.data?.error || err.message))
      .finally(() => alive && setLoadingSchema(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Group metrics by category for the sidebar ----
  const grouped = useMemo(() => {
    const map = new Map()
    for (const m of [...schema].sort((a, b) => a.order - b.order)) {
      if (!map.has(m.category)) map.set(m.category, [])
      map.get(m.category).push(m)
    }
    return [...map.entries()]
  }, [schema])

  const filledCount = useMemo(
    () => schema.filter((m) => (statusCounts[m.key] || 0) > 0).length,
    [schema, statusCounts]
  )

  const refreshStatus = useCallback(async () => {
    if (!canQuery) return
    try {
      const counts = await getScorecardStatus(selectedSiteId, selectedPeriodId)
      setStatusCounts(counts || {})
    } catch {
      /* status is best-effort */
    }
  }, [canQuery, selectedSiteId, selectedPeriodId])

  // ---- Load rows for the active metric ----
  const loadRows = useCallback(async () => {
    if (!canQuery || !activeKey) return
    setLoadingRows(true)
    setError(null)
    setSavedNote(null)
    try {
      const data = await getScorecardRows(selectedSiteId, selectedPeriodId, activeKey)
      const metric = schema.find((m) => m.key === activeKey)
      const inputCols = metric ? metric.columns.filter((c) => c.type !== 'computed') : []
      const editable = data.map((r) => {
        const cells = {}
        for (const c of inputCols) cells[c.key] = r.cells?.[c.key] ?? ''
        return cells
      })
      const next = editable.length ? editable : [blankCells(inputCols)]
      setRows(next)
      loadedSnapshot.current = JSON.stringify(next)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoadingRows(false)
    }
  }, [canQuery, activeKey, selectedSiteId, selectedPeriodId, schema])

  useEffect(() => {
    loadRows()
    refreshStatus()
  }, [loadRows, refreshStatus])

  function blankCells(inputCols) {
    const c = {}
    for (const col of inputCols) c[col.key] = ''
    return c
  }

  const inputCols = activeMetric ? activeMetric.columns.filter((c) => c.type !== 'computed') : []
  const computedCols = activeMetric ? activeMetric.columns.filter((c) => c.type === 'computed') : []

  function updateCell(rowIdx, key, value) {
    setRows((rs) => rs.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, blankCells(inputCols)])
  }

  function removeRow(rowIdx) {
    setRows((rs) => (rs.length === 1 ? [blankCells(inputCols)] : rs.filter((_, i) => i !== rowIdx)))
  }

  // Switching sheets warns if there are unsaved edits (one click saved is one
  // click, but silently losing typed data is far worse).
  function switchMetric(key) {
    if (key === activeKey) return
    if (isDirty && !window.confirm('You have unsaved changes on this sheet. Discard them?')) return
    setActiveKey(key)
  }

  // Enter in the last row of a multi-row sheet adds the next row — keeps hands
  // on the keyboard for long lists.
  function handleCellKeyDown(e, rowIdx) {
    if (e.key === 'Enter' && activeMetric?.multiRow && rowIdx === rows.length - 1) {
      e.preventDefault()
      addRow()
    }
  }

  async function saveRows() {
    const nonEmpty = rows.filter((r) => inputCols.some((c) => String(r[c.key] ?? '').trim() !== ''))
    const payload = {
      siteId: selectedSiteId,
      reportPeriodId: selectedPeriodId,
      metricKey: activeKey,
      rows: nonEmpty.map((r, i) => ({ rowIndex: i, cells: r }))
    }
    const res = await saveScorecardRows(payload)
    return res
  }

  async function handleSave(goNext = false) {
    setSaving(true)
    setError(null)
    setSavedNote(null)
    try {
      const res = await saveRows()
      loadedSnapshot.current = JSON.stringify(rows) // saved -> not dirty
      await refreshStatus()
      if (goNext) {
        const idx = orderedKeys.indexOf(activeKey)
        const nextKey = orderedKeys[idx + 1]
        if (nextKey) {
          setActiveKey(nextKey)
          setSavedNote(null)
        } else {
          setSavedNote('That was the last sheet — the whole scorecard has been walked through. 🎉')
          await loadRows()
        }
      } else {
        setSavedNote(`Saved ${res.rowsSaved} row(s) for ${activeMetric?.title}.`)
        await loadRows()
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const isLastSheet = activeKey === orderedKeys[orderedKeys.length - 1]

  if (loadingSchema) return <Spinner label="Loading scorecard definitions…" />

  return (
    <>
      <SiteAndPeriodPicker helpText="Monthly Site Scorecard — fill each QC/QA metric for this site and month. Grey columns are auto-calculated." />

      {/* Excel import lives right here — no separate page, no extra clicks. */}
      <ImportStrip
        disabled={!canQuery || isPeriodLocked}
        siteId={selectedSiteId}
        reportPeriodId={selectedPeriodId}
        onImported={async () => { await refreshStatus(); await loadRows() }}
      />

      <ErrorBanner message={error} />

      {isPeriodLocked && (
        <p className="warning-box">This report period is locked — editing is disabled.</p>
      )}
      {savedNote && (
        <div className="success-banner">{savedNote}</div>
      )}

      <div className="scorecard-layout">
        {/* ---- Metric sidebar with fill progress ---- */}
        <aside className="scorecard-nav card">
          <div className="scorecard-progress">
            <div className="scorecard-progress-label">
              <span>Sheets filled</span>
              <strong>{filledCount} / {schema.length}</strong>
            </div>
            <div className="scorecard-progress-bar">
              <div
                className="scorecard-progress-fill"
                style={{ width: schema.length ? `${(filledCount / schema.length) * 100}%` : 0 }}
              />
            </div>
          </div>

          {grouped.map(([category, metrics]) => (
            <div key={category} className="scorecard-nav-group">
              <div className="scorecard-nav-cat">{category}</div>
              {metrics.map((m) => {
                const count = statusCounts[m.key] || 0
                return (
                  <button
                    key={m.key}
                    className={`scorecard-nav-item${m.key === activeKey ? ' active' : ''}${count > 0 ? ' filled' : ''}`}
                    onClick={() => switchMetric(m.key)}
                    type="button"
                  >
                    <span>{m.title}</span>
                    {count > 0 && <span className="scorecard-badge">{count}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* ---- Active metric form ---- */}
        <section className="scorecard-main card">
          {!activeMetric ? (
            <EmptyState>Pick a metric.</EmptyState>
          ) : !canQuery ? (
            <EmptyState>Pick a site and report period above.</EmptyState>
          ) : (
            <>
              <div className="scorecard-main-head">
                <div>
                  <h2 style={{ margin: 0 }}>{activeMetric.title}</h2>
                  <p className="muted" style={{ margin: '2px 0 0' }}>
                    {activeMetric.category}
                    {activeMetric.multiRow ? ' · multiple rows allowed · press Enter in the last row to add another' : ' · single row'}
                  </p>
                </div>
                {isDirty && <span className="dirty-chip">Unsaved changes</span>}
              </div>

              {loadingRows ? (
                <Spinner label="Loading rows…" />
              ) : (
                <div className="scorecard-table-wrap">
                  <table className="scorecard-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        {inputCols.map((c) => (
                          <th key={c.key} title={c.label}>{c.label}{c.type === 'date' ? ' (date)' : ''}</th>
                        ))}
                        {computedCols.map((c) => (
                          <th key={c.key} className="computed-col" title={`Auto: ${c.formula}`}>
                            {c.label} <span className="calc-tag">auto</span>
                          </th>
                        ))}
                        <th style={{ width: 44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIdx) => {
                        const computed = computeRow(activeMetric, row)
                        return (
                          <tr key={rowIdx}>
                            <td className="muted">{rowIdx + 1}</td>
                            {inputCols.map((c) => (
                              <td key={c.key}>
                                <input
                                  type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                                  step="any"
                                  value={row[c.key] ?? ''}
                                  disabled={isPeriodLocked}
                                  onChange={(e) => updateCell(rowIdx, c.key, e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, rowIdx)}
                                  style={{ width: '100%' }}
                                />
                              </td>
                            ))}
                            {computedCols.map((c) => {
                              const v = computed[c.key]
                              return (
                                <td key={c.key} className="computed-cell">
                                  {v === null || v === undefined ? '–' : v}
                                </td>
                              )
                            })}
                            <td>
                              {activeMetric.multiRow && (
                                <button
                                  className="secondary"
                                  disabled={isPeriodLocked}
                                  onClick={() => removeRow(rowIdx)}
                                  title="Remove row"
                                  type="button"
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="row scorecard-actions" style={{ marginTop: 12 }}>
                {activeMetric.multiRow && (
                  <button className="secondary" disabled={isPeriodLocked} onClick={addRow} type="button">
                    + Add row
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={isPeriodLocked || saving}
                  onClick={() => handleSave(false)}
                  type="button"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  disabled={isPeriodLocked || saving}
                  onClick={() => handleSave(true)}
                  type="button"
                  title="Save this sheet and jump to the next one"
                >
                  {saving ? 'Saving…' : isLastSheet ? 'Save (last sheet)' : 'Save & next →'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}

/* ---- Compact Excel import, collapsed by default ---- */
function ImportStrip({ disabled, siteId, reportPeriodId, onImported }) {
  const [open, setOpen] = useState(false)
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

  return (
    <div className={`card import-strip${open ? ' open' : ''}`}>
      <button
        type="button"
        className="import-strip-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="import-strip-title">
          ⇪ Prefer Excel? Fill the whole scorecard from a workbook
        </span>
        <span className="import-strip-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="import-strip-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Download the blank template (one tab per metric — grey columns are auto-calculated,
            leave them blank), fill it offline, then upload. Sheets are matched by tab name and
            columns by header text. Existing data for a matched metric is replaced.
          </p>
          <div className="row" style={{ marginBottom: 0 }}>
            <button className="secondary" onClick={handleTemplate} disabled={downloading} type="button">
              {downloading ? 'Preparing…' : '⬇ Download blank template'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(null) }}
            />
            <button onClick={handleImport} disabled={disabled || importing || !file} type="button">
              {importing ? 'Importing…' : 'Import workbook'}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
          {importing && <Spinner label="Parsing and saving the workbook…" />}

          {result && (
            <div className="import-results">
              <strong>
                Imported {result.sheets?.filter((s) => s.matched).length ?? 0} sheet(s)
                {result.sheets ? ` · ${result.sheets.reduce((n, s) => n + (s.rowsAccepted || 0), 0)} rows` : ''}
              </strong>
              {result.warnings?.length > 0 && (
                <div className="warning-box" style={{ marginTop: 8 }}>
                  <strong>Warnings:</strong>
                  <ul style={{ margin: '4px 0 0 18px' }}>
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
