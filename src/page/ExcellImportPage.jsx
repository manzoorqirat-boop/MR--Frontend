import React, { useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { importExcel } from '../client'
import SiteAndPeriodPicker from '../components/SiteAndPeriodPicker'
import { Spinner } from '../components/Feedback'

export default function ExcelImportPage() {
  const { selectedSiteId, selectedPeriodId, isPeriodLocked } = useAppContext()
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    setFile(selected || null)
    setResult(null)
    setError(null)
  }

  async function handleImport() {
    if (!file) {
      setError('Choose a .xlsx file first.')
      return
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files are supported.')
      return
    }
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const data = await importExcel(selectedSiteId, selectedPeriodId, file)
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
      <SiteAndPeriodPicker helpText="Upload the standard 7-sheet monthly workbook for this site and period in one go." />

      <div className="card">
        <h2>Upload workbook</h2>
        <p className="muted">
          Expected sheets (matched by name, case-insensitive): Training, Documentation
          Simplification, Regulatory Compliance, Productivity Enhancement, Lean Laboratory,
          Digitalization, Cost Savings. Header row 1, data starts row 2.
        </p>

        <div className="row">
          <input ref={inputRef} type="file" accept=".xlsx" onChange={handleFileChange} />
          <button onClick={handleImport} disabled={importing || isPeriodLocked || !file}>
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
  const initiativeRows = (result.initiatives || []).map((i) => ({
    type: i.type,
    accepted: i.result?.rowsAccepted ?? 0,
    rejected: i.result?.rowsRejected ?? 0,
    errors: i.result?.errors ?? []
  }))

  return (
    <div className="card" style={{ marginTop: 12, background: '#f8fafc' }}>
      <h3>Import results</h3>
      <table>
        <thead>
          <tr>
            <th>Sheet</th>
            <th>Accepted</th>
            <th>Rejected</th>
          </tr>
        </thead>
        <tbody>
          {result.training && (
            <tr>
              <td>Training</td>
              <td>{result.training.rowsAccepted}</td>
              <td>{result.training.rowsRejected}</td>
            </tr>
          )}
          {initiativeRows.map((row) => (
            <tr key={row.type}>
              <td>{row.type}</td>
              <td>{row.accepted}</td>
              <td>{row.rejected}</td>
            </tr>
          ))}
          {result.costSavings && (
            <tr>
              <td>Cost Savings</td>
              <td>{result.costSavings.rowsAccepted}</td>
              <td>{result.costSavings.rowsRejected}</td>
            </tr>
          )}
        </tbody>
      </table>

      {result.warnings?.length > 0 && (
        <div className="warning-box">
          <strong>Warnings:</strong>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
