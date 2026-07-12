import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import { useAppContext } from '../context/AppContext'
import { getScorecardSchema, getScorecardAnalytics } from '../client'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// ============================================================================
//  Scorecard Analytics
//   • OVERVIEW  — every metric's calculated KPI as a mini trend chart,
//                 all on one page. Click any chart to deep-dive.
//   • DEEP DIVE — one metric, any value, three views, data grid.
//  Percent KPIs (labels containing %) are shown as % — 0.0037 renders 0.37%.
// ============================================================================

const VIEWS = [
  { value: 'monthwise', label: 'Month-wise (per site)' },
  { value: 'combined', label: 'Combined (all selected sites)' },
  { value: 'comparison', label: 'Single-month site comparison' }
]

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#0891b2',
  '#dc2626', '#4d7c0f', '#9333ea', '#0d9488', '#c026d3', '#ea580c']

// The metric's standard KPI: the last calculated column (formulas build up to
// the headline %), falling back to the first numeric input.
function defaultColumn(metric) {
  const computed = metric.columns.filter((c) => c.type === 'computed')
  if (computed.length) return computed[computed.length - 1].key
  const firstNumber = metric.columns.find((c) => c.type === 'number')
  return firstNumber?.key || ''
}

const colLabelOf = (metric, colKey) =>
  metric?.columns.find((c) => c.key === colKey)?.label || colKey

// Columns whose label mentions % hold ratios — display them ×100 with a % suffix.
const isPercentLabel = (label) => /%/.test(label || '')
const toDisplay = (v, pct) => (v == null ? null : pct ? Math.round(v * 10000) / 100 : v)

