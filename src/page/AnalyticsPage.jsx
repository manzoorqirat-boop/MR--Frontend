import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { useAppContext } from '../context/AppContext'
import { getRangeAnalytics } from '../client'
import { MONTH_NAMES, INITIATIVE_TYPES, labelFor } from '../../constants'
import StatCard from '../components/StatCard'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

// ---- colors ----
const C = {
  potential: '#3b82f6',
  validated: '#10b981',
  total: '#6366f1',
  completed: '#10b981',
  rate: '#f59e0b',
  trainTotal: '#8b5cf6',
  trainDone: '#10b981'
}
const STATUS_COLORS = {
  Completed: '#10b981',
  InProgress: '#f59e0b',
  Delayed: '#ef4444',
  NotStarted: '#9ca3af'
}
const STATUS_LABELS = {
  Completed: 'Completed', InProgress: 'In Progress', Delayed: 'Delayed', NotStarted: 'Not Started'
}

// ---- date helpers ----
function shiftMonth(year, month, delta) {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}
function key(y, m) { return y * 100 + m }

const PRESETS = [
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last 12 months', months: 12 }
]

function ChartCard({ title, subtitle, hasData, children }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: 2 }}>{title}</h3>
      {subtitle && <p className="muted" style={{ marginTop: 0 }}>{subtitle}</p>}
      {hasData ? (
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState>No data in this range.</EmptyState>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const { sites, reportPeriods, loading: ctxLoading } = useAppContext()

  // Most recent period in the data (fallback: today), used to seed the window.
  const latest = useMemo(() => {
    if (reportPeriods.length === 0) {
      const d = new Date()
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    }
    return reportPeriods.reduce(
      (best, p) => (key(p.year, p.month) > key(best.year, best.month) ? p : best),
      reportPeriods[0]
    )
  }, [reportPeriods])

  const [toY, setToY] = useState(latest.year)
  const [toM, setToM] = useState(latest.month)
  const initialFrom = shiftMonth(latest.year, latest.month, -5)
  const [fromY, setFromY] = useState(initialFrom.year)
  const [fromM, setFromM] = useState(initialFrom.month)
  const [granularity, setGranularity] = useState('monthly')
  const [siteId, setSiteId] = useState('') // '' = all sites

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Snap the window to the latest period once, after periods first load.
  const snapped = useRef(false)
  useEffect(() => {
    if (!snapped.current && reportPeriods.length > 0) {
      snapped.current = true
      setToY(latest.year); setToM(latest.month)
      const f = shiftMonth(latest.year, latest.month, -5)
      setFromY(f.year); setFromM(f.month)
    }
  }, [reportPeriods, latest])

  function applyPreset(months) {
    const f = shiftMonth(toY, toM, -(months - 1))
    setFromY(f.year); setFromM(f.month)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getRangeAnalytics({
        fromYear: fromY, fromMonth: fromM, toYear: toY, toMonth: toM,
        granularity, siteId: siteId === '' ? undefined : Number(siteId)
      })
      setData(res)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [fromY, fromM, toY, toM, granularity, siteId])

  useEffect(() => { fetchData() }, [fetchData])

  const k = data?.kpis
  const buckets = data?.buckets ?? []
  const byType = (data?.initiativesByType ?? []).map((t) => ({
    ...t, label: labelFor(INITIATIVE_TYPES, t.type)
  }))
  const statusData = (data?.initiativeStatusBreakdown ?? []).map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status, value: s.count, status: s.status
  }))
  const bySite = data?.bySite ?? []
  const hasSites = bySite.length > 0
  const siteFocused = siteId !== ''

  const yearOptions = useMemo(() => {
    const years = new Set([new Date().getFullYear(), latest.year, fromY, toY])
    reportPeriods.forEach((p) => years.add(p.year))
    return Array.from(years).sort((a, b) => a - b)
  }, [reportPeriods, latest, fromY, toY])

  return (
    <>
      {/* ---------------- Controls ---------------- */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Analytics</h2>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
          <label className="picker-label">
            From
            <div className="row" style={{ gap: 6 }}>
              <select value={fromM} onChange={(e) => setFromM(Number(e.target.value))}>
                {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
              </select>
              <select value={fromY} onChange={(e) => setFromY(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </label>

          <label className="picker-label">
            To
            <div className="row" style={{ gap: 6 }}>
              <select value={toM} onChange={(e) => setToM(Number(e.target.value))}>
                {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
              </select>
              <select value={toY} onChange={(e) => setToY(Number(e.target.value))}>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </label>

          <label className="picker-label">
            Granularity
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </label>

          <label className="picker-label">
            Site
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">All sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button key={p.months} className="secondary" onClick={() => applyPreset(p.months)}>
              {p.label}
            </button>
          ))}
          <span className="muted" style={{ alignSelf: 'center' }}>
            {data ? `Showing ${data.fromLabel} → ${data.toLabel} · ${data.kpis.periodsCount} period(s)` : ''}
          </span>
        </div>
      </div>

      <ErrorBanner message={error} />

      {ctxLoading || loading ? (
        <Spinner label="Crunching analytics…" />
      ) : !data || data.kpis.periodsCount === 0 ? (
        <div className="card"><EmptyState>No report periods fall in this range. Adjust the dates or create periods under Sites &amp; Periods.</EmptyState></div>
      ) : (
        <>
          {/* ---------------- KPI cards ---------------- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
            <StatCard label="Initiatives" value={k.initiativesTotal} sublabel={`${k.initiativesCompleted} completed`} />
            <StatCard label="Initiative completion" value={`${k.initiativeCompletionRate}%`} />
            <StatCard label="Trainings" value={k.trainingsTotal} sublabel={`${k.trainingsCompleted} completed`} />
            <StatCard label="Potential savings" value={`₹${Number(k.costSavingsPotentialLacs).toFixed(2)}L`} />
            <StatCard label="Validated savings" value={`₹${Number(k.costSavingsValidatedLacs).toFixed(2)}L`} sublabel="finance-confirmed" />
          </div>

          {/* ---------------- Cost savings over time ---------------- */}
          <ChartCard
            title="Cost savings over time"
            subtitle="Potential vs finance-validated (₹ Lacs)"
            hasData={buckets.length > 0}
          >
            <BarChart data={buckets} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}L`} />
              <Legend />
              <Bar name="Potential" dataKey="costSavingsPotentialLacs" fill={C.potential} radius={[4, 4, 0, 0]} />
              <Bar name="Validated" dataKey="costSavingsValidatedLacs" fill={C.validated} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <div className="grid-2">
            {/* Initiative completion over time */}
            <ChartCard
              title="Initiative completion over time"
              subtitle="Counts (bars) and completion rate (line)"
              hasData={buckets.length > 0}
            >
              <ComposedChart data={buckets} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" name="Total" dataKey="initiativesTotal" fill={C.total} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" name="Completed" dataKey="initiativesCompleted" fill={C.completed} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" name="Completion %" type="monotone" dataKey="initiativeCompletionRate" stroke={C.rate} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartCard>

            {/* Status breakdown donut */}
            <ChartCard
              title="Initiative status mix"
              subtitle="Across the selected range"
              hasData={statusData.length > 0}
            >
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartCard>
          </div>

          <div className="grid-2">
            {/* Initiatives by type */}
            <ChartCard
              title="Initiatives by type"
              subtitle="Total vs completed"
              hasData={byType.length > 0}
            >
              <BarChart data={byType} layout="vertical" margin={{ top: 8, right: 12, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="label" width={130} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar name="Total" dataKey="total" fill={C.total} radius={[0, 4, 4, 0]} />
                <Bar name="Completed" dataKey="completed" fill={C.completed} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartCard>

            {/* Training over time */}
            <ChartCard
              title="Training over time"
              subtitle="Total vs completed sessions"
              hasData={buckets.length > 0}
            >
              <BarChart data={buckets} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar name="Total" dataKey="trainingsTotal" fill={C.trainTotal} radius={[4, 4, 0, 0]} />
                <Bar name="Completed" dataKey="trainingsCompleted" fill={C.trainDone} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </div>

          {/* ---------------- Site comparison (always across all sites) ---------------- */}
          {hasSites && (
            <>
              <div className="card" style={{ paddingBottom: 4 }}>
                <h2 style={{ margin: 0 }}>Site comparison — all sites</h2>
                <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>
                  Initiative completion status across every site for {data.fromLabel} → {data.toLabel}
                  {siteFocused ? ' (this section ignores the site filter above).' : '.'}
                </p>
              </div>

              <div className="grid-2">
                <ChartCard
                  title="Initiative status by site"
                  subtitle="Stacked counts per site"
                  hasData={hasSites}
                >
                  <BarChart data={bySite} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="siteName" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar name="Completed" dataKey="initiativesCompleted" stackId="s" fill={STATUS_COLORS.Completed} />
                    <Bar name="In Progress" dataKey="initiativesInProgress" stackId="s" fill={STATUS_COLORS.InProgress} />
                    <Bar name="Delayed" dataKey="initiativesDelayed" stackId="s" fill={STATUS_COLORS.Delayed} />
                    <Bar name="Not Started" dataKey="initiativesNotStarted" stackId="s" fill={STATUS_COLORS.NotStarted} />
                  </BarChart>
                </ChartCard>

                <ChartCard
                  title="Completion rate by site"
                  subtitle="% of initiatives completed"
                  hasData={hasSites}
                >
                  <BarChart data={bySite} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="siteName" fontSize={12} />
                    <YAxis unit="%" domain={[0, 100]} fontSize={12} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar name="Completion %" dataKey="initiativeCompletionRate" fill={C.rate} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartCard>
              </div>

              <ChartCard
                title="Site comparison — savings"
                subtitle="Potential vs validated (₹ Lacs)"
                hasData={hasSites}
              >
                <BarChart data={bySite} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="siteName" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}L`} />
                  <Legend />
                  <Bar name="Potential" dataKey="costSavingsPotentialLacs" fill={C.potential} radius={[4, 4, 0, 0]} />
                  <Bar name="Validated" dataKey="costSavingsValidatedLacs" fill={C.validated} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartCard>

              {/* Exact numbers behind the charts */}
              <div className="card">
                <h3 style={{ marginBottom: 8 }}>Site-level completion status</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th style={{ width: 70 }}>Total</th>
                        <th style={{ width: 90 }}>Completed</th>
                        <th style={{ width: 90 }}>In Progress</th>
                        <th style={{ width: 80 }}>Delayed</th>
                        <th style={{ width: 90 }}>Not Started</th>
                        <th style={{ width: 110 }}>Completion %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySite.map((s) => (
                        <tr key={s.siteId}>
                          <td>{s.siteName}</td>
                          <td>{s.initiativesTotal}</td>
                          <td>{s.initiativesCompleted}</td>
                          <td>{s.initiativesInProgress}</td>
                          <td>{s.initiativesDelayed}</td>
                          <td>{s.initiativesNotStarted}</td>
                          <td>{s.initiativeCompletionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}