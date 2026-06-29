import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts'
import { useAppContext } from '../context/AppContext'
import { getGlobalReport, getCostSavingTrend } from '../client'
import { formatPeriodLabel, INITIATIVE_TYPES, labelFor } from '../../constants'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'
import StatCard from '../components/StatCard'

export default function DashboardPage() {
  const { reportPeriods, selectedPeriodId, setSelectedPeriodId, loading: contextLoading } =
    useAppContext()

  const [report, setReport] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!selectedPeriodId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([getGlobalReport(selectedPeriodId), getCostSavingTrend(6)])
      .then(([reportData, trendData]) => {
        if (cancelled) return
        setReport(reportData)
        setTrend(trendData)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPeriodId])

  const totals = useMemo(() => {
    if (!report) return null
    const totalInitiatives = report.initiatives.reduce((s, i) => s + i.totalCount, 0)
    const completedInitiatives = report.initiatives.reduce((s, i) => s + i.completedCount, 0)
    const totalTrainings = report.training.reduce((s, t) => s + t.totalTrainings, 0)
    const completedTrainings = report.training.reduce((s, t) => s + t.completedTrainings, 0)
    const totalPotentialSavings = report.costSavings.reduce((s, c) => s + c.totalPotentialSavingLacs, 0)
    const totalValidatedSavings = report.costSavings.reduce((s, c) => s + c.validatedSavingLacs, 0)
    return {
      totalInitiatives,
      completedInitiatives,
      completionRate: totalInitiatives > 0 ? Math.round((100 * completedInitiatives) / totalInitiatives * 10) / 10 : 0,
      totalTrainings,
      completedTrainings,
      totalPotentialSavings,
      totalValidatedSavings
    }
  }, [report])

  return (
    <>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Monthly global report</h2>
          <label className="picker-label">
            Period
            <select
              value={selectedPeriodId ?? ''}
              onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
            >
              {reportPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPeriodLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ErrorBanner message={error} />

      {(contextLoading || loading) && <Spinner label="Loading the global report…" />}

      {!loading && !contextLoading && reportPeriods.length === 0 && (
        <EmptyState>
          No report periods exist yet. Create one on the Sites &amp; Periods page to see the
          dashboard.
        </EmptyState>
      )}

      {!loading && report && (
        <>
          <div className="grid-stats">
            <StatCard
              label="Initiatives completed"
              value={`${totals.completedInitiatives} / ${totals.totalInitiatives}`}
              sublabel={`${totals.completionRate}% completion rate`}
            />
            <StatCard
              label="Trainings completed"
              value={`${totals.completedTrainings} / ${totals.totalTrainings}`}
            />
            <StatCard
              label="Potential savings"
              value={`${totals.totalPotentialSavings.toFixed(1)} Lacs`}
              sublabel={`${totals.totalValidatedSavings.toFixed(1)} Lacs validated by finance`}
            />
          </div>

          {report.sitesNotSubmitted.length > 0 && (
            <div className="warning-box">
              <strong>Not yet submitted:</strong> {report.sitesNotSubmitted.join(', ')}
            </div>
          )}

          <div className="card">
            <h3>Initiative completion rate by type</h3>
            {report.initiatives.length === 0 ? (
              <EmptyState>No initiatives recorded for this period yet.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.initiatives} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="initiativeType" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={70} />
                  <YAxis unit="%" />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="completionRatePercent" name="Completion rate" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Training by site</h3>
              {report.training.length === 0 ? (
                <EmptyState>No training records for this period yet.</EmptyState>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Total</th>
                      <th>Completed</th>
                      <th>Depts.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.training.map((t) => (
                      <tr key={t.siteId}>
                        <td>{t.siteName}</td>
                        <td>{t.totalTrainings}</td>
                        <td>{t.completedTrainings}</td>
                        <td>{t.departmentsCovered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3>Cost savings by site (Lacs)</h3>
              {report.costSavings.length === 0 ? (
                <EmptyState>No cost saving projects for this period yet.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={report.costSavings} margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="siteName" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalPotentialSavingLacs" name="Potential" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="validatedSavingLacs" name="Validated" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Cost savings trend (last {trend.length || 6} months)</h3>
            {trend.length === 0 ? (
              <EmptyState>Not enough history yet to show a trend.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" name="Potential savings (Lacs)" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </>
  )
}