export default function ScorecardAnalyticsPage() {
  const { sites, reportPeriods } = useAppContext()

  const [schema, setSchema] = useState([])
  const [mode, setMode] = useState('overview')          // 'overview' | 'single'
  const [metricKey, setMetricKey] = useState('')
  const [columnKey, setColumnKey] = useState('')
  const [view, setView] = useState('monthwise')
  const [granularity, setGranularity] = useState('monthly')
  const [siteIds, setSiteIds] = useState([])            // empty = all
  const [error, setError] = useState(null)

  const range = useMemo(() => {
    if (!reportPeriods.length) return null
    const sorted = [...reportPeriods].sort((a, b) => (a.year - b.year) || (a.month - b.month))
    const from = sorted[0]
    const to = sorted[sorted.length - 1]
    return { fromYear: from.year, fromMonth: from.month, toYear: to.year, toMonth: to.month }
  }, [reportPeriods])

  useEffect(() => {
    getScorecardSchema()
      .then((data) => {
        setSchema(data)
        if (data.length) {
          setMetricKey(data[0].key)
          setColumnKey(defaultColumn(data[0]))
        }
      })
      .catch((err) => setError(err?.response?.data?.error || err.message))
  }, [])

  const ordered = useMemo(() => [...schema].sort((a, b) => a.order - b.order), [schema])

  function toggleSite(id) {
    setSiteIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function openDeepDive(metric) {
    setMetricKey(metric.key)
    setColumnKey(defaultColumn(metric))
    setMode('single')
  }

  return (
    <>
      <ErrorBanner message={error} />

      {/* ================= Shared controls ================= */}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Scorecard Analytics</h2>
          <div className="mode-switch">
            <button
              type="button"
              className={mode === 'overview' ? 'active' : ''}
              onClick={() => setMode('overview')}
            >
              All metrics
            </button>
            <button
              type="button"
              className={mode === 'single' ? 'active' : ''}
              onClick={() => setMode('single')}
            >
              Deep dive
            </button>
          </div>
        </div>

        <div className="scorecard-site-filter" style={{ marginTop: 4 }}>
          <span className="muted" style={{ marginRight: 8 }}>Sites:</span>
          <button
            type="button"
            className={`chip${siteIds.length === 0 ? ' chip-active' : ''}`}
            onClick={() => setSiteIds([])}
          >
            All
          </button>
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip${siteIds.includes(s.id) ? ' chip-active' : ''}`}
              onClick={() => toggleSite(s.id)}
            >
              {s.name}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <label className="picker-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <span className="muted">Granularity</span>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>
        </div>
      </div>

      {mode === 'overview' ? (
        <OverviewGrid
          metrics={ordered}
          range={range}
          granularity={granularity}
          siteIds={siteIds}
          onOpen={openDeepDive}
        />
      ) : (
        <DeepDive
          schema={ordered}
          metricKey={metricKey}
          setMetricKey={setMetricKey}
          columnKey={columnKey}
          setColumnKey={setColumnKey}
          view={view}
          setView={setView}
          range={range}
          granularity={granularity}
          siteIds={siteIds}
          onError={setError}
        />
      )}
    </>
  )
}

/* ======================================================================
   OVERVIEW — all metrics on one page as mini trend charts
   ====================================================================== */
function OverviewGrid({ metrics, range, granularity, siteIds, onOpen }) {
  const [byMetric, setByMetric] = useState({})   // key -> points[]
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!metrics.length || !range) return
    let alive = true
    setLoading(true)
    Promise.all(
      metrics.map((m) => {
        const col = defaultColumn(m)
        if (!col) return Promise.resolve([m.key, []])
        return getScorecardAnalytics({
          metricKey: m.key,
          columnKey: col,
          ...range,
          granularity,
          siteIds: siteIds.length ? siteIds : undefined
        })
          .then((pts) => [m.key, pts])
          .catch(() => [m.key, []])
      })
    ).then((entries) => {
      if (!alive) return
      setByMetric(Object.fromEntries(entries))
      setLoading(false)
    })
    return () => { alive = false }
  }, [metrics, range, granularity, siteIds])

  if (loading && Object.keys(byMetric).length === 0) {
    return <Spinner label="Loading all metric trends…" />
  }

  return (
    <div className="ana-grid">
      {metrics.map((m, idx) => (
        <MiniChart
          key={m.key}
          metric={m}
          points={byMetric[m.key] || []}
          colorOffset={idx}
          onOpen={() => onOpen(m)}
        />
      ))}
    </div>
  )
}

function MiniChart({ metric, points, colorOffset, onOpen }) {
  const colKey = defaultColumn(metric)
  const colLabel = colLabelOf(metric, colKey)
  const pct = isPercentLabel(colLabel)

  const { chartData, seriesKeys, latest } = useMemo(() => {
    const filtered = points.filter((p) => p.columnKey === colKey)
    const labels = [...new Set(filtered.map((p) => p.periodLabel))].sort()
    const siteNames = [...new Set(filtered.map((p) => p.siteName))].sort()
    const rows = labels.map((lbl) => {
      const row = { name: lbl }
      for (const sn of siteNames) {
        const pt = filtered.find((p) => p.periodLabel === lbl && p.siteName === sn)
        row[sn] = pt ? toDisplay(pt.value, pct) : null
      }
      return row
    })
    // Latest overall value (avg across sites in the newest period) for the headline.
    let latestVal = null
    if (labels.length) {
      const last = rows[rows.length - 1]
      const vals = siteNames.map((sn) => last[sn]).filter((v) => v != null)
      if (vals.length) latestVal = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
    }
    return { chartData: rows, seriesKeys: siteNames, latest: latestVal }
  }, [points, colKey, pct])

  const empty = chartData.length === 0

  return (
    <button type="button" className="ana-mini card" onClick={onOpen} title={`${metric.title} — open deep dive`}>
      <div className="ana-mini-head">
        <span className="ana-mini-title">{metric.title}</span>
        <span className="ana-mini-latest">
          {latest == null ? '—' : `${latest}${pct ? '%' : ''}`}
        </span>
      </div>
      <span className="ana-mini-sub" title={colLabel}>{colLabel}</span>

      <div className="ana-mini-chart">
        {empty ? (
          <span className="ana-mini-empty">No data yet</span>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="name" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v) => [`${v}${pct ? '%' : ''}`]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11, padding: '4px 8px' }}
              />
              {seriesKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k}
                  stroke={COLORS[(colorOffset + i) % COLORS.length]}
                  strokeWidth={1.8} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </button>
  )
}

/* ======================================================================
   DEEP DIVE — one metric, any value, three views + data grid
   ====================================================================== */
function DeepDive({
  schema, metricKey, setMetricKey, columnKey, setColumnKey,
  view, setView, range, granularity, siteIds, onError
}) {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [comparePeriodLabel, setComparePeriodLabel] = useState('')

  const activeMetric = useMemo(() => schema.find((m) => m.key === metricKey) || null, [schema, metricKey])
  const valueCols = useMemo(
    () => (activeMetric ? activeMetric.columns.filter((c) => c.type === 'number' || c.type === 'computed') : []),
    [activeMetric]
  )

  // When the metric changes, snap back to its standard calculated KPI.
  useEffect(() => {
    if (!activeMetric) return
    if (!valueCols.some((c) => c.key === columnKey)) {
      setColumnKey(defaultColumn(activeMetric))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey])

  useEffect(() => {
    if (!metricKey || !columnKey || !range) return
    let alive = true
    setLoading(true)
    getScorecardAnalytics({
      metricKey,
      columnKey,
      ...range,
      granularity,
      siteIds: siteIds.length ? siteIds : undefined
    })
      .then((data) => {
        if (!alive) return
        setPoints(data)
        if (data.length) {
          const newest = data.reduce((a, b) => (a.year * 100 + a.month >= b.year * 100 + b.month ? a : b))
          setComparePeriodLabel(newest.periodLabel)
        }
      })
      .catch((err) => onError(err?.response?.data?.error || err.message))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, columnKey, granularity, siteIds, range])

  const colLabel = colLabelOf(activeMetric, columnKey)
  const pct = isPercentLabel(colLabel)

  const { chartData, seriesKeys, periodLabels } = useMemo(
    () => pivot(points, columnKey, view, comparePeriodLabel, pct),
    [points, columnKey, view, comparePeriodLabel, pct]
  )

  const fmt = (v) => (v == null ? '–' : `${v}${pct ? '%' : ''}`)

  return (
    <>
      <div className="card">
        <div className="scorecard-analytics-controls">
          <label className="picker-label">
            Metric
            <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
              {schema.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}
            </select>
          </label>

          <label className="picker-label" title="Defaults to the sheet's calculated KPI. Pick a raw input to drill into the underlying numbers.">
            Value to chart
            <select value={columnKey} onChange={(e) => setColumnKey(e.target.value)}>
              <optgroup label="Calculated (scorecard formula)">
                {valueCols.filter((c) => c.type === 'computed').map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </optgroup>
              <optgroup label="Raw inputs">
                {valueCols.filter((c) => c.type !== 'computed').map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="picker-label">
            View
            <select value={view} onChange={(e) => setView(e.target.value)}>
              {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </label>

          {view === 'comparison' && (
            <label className="picker-label">
              Month
              <select value={comparePeriodLabel} onChange={(e) => setComparePeriodLabel(e.target.value)}>
                {[...new Set(points.map((p) => p.periodLabel))].sort().map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {activeMetric?.title} — {colLabel}{pct ? ' (%)' : ''}
          <span className="muted" style={{ fontWeight: 400 }}>
            {' '}({VIEWS.find((v) => v.value === view)?.label})
          </span>
        </h3>

        {loading ? (
          <Spinner label="Crunching the numbers…" />
        ) : points.length === 0 ? (
          <EmptyState>No scorecard data for this selection yet.</EmptyState>
        ) : (
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              {view === 'comparison' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} />
                  <YAxis tickFormatter={(v) => `${v}${pct ? '%' : ''}`} />
                  <Tooltip formatter={(v) => [fmt(v), colLabel]} />
                  <Bar dataKey="value" fill={COLORS[0]} name={colLabel} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `${v}${pct ? '%' : ''}`} />
                  <Tooltip formatter={(v, name) => [fmt(v), name]} />
                  <Legend />
                  {seriesKeys.map((k, i) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {points.length > 0 && (
        <DataTable points={points} columnKey={columnKey} colLabel={colLabel} periodLabels={periodLabels} pct={pct} />
      )}
    </>
  )
}

// ---- Pivot raw points into recharts-friendly rows (values %-scaled here) ----
function pivot(points, columnKey, view, comparePeriodLabel, pct) {
  const filtered = points
    .filter((p) => p.columnKey === columnKey)
    .map((p) => ({ ...p, value: toDisplay(p.value, pct) }))
  const periodLabels = [...new Set(filtered.map((p) => p.periodLabel))].sort()

  if (view === 'comparison') {
    const rows = filtered
      .filter((p) => p.periodLabel === comparePeriodLabel)
      .map((p) => ({ name: p.siteName, value: p.value }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
    return { chartData: rows, seriesKeys: ['value'], periodLabels }
  }

  if (view === 'combined') {
    const byPeriod = new Map()
    for (const p of filtered) {
      if (!byPeriod.has(p.periodLabel)) byPeriod.set(p.periodLabel, [])
      if (p.value != null) byPeriod.get(p.periodLabel).push(p.value)
    }
    const chartData = periodLabels.map((lbl) => {
      const vals = byPeriod.get(lbl) || []
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      return { name: lbl, 'All sites': avg == null ? null : Math.round(avg * 100) / 100 }
    })
    return { chartData, seriesKeys: ['All sites'], periodLabels }
  }

  const siteNames = [...new Set(filtered.map((p) => p.siteName))].sort()
  const chartData = periodLabels.map((lbl) => {
    const row = { name: lbl }
    for (const sn of siteNames) {
      const pt = filtered.find((p) => p.periodLabel === lbl && p.siteName === sn)
      row[sn] = pt ? pt.value : null
    }
    return row
  })
  return { chartData, seriesKeys: siteNames, periodLabels }
}

// ---- Raw data table (site × period grid) ----
function DataTable({ points, columnKey, colLabel, periodLabels, pct }) {
  const filtered = points
    .filter((p) => p.columnKey === columnKey)
    .map((p) => ({ ...p, value: toDisplay(p.value, pct) }))
  const siteNames = [...new Set(filtered.map((p) => p.siteName))].sort()
  const lookup = new Map(filtered.map((p) => [`${p.siteName}__${p.periodLabel}`, p.value]))

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Data grid — {colLabel}{pct ? ' (%)' : ''}</h3>
      <div className="scorecard-table-wrap">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Site</th>
              {periodLabels.map((l) => <th key={l}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {siteNames.map((sn) => (
              <tr key={sn}>
                <td><strong>{sn}</strong></td>
                {periodLabels.map((l) => {
                  const v = lookup.get(`${sn}__${l}`)
                  return <td key={l}>{v == null ? '–' : `${v}${pct ? '%' : ''}`}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
