import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  getScorecardSchema, getScorecardRows, saveScorecardRows, getScorecardStatus
} from '../client'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'
import { computeRow } from '../scorecardSchema'

// Dynamic data-entry for the 20-sheet Monthly Site Scorecard.
// The form for each metric is generated from the schema: input columns become
// editable cells, computed columns show a live read-only preview.
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

  const canQuery = Boolean(selectedSiteId && selectedPeriodId)
  const activeMetric = useMemo(
    () => schema.find((m) => m.key === activeKey) || null,
    [schema, activeKey]
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
      // Convert resolved rows back into editable cell maps (input columns only).
      const editable = data.map((r) => {
        const cells = {}
        for (const c of inputCols) cells[c.key] = r.cells?.[c.key] ?? ''
        return cells
      })
      setRows(editable.length ? editable : [blankCells(inputCols)])
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

  async function handleSave() {
    // Drop fully-blank rows.
    const nonEmpty = rows.filter((r) => inputCols.some((c) => String(r[c.key] ?? '').trim() !== ''))
    setSaving(true)
    setError(null)
    setSavedNote(null)
    try {
      const payload = {
        siteId: selectedSiteId,
        reportPeriodId: selectedPeriodId,
        metricKey: activeKey,
        rows: nonEmpty.map((r, i) => ({ rowIndex: i, cells: r }))
      }
      const res = await saveScorecardRows(payload)
      setSavedNote(`Saved ${res.rowsSaved} row(s) for ${activeMetric?.title}.`)
      await loadRows()
      await refreshStatus()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadingSchema) return <Spinner label="Loading scorecard definitions…" />

  return (
    <>
      <SiteAndPeriodPicker helpText="Monthly Site Scorecard — fill each QC/QA metric for this site and month. Grey columns are auto-calculated." />

      <ErrorBanner message={error} />

      {isPeriodLocked && (
        <p className="warning-box">This report period is locked — editing is disabled.</p>
      )}
      {savedNote && (
        <div className="warning-box" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>{savedNote}</div>
      )}

      <div className="scorecard-layout">
        {/* ---- Metric sidebar ---- */}
        <aside className="scorecard-nav card">
          {grouped.map(([category, metrics]) => (
            <div key={category} className="scorecard-nav-group">
              <div className="scorecard-nav-cat">{category}</div>
              {metrics.map((m) => {
                const count = statusCounts[m.key] || 0
                return (
                  <button
                    key={m.key}
                    className={`scorecard-nav-item${m.key === activeKey ? ' active' : ''}`}
                    onClick={() => setActiveKey(m.key)}
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
                    {activeMetric.multiRow ? ' · multiple rows allowed' : ' · single row'}
                  </p>
                </div>
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

              <div className="row" style={{ marginTop: 12 }}>
                {activeMetric.multiRow && (
                  <button className="secondary" disabled={isPeriodLocked} onClick={addRow} type="button">
                    + Add row
                  </button>
                )}
                <button disabled={isPeriodLocked || saving} onClick={handleSave} type="button">
                  {saving ? 'Saving…' : `Save ${activeMetric.title}`}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
