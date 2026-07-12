import React, { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import { useAppContext } from '../context/AppContext'
import { getScorecardSchema, getScorecardAnalytics } from '../client'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'
import { MONTH_NAMES } from '../../constants'

// Scorecard analytics: every combination the report needs —
//   • Month-wise per site      (trend lines, x = month, one line per site)
//   • Combined all sites       (one aggregated line/bar across the group)
//   • Single-month comparison  (bar per site for one month)
// plus metric + column + site selection and monthly/quarterly granularity.
const VIEWS = [
  { value: 'monthwise', label: 'Month-wise (per site)' },
  { value: 'combined', label: 'Combined (all selected sites)' },
  { value: 'comparison', label: 'Single-month site comparison' }
]

const COLORS = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#0891b2',
  '#dc2626', '#4d7c0f', '#9333ea', '#0d9488', '#c026d3', '#ea580c']

export default function ScorecardAnalyticsPage() {
  const { sites, reportPeriods } = useAppContext()

  const [schema, setSchema] = useState([])
  const [metricKey, setMetricKey] = useState('')
  const [columnKey, setColumnKey] = useState('')
  const [view, setView] = useState('monthwise')
  const [granularity, setGranularity] = useState('monthly')
  const [siteIds, setSiteIds] = useState([])           // empty = all
  const [comparePeriodLabel, setComparePeriodLabel] = useState('')

  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Derive a default date range from the available periods (oldest → newest).
  const range = useMemo(() => {
    if (!reportPeriods.length) return null
    const sorted = [...reportPeriods].sort((a, b) => (a.year - b.year) || (a.month - b.month))
    const from = sorted[0]
    const to = sorted[sorted.length - 1]
    return { fromYear: from.year, fromMonth: from.month, toYear: to.year, toMonth: to.month }
  }, [reportPeriods])

  // ---- Load schema ----
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

  // ---- Fetch analytics ----
  async function run() {
    if (!metricKey || !range) return
    setLoading(true)
    setError(null)
    try {
      const data = await getScorecardAnalytics({
        metricKey,
        columnKey: columnKey || undefined,
        ...range,
        granularity,
        siteIds: siteIds.length ? siteIds : undefined
      })
      setPoints(data)
      // Default the comparison month to the newest period present in the data.
      if (data.length) {
        const newest = data.reduce((a, b) => (a.year * 100 + a.month >= b.year * 100 + b.month ? a : b))
        setComparePeriodLabel(newest.periodLabel)
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-run when key selections change.
  useEffect(() => {
    if (metricKey && columnKey && range) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricKey, columnKey, granularity, siteIds])

  function toggleSite(id) {
    setSiteIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const colLabel = valueCols.find((c) => c.key === columnKey)?.label || columnKey

  // ---- Pivot points into chart data per view ----
  const { chartData, seriesKeys, periodLabels } = useMemo(
    () => pivot(points, columnKey, view, comparePeriodLabel),
    [points, columnKey, view, comparePeriodLabel]
  )

  return (
    <>
      <ErrorBanner message={error} />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Scorecard Analytics</h2>
        <div className="scorecard-analytics-controls">
          <label className="picker-label">
            Metric
            <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
              {[...schema].sort((a, b) => a.order - b.order).map((m) => (
                <option key={m.key} value={m.key}>{m.title}</option>
              ))}
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

          <label className="picker-label">
            Granularity
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
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

        {/* Site multi-select */}
        <div className="scorecard-site-filter">
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
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {activeMetric?.title} — {colLabel}
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
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill={COLORS[0]} name={colLabel} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
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
        <DataTable points={points} columnKey={columnKey} colLabel={colLabel} periodLabels={periodLabels} />
      )}
    </>
  )
}

// The metric's standard KPI: the last calculated column (formulas build up to
// the headline %), falling back to the first numeric input for formula-less sheets.
function defaultColumn(metric) {
  const computed = metric.columns.filter((c) => c.type === 'computed')
  if (computed.length) return computed[computed.length - 1].key
  const firstNumber = metric.columns.find((c) => c.type === 'number')
  return firstNumber?.key || ''
}

// ---- Pivot raw points into recharts-friendly rows ----
function pivot(points, columnKey, view, comparePeriodLabel) {
  const filtered = points.filter((p) => p.columnKey === columnKey)
  const periodLabels = [...new Set(filtered.map((p) => p.periodLabel))].sort()

  if (view === 'comparison') {
    const rows = filtered
      .filter((p) => p.periodLabel === comparePeriodLabel)
      .map((p) => ({ name: p.siteName, value: p.value }))
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
    return { chartData: rows, seriesKeys: ['value'], periodLabels }
  }

  if (view === 'combined') {
    // Aggregate across selected sites per period (average of site values).
    const byPeriod = new Map()
    for (const p of filtered) {
      if (!byPeriod.has(p.periodLabel)) byPeriod.set(p.periodLabel, [])
      if (p.value != null) byPeriod.get(p.periodLabel).push(p.value)
    }
    const chartData = periodLabels.map((lbl) => {
      const vals = byPeriod.get(lbl) || []
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      return { name: lbl, 'All sites': avg == null ? null : Math.round(avg * 10000) / 10000 }
    })
    return { chartData, seriesKeys: ['All sites'], periodLabels }
  }

  // month-wise: one line per site
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
function DataTable({ points, columnKey, colLabel, periodLabels }) {
  const filtered = points.filter((p) => p.columnKey === columnKey)
  const siteNames = [...new Set(filtered.map((p) => p.siteName))].sort()
  const lookup = new Map(filtered.map((p) => [`${p.siteName}__${p.periodLabel}`, p.value]))

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
                  return <td key={l}>{v == null ? '–' : v}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
