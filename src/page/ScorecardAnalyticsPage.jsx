import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer
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

// Columns whose label mentions % are percentages. Formulas store ratios (0.0037)
// but some sheets take the % typed directly (e.g. 98 for 98%), so decide per
// series: if every value is ≤ 1.5 it's a ratio → ×100; otherwise leave as-is.
const isPercentLabel = (label) => /%/.test(label || '')
function percentScale(rawValues) {
  const nums = rawValues.filter((v) => v != null && !Number.isNaN(v)).map(Math.abs)
  if (!nums.length) return 100
  return Math.max(...nums) <= 1.5 ? 100 : 1
}
const round2 = (v) => (v == null ? null : Math.round(v * 100) / 100)

export default function ScorecardAnalyticsPage() {
  const { sites, reportPeriods } = useAppContext()

  const [schema, setSchema] = useState([])
  const [mode, setMode] = useState('overview')          // 'overview' | 'single'
  const [metricKey, setMetricKey] = useState('')
  const [columnKey, setColumnKey] = useState('')
  const [view, setView] = useState('trend')
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
    const scale = pct ? percentScale(filtered.map((p) => p.value)) : 1
    const labels = [...new Set(filtered.map((p) => p.periodLabel))].sort()
    const siteNames = [...new Set(filtered.map((p) => p.siteName))].sort()
    const rows = labels.map((lbl) => {
      const row = { name: lbl }
      for (const sn of siteNames) {
        const pt = filtered.find((p) => p.periodLabel === lbl && p.siteName === sn)
        row[sn] = pt ? round2(pt.value * scale) : null
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
                  strokeWidth={1.8} dot={{ r: 2.5 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </button>
  )
}

/* ======================================================================
   DEEP DIVE — Minitab-style analyses for one metric
   ====================================================================== */
const ANALYSES = [
  { value: 'trend', label: 'Trend — per site (run chart)' },
  { value: 'combined', label: 'Trend — combined average' },
  { value: 'barcompare', label: 'Bar — site comparison (one month)' },
  { value: 'pareto', label: 'Pareto — sites (one month)' },
  { value: 'control', label: 'Control chart (I-chart, ±3σ)' },
  { value: 'histogram', label: 'Histogram — distribution' }
]
const needsMonth = (a) => a === 'barcompare' || a === 'pareto'

function DeepDive({
  schema, metricKey, setMetricKey, columnKey, setColumnKey,
  view, setView, range, granularity, siteIds, onError
}) {
  const analysis = view
  const setAnalysis = setView
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
  const unit = pct ? '%' : ''

  // ---- Scaled points: %-labelled ratios ×100, already-% values untouched ----
  const scaled = useMemo(() => {
    const filtered = points.filter((p) => p.columnKey === columnKey)
    const scale = pct ? percentScale(filtered.map((p) => p.value)) : 1
    return filtered.map((p) => ({ ...p, value: round2(p.value == null ? null : p.value * scale) }))
  }, [points, columnKey, pct])

  const periodLabels = useMemo(() => [...new Set(scaled.map((p) => p.periodLabel))].sort(), [scaled])
  const fmt = (v) => (v == null ? '–' : `${v}${unit}`)

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
            Analysis
            <select value={analysis} onChange={(e) => setAnalysis(e.target.value)}>
              {ANALYSES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>

          {needsMonth(analysis) && (
            <label className="picker-label">
              Month
              <select value={comparePeriodLabel} onChange={(e) => setComparePeriodLabel(e.target.value)}>
                {periodLabels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {activeMetric?.title} — {colLabel}
          <span className="muted" style={{ fontWeight: 400 }}>
            {' '}({ANALYSES.find((a) => a.value === analysis)?.label})
          </span>
        </h3>

        {loading ? (
          <Spinner label="Crunching the numbers…" />
        ) : scaled.length === 0 ? (
          <EmptyState>No scorecard data for this selection yet.</EmptyState>
        ) : (
          <AnalysisChart
            analysis={analysis}
            scaled={scaled}
            periodLabels={periodLabels}
            comparePeriodLabel={comparePeriodLabel}
            colLabel={colLabel}
            unit={unit}
            fmt={fmt}
          />
        )}
      </div>

      {scaled.length > 0 && (
        <DataTable scaled={scaled} colLabel={colLabel} periodLabels={periodLabels} unit={unit} />
      )}
    </>
  )
}

/* ---- The actual chart per analysis type ---- */
function AnalysisChart({ analysis, scaled, periodLabels, comparePeriodLabel, colLabel, unit, fmt }) {
  const siteNames = useMemo(() => [...new Set(scaled.map((p) => p.siteName))].sort(), [scaled])

  // per-site trend rows
  const trendRows = useMemo(() => periodLabels.map((lbl) => {
    const row = { name: lbl }
    for (const sn of siteNames) {
      const pt = scaled.find((p) => p.periodLabel === lbl && p.siteName === sn)
      row[sn] = pt ? pt.value : null
    }
    return row
  }), [scaled, periodLabels, siteNames])

  // combined average series
  const combinedRows = useMemo(() => periodLabels.map((lbl) => {
    const vals = scaled.filter((p) => p.periodLabel === lbl && p.value != null).map((p) => p.value)
    return { name: lbl, value: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null }
  }), [scaled, periodLabels])

  const tick = (v) => `${v}${unit}`

  if (analysis === 'trend') {
    return (
      <Chart420>
        <LineChart data={trendRows} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={tick} />
          <Tooltip formatter={(v, name) => [fmt(v), name]} />
          <Legend />
          {siteNames.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]}
              strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </Chart420>
    )
  }

  if (analysis === 'combined') {
    return (
      <Chart420>
        <ComposedChart data={combinedRows} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={tick} />
          <Tooltip formatter={(v) => [fmt(v), `Average ${colLabel}`]} />
          <Area type="monotone" dataKey="value" fill="#dbeafe" stroke="none" />
          <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
        </ComposedChart>
      </Chart420>
    )
  }

  if (analysis === 'barcompare' || analysis === 'pareto') {
    const monthRows = scaled
      .filter((p) => p.periodLabel === comparePeriodLabel && p.value != null)
      .map((p) => ({ name: p.siteName, value: p.value }))
      .sort((a, b) => b.value - a.value)

    if (analysis === 'barcompare') {
      return (
        <Chart420>
          <BarChart data={monthRows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} />
            <YAxis tickFormatter={tick} />
            <Tooltip formatter={(v) => [fmt(v), colLabel]} />
            <Bar dataKey="value" fill={COLORS[0]} name={colLabel} />
          </BarChart>
        </Chart420>
      )
    }

    // Pareto: sorted bars + cumulative-% line on a second axis
    const total = monthRows.reduce((a, r) => a + r.value, 0) || 1
    let running = 0
    const paretoRows = monthRows.map((r) => {
      running += r.value
      return { ...r, cumulative: round2((running / total) * 100) }
    })
    return (
      <Chart420>
        <ComposedChart data={paretoRows} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={70} />
          <YAxis yAxisId="left" tickFormatter={tick} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v, name) => (name === 'Cumulative %' ? [`${v}%`, name] : [fmt(v), colLabel])} />
          <Legend />
          <Bar yAxisId="left" dataKey="value" fill={COLORS[0]} name={colLabel} />
          <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke={COLORS[3]}
            strokeWidth={2.5} dot={{ r: 4 }} name="Cumulative %" />
          <ReferenceLine yAxisId="right" y={80} stroke="#94a3b8" strokeDasharray="4 4"
            label={{ value: '80%', position: 'right', fill: '#64748b', fontSize: 11 }} />
        </ComposedChart>
      </Chart420>
    )
  }

  if (analysis === 'control') {
    // I-chart on the combined average series: mean ±3σ, out-of-control points red.
    const series = combinedRows.filter((r) => r.value != null)
    const mean = series.length ? series.reduce((a, r) => a + r.value, 0) / series.length : 0
    const sd = series.length > 1
      ? Math.sqrt(series.reduce((a, r) => a + (r.value - mean) ** 2, 0) / (series.length - 1))
      : 0
    const ucl = round2(mean + 3 * sd)
    const lcl = round2(Math.max(0, mean - 3 * sd))
    const meanR = round2(mean)
    const controlDot = (props) => {
      const { cx, cy, payload } = props
      if (payload.value == null) return null
      const out = payload.value > ucl || payload.value < lcl
      return <circle cx={cx} cy={cy} r={out ? 5.5 : 4} fill={out ? '#dc2626' : COLORS[0]}
        stroke="#fff" strokeWidth={1.5} />
    }
    return (
      <>
        <Chart420>
          <LineChart data={combinedRows} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={tick} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => [fmt(v), `Average ${colLabel}`]} />
            <ReferenceLine y={ucl} stroke="#dc2626" strokeDasharray="5 3"
              label={{ value: `UCL ${ucl}${unit}`, position: 'right', fill: '#dc2626', fontSize: 11 }} />
            <ReferenceLine y={meanR} stroke="#16a34a"
              label={{ value: `x̄ ${meanR}${unit}`, position: 'right', fill: '#16a34a', fontSize: 11 }} />
            <ReferenceLine y={lcl} stroke="#dc2626" strokeDasharray="5 3"
              label={{ value: `LCL ${lcl}${unit}`, position: 'right', fill: '#dc2626', fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={controlDot} connectNulls />
          </LineChart>
        </Chart420>
        <p className="muted" style={{ marginBottom: 0 }}>
          Individuals chart over the average of the selected sites. Limits are x̄ ± 3σ over
          {' '}{series.length} period(s); red points fall outside the limits. Pick a single
          site chip above to control-chart one site.
        </p>
      </>
    )
  }

  if (analysis === 'histogram') {
    const values = scaled.map((p) => p.value).filter((v) => v != null)
    if (!values.length) return <EmptyState>No values to bin yet.</EmptyState>
    const min = Math.min(...values)
    const max = Math.max(...values)
    const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length))))
    const width = (max - min) / binCount || 1
    const bins = Array.from({ length: binCount }, (_, i) => ({
      name: `${round2(min + i * width)}–${round2(min + (i + 1) * width)}${unit}`,
      count: 0
    }))
    for (const v of values) {
      const i = Math.min(binCount - 1, Math.floor((v - min) / width))
      bins[i].count++
    }
    return (
      <>
        <Chart420>
          <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={80} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => [v, 'Data points']} />
            <Bar dataKey="count" fill={COLORS[4]} name="Data points" />
          </BarChart>
        </Chart420>
        <p className="muted" style={{ marginBottom: 0 }}>
          Distribution of every site-month value in range ({values.length} points, {binCount} bins).
        </p>
      </>
    )
  }

  return null
}

function Chart420({ children }) {
  return (
    <div style={{ width: '100%', height: 420 }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  )
}

// ---- Raw data table (site × period grid) ----
function DataTable({ scaled, colLabel, periodLabels, unit }) {
  const siteNames = [...new Set(scaled.map((p) => p.siteName))].sort()
  const lookup = new Map(scaled.map((p) => [`${p.siteName}__${p.periodLabel}`, p.value]))

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Data grid — {colLabel}</h3>
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
                  return <td key={l}>{v == null ? '–' : `${v}${unit}`}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
