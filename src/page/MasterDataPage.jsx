import React, { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  getEquipmentMaster,
  createEquipment,
  toggleEquipment,
  getMasterList,
  addMasterListItem,
  toggleMasterListItem,
  setListItemFrequency
} from '../client'
import { ErrorBanner, EmptyState } from '../components/Feedback'

// ============================================================================
//  Master Data — the controlled lists behind QA-IT Compliance (and future
//  modules): Equipment/Instrument per location, Department/Area, and System
//  Category (with periodic review frequency). Corporate-only page; sites
//  consume these as dropdowns. Items are retired, never deleted, so
//  historical registers keep their point-in-time values.
// ============================================================================

export default function MasterDataPage() {
  const { sites } = useAppContext()
  const [error, setError] = useState(null)

  return (
    <>
      <div className="card">
        <h1 style={{ margin: 0 }}>Master Data</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          Controlled lists used across the portal. Sites pick from these; only corporate edits them.
          Retiring an item hides it from new entries without touching historical records.
        </p>
      </div>

      <ErrorBanner message={error} />

      <MasterDataPanel sites={sites} onError={setError} />
    </>
  )
}

/* ==================== Master data (QA-IT Compliance) ==================== */
// Equipment/Instrument per site + the Department/Area and System Category
// controlled lists. Items are retired (deactivated), never hard-deleted, so
// historical registers keep their values.
function MasterDataPanel({ sites, onError }) {
  return (
    <div className="card">
      <div className="grid-2">
        <EquipmentMasterPanel sites={sites} onError={onError} />
        <div>
          <ListMasterPanel listKey="department" title="Department / Area" onError={onError} />
          <ListMasterPanel listKey="systemCategory" title="System Category" withFrequency onError={onError} />
        </div>
      </div>
    </div>
  )
}

function EquipmentMasterPanel({ sites, onError }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? null)
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!siteId && sites.length) setSiteId(sites[0].id) }, [sites, siteId])

  const load = useCallback(async () => {
    if (!siteId) return
    try {
      setItems(await getEquipmentMaster(siteId, true))
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }, [siteId, onError])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!name.trim() || !code.trim()) { onError('Equipment name and ID are both required.'); return }
    setBusy(true)
    onError(null)
    try {
      await createEquipment({ siteId, name: name.trim(), code: code.trim() })
      setName(''); setCode('')
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(item) {
    onError(null)
    try {
      await toggleEquipment(item.id)
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>Equipment / Instrument (per location)</h3>
      <label className="picker-label" style={{ maxWidth: 320, marginBottom: 8 }}>
        Location
        <select value={siteId ?? ''} onChange={(e) => setSiteId(Number(e.target.value))}>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
        </select>
      </label>
      {items.length === 0 ? (
        <EmptyState>No equipment for this location yet.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th style={{ width: 120 }}></th></tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className={e.isActive ? '' : 'master-retired'}>
                <td>{e.code}</td>
                <td>{e.name}</td>
                <td>
                  <button type="button" className="secondary" onClick={() => handleToggle(e)}>
                    {e.isActive ? 'Retire' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row" style={{ marginTop: 8, marginBottom: 0 }}>
        <label className="picker-label">ID
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. EQP-1234" style={{ width: 120 }} />
        </label>
        <label className="picker-label">Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HPLC-01 (Waters)" />
        </label>
        <button type="button" disabled={busy} onClick={handleAdd} style={{ alignSelf: 'flex-end' }}>
          {busy ? 'Adding…' : 'Add equipment'}
        </button>
      </div>
    </div>
  )
}

function ListMasterPanel({ listKey, title, withFrequency = false, onError }) {
  const [items, setItems] = useState([])
  const [value, setValue] = useState('')
  const [freq, setFreq] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await getMasterList(listKey, true))
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }, [listKey, onError])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!value.trim()) return
    setBusy(true)
    onError(null)
    try {
      await addMasterListItem(listKey, value.trim(), withFrequency && freq ? Number(freq) : null)
      setValue('')
      setFreq('')
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(item) {
    onError(null)
    try {
      await toggleMasterListItem(item.id)
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  async function handleFrequency(item) {
    const raw = window.prompt(`Review frequency for '${item.value}' (years):`, item.frequencyYears ?? '')
    if (raw === null) return
    const years = Number(raw)
    if (!Number.isInteger(years) || years < 1 || years > 20) {
      onError('Frequency must be a whole number of years (1–20).')
      return
    }
    onError(null)
    try {
      await setListItemFrequency(item.id, years)
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div className="master-chips">
        {items.map((i) => (
          <span key={i.id} className="master-chip-wrap">
            <button
              type="button"
              className={`chip master-chip${i.isActive ? '' : ' master-chip-retired'}`}
              title={i.isActive ? 'Click to retire' : 'Click to restore'}
              onClick={() => handleToggle(i)}
            >
              {i.value}{withFrequency && i.frequencyYears ? ` · every ${i.frequencyYears} yr` : ''}{!i.isActive && ' (retired)'}
            </button>
            {withFrequency && (
              <button type="button" className="chip qa-freq-btn" title="Set review frequency" onClick={() => handleFrequency(i)}>⏱</button>
            )}
          </span>
        ))}
        {items.length === 0 && <span className="muted">Empty list.</span>}
      </div>
      <div className="row" style={{ marginTop: 8, marginBottom: 0 }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Add ${title.toLowerCase()}…`} style={{ maxWidth: 240 }} />
        {withFrequency && (
          <input type="number" min="1" max="20" value={freq} onChange={(e) => setFreq(e.target.value)}
            placeholder="Freq (yrs)" style={{ width: 90 }} title="Review frequency in years" />
        )}
        <button type="button" className="secondary" disabled={busy} onClick={handleAdd}>Add</button>
      </div>
    </div>
  )
}
