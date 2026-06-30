import React, { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { importScorecard, downloadScorecardTemplate } from '../client'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import { Spinner } from '../components/Feedback'

// Download the blank scorecard template, and upload a filled workbook for the
// selected site & period. Sheets are matched to metrics by tab name; columns by header.
export default function ScorecardImportPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  function handleFileChange(e) {
    setFile(e.target.files?.[0] || null)
    setResult(null)
    setError(null)
  }

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
      const data = await importScorecard(selectedSiteId, selectedPeriodId, file)
      setResult(data)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <SiteAndPeriodPicker helpText="Bulk-fill the Monthly Site Scorecard from the Excel template for this site and period." />

      <div className="card">
        <h2>1. Get the template</h2>
        <p className="muted">
          A blank workbook with one tab per metric (matching the standard scorecard).
          Grey columns are auto-calculated by the app — leave them blank.
        </p>
        <button className="secondary" onClick={handleTemplate} disabled={downloading} type="button">
          {downloading ? 'Preparing…' : '⬇ Download blank template'}
        </button>
      </div>

      <div className="card">
        <h2>2. Upload filled workbook</h2>
        <p className="muted">
          Sheets are matched to metrics by tab name; columns by header text, so column
          order doesn’t have to be exact. Existing data for a metric is replaced.
        </p>

        <div className="row">
          <input ref={inputRef} type="file" accept=".xlsx" onChange={handleFileChange} />
          <button onClick={handleImport} disabled={importing || isPeriodLocked || !file} type="button">
            {importing ? 'Importing…' : 'Import workbook'}
          </button>
        </div>

        {isPeriodLocked && (
          <p className="warning-box">This report period is locked — import is disabled.</p>
        )}
        {error && <p className="error-text">{error}</p>}
        {importing && <Spinner label="Parsing and saving the workbook…" />}

        {result && <ImportSummary result={result} />}
      </div>
    </>
  )
}

function ImportSummary({ result }) {
  const sheets = result.sheets || []
  return (
    <div className="card" style={{ marginTop: 12, background: '#f8fafc' }}>
      <h3>Import results</h3>
      <table>
        <thead>
          <tr>
            <th>Sheet</th>
            <th>Metric</th>
            <th>Rows saved</th>
            <th>Matched</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((s, i) => (
            <tr key={i}>
              <td>{s.sheetName}</td>
              <td>{s.metricKey || '—'}</td>
              <td>{s.rowsAccepted}</td>
              <td>{s.matched ? '✓' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.warnings?.length > 0 && (
        <div className="warning-box">
          <strong>Warnings:</strong>
          <ul>{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
