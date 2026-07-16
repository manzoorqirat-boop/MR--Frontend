import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  downloadMasterTemplate,
  importMasterData,
  getEquipmentMaster,
  createEquipment,
  toggleEquipment,
  getMasterList,
  addMasterListItem,
  toggleMasterListItem,
  setListItemFrequency
} from '../client'
import { ErrorBanner, EmptyState, Spinner } from '../components/Feedback'

// ============================================================================
//  Master Data console — one menu entry per master, management panel on the
//  right. Corporate-only. Every master supports: search, show/hide retired,
//  add, retire/restore. System Category additionally carries the periodic
//  review frequency (inline-editable). Items are retired, never deleted, so
//  historical registers keep their point-in-time values.
// ============================================================================

const MENU = [
  {
    key: 'equipment',
    label: 'Equipment / Instrument',
    scope: 'Per location',
    desc: 'Instruments and computerized systems available to each location. The QA-IT register picks the ID here; the name auto-fills.'
  },
  {
    key: 'department',
    label: 'Department / Area',
    scope: 'Global',
    desc: 'Departments and areas selectable across all locations.'
  },
  {
    key: 'systemCategory',
    label: 'System Category',
    scope: 'Global',
    desc: 'System classifications with their periodic review frequency. The register auto-computes the next planned review from these.'
  }
]

export default function MasterDataPage() {
  const { sites } = useAppContext()
  const [active, setActive] = useState('equipment')
  const [error, setError] = useState(null)

  // Page-level data so the menu badges stay live across tab switches.
  const [siteId, setSiteId] = useState(null)
  const [equipment, setEquipment] = useState(null)      // null = not yet loaded
  const [departments, setDepartments] = useState(null)
  const [categories, setCategories] = useState(null)

  useEffect(() => { if (!siteId && sites.length) setSiteId(sites[0].id) }, [sites, siteId])

  const loadEquipment = useCallback(async () => {
    if (!siteId) return
    try { setEquipment(await getEquipmentMaster(siteId, true)) }
    catch (err) { setError(err?.response?.data?.error || err.message) }
  }, [siteId])
  const loadDepartments = useCallback(async () => {
    try { setDepartments(await getMasterList('department', true)) }
    catch (err) { setError(err?.response?.data?.error || err.message) }
  }, [])
  const loadCategories = useCallback(async () => {
    try { setCategories(await getMasterList('systemCategory', true)) }
    catch (err) { setError(err?.response?.data?.error || err.message) }
  }, [])

  useEffect(() => { loadEquipment() }, [loadEquipment])
  useEffect(() => { loadDepartments(); loadCategories() }, [loadDepartments, loadCategories])

  // ---- Excel template + bulk import ----
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function handleDownloadTemplate() {
    setError(null)
    try {
      const blob = await downloadMasterTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'MasterData_Template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  async function handleImport(ev) {
    const file = ev.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setError(null)
    try {
      const res = await importMasterData(file)
      setImportResult(res)
      await Promise.all([loadEquipment(), loadDepartments(), loadCategories()])
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const counts = {
    equipment: equipment?.filter((i) => i.isActive).length,
    department: departments?.filter((i) => i.isActive).length,
    systemCategory: categories?.filter((i) => i.isActive).length
  }
  const activeMeta = MENU.find((m) => m.key === active)

  return (
    <>
      <div className="card md-pagehead">
        <div>
          <h1 style={{ margin: 0 }}>Master Data</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            Controlled lists used across the portal. Sites pick from these; only corporate edits them.
            Retiring an item hides it from new entries without touching historical records.
          </p>
        </div>
        <div className="md-pagehead-actions">
          <button type="button" className="secondary" onClick={handleDownloadTemplate}>
            ⬇ Download template
          </button>
          <button type="button" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? 'Importing…' : '⬆ Import Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </div>

      {importResult && (
        <div className={`card md-import-result${importResult.errors?.length ? ' has-errors' : ''}`}>
          <strong>Import complete.</strong>{' '}
          Equipment: {importResult.equipmentAdded} added, {importResult.equipmentSkipped} already existed ·
          Departments: {importResult.departmentsAdded} added, {importResult.departmentsSkipped} existed ·
          Categories: {importResult.categoriesAdded} added, {importResult.categoriesUpdated} frequency updated, {importResult.categoriesSkipped} existed
          {importResult.errors?.length > 0 && (
            <ul className="md-import-errors">
              {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button type="button" className="qa-linkbtn" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="md-console">
        {/* ---------------- Left menu: one entry per master ---------------- */}
        <aside className="md-menu">
          {MENU.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`md-menu-item${active === m.key ? ' active' : ''}`}
              onClick={() => setActive(m.key)}
            >
              <span className="md-menu-label">{m.label}</span>
              <span className="md-menu-sub">{m.scope}</span>
              {counts[m.key] != null && <span className="md-menu-count">{counts[m.key]}</span>}
            </button>
          ))}
        </aside>

        {/* ---------------- Right panel: the selected master ---------------- */}
        <section className="md-panel card">
          <div className="md-panel-head">
            <div>
              <h2 style={{ margin: 0 }}>{activeMeta.label}</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>{activeMeta.desc}</p>
            </div>
          </div>

          {active === 'equipment' && (
            <EquipmentMaster
              sites={sites}
              siteId={siteId}
              setSiteId={setSiteId}
              items={equipment}
              reload={loadEquipment}
              onError={setError}
            />
          )}
          {active === 'department' && (
            <ListMaster
              items={departments}
              reload={loadDepartments}
              listKey="department"
              addPlaceholder="e.g. Microbiology"
              onError={setError}
            />
          )}
          {active === 'systemCategory' && (
            <ListMaster
              items={categories}
              reload={loadCategories}
              listKey="systemCategory"
              addPlaceholder="e.g. Critical / Category 5"
              withFrequency
              onError={setError}
            />
          )}
        </section>
      </div>
    </>
  )
}

/* ---------------- Shared bits ---------------- */
function StatusPill({ active }) {
  return (
    <span className={`md-pill ${active ? 'md-pill-active' : 'md-pill-retired'}`}>
      {active ? 'Active' : 'Retired'}
    </span>
  )
}

function Toolbar({ search, setSearch, showRetired, setShowRetired, retiredCount }) {
  return (
    <div className="md-toolbar">
      <input
        type="search"
        className="md-search"
        placeholder="Search…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <label className="md-check">
        <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
        Show retired{retiredCount ? ` (${retiredCount})` : ''}
      </label>
    </div>
  )
}

/* ---------------- Equipment / Instrument (per location) ---------------- */
function EquipmentMaster({ sites, siteId, setSiteId, items, reload, onError }) {
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    if (!items) return []
    const q = search.trim().toLowerCase()
    return items
      .filter((i) => (showRetired ? true : i.isActive))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
  }, [items, search, showRetired])

  const retiredCount = items?.filter((i) => !i.isActive).length ?? 0

  async function handleAdd() {
    if (!code.trim() || !name.trim()) { onError('Equipment ID and Name are both required.'); return }
    setBusy(true)
    onError(null)
    try {
      await createEquipment({ siteId, name: name.trim(), code: code.trim() })
      setName(''); setCode('')
      await reload()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally { setBusy(false) }
  }

  async function handleToggle(item) {
    onError(null)
    try { await toggleEquipment(item.id); await reload() }
    catch (err) { onError(err?.response?.data?.error || err.message) }
  }

  return (
    <>
      <div className="md-toolbar">
        <label className="md-inline">
          Location
          <select value={siteId ?? ''} onChange={(e) => setSiteId(Number(e.target.value))}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </label>
        <input
          type="search"
          className="md-search"
          placeholder="Search ID or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="md-check">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Show retired{retiredCount ? ` (${retiredCount})` : ''}
        </label>
      </div>

      {/* Add form */}
      <div className="md-addbar">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ID — e.g. EQP-1234" style={{ maxWidth: 180 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. HPLC-01 (Waters)" />
        <button type="button" disabled={busy} onClick={handleAdd}>{busy ? 'Adding…' : '+ Add equipment'}</button>
      </div>

      {!items ? (
        <Spinner label="Loading equipment…" />
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'No equipment matches the search.' : 'No equipment for this location yet — add the first above.'}</EmptyState>
      ) : (
        <table className="md-table">
          <thead>
            <tr><th style={{ width: 160 }}>ID</th><th>Name</th><th style={{ width: 90 }}>Status</th><th style={{ width: 110 }} /></tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.id} className={e.isActive ? '' : 'md-row-retired'}>
                <td><span className="md-code">{e.code}</span></td>
                <td>{e.name}</td>
                <td><StatusPill active={e.isActive} /></td>
                <td className="md-actions">
                  <button type="button" className="secondary" onClick={() => handleToggle(e)}>
                    {e.isActive ? 'Retire' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

/* ---------------- Generic list master (Department, System Category) ---------------- */
function ListMaster({ items, reload, listKey, addPlaceholder, withFrequency = false, onError }) {
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [value, setValue] = useState('')
  const [freq, setFreq] = useState('')
  const [busy, setBusy] = useState(false)
  const [freqEdits, setFreqEdits] = useState({})   // id -> draft frequency

  const visible = useMemo(() => {
    if (!items) return []
    const q = search.trim().toLowerCase()
    return items
      .filter((i) => (showRetired ? true : i.isActive))
      .filter((i) => !q || i.value.toLowerCase().includes(q))
  }, [items, search, showRetired])

  const retiredCount = items?.filter((i) => !i.isActive).length ?? 0

  async function handleAdd() {
    if (!value.trim()) return
    if (withFrequency && freq && (!Number.isInteger(Number(freq)) || Number(freq) < 1 || Number(freq) > 20)) {
      onError('Frequency must be a whole number of years (1–20).')
      return
    }
    setBusy(true)
    onError(null)
    try {
      await addMasterListItem(listKey, value.trim(), withFrequency && freq ? Number(freq) : null)
      setValue(''); setFreq('')
      await reload()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally { setBusy(false) }
  }

  async function handleToggle(item) {
    onError(null)
    try { await toggleMasterListItem(item.id); await reload() }
    catch (err) { onError(err?.response?.data?.error || err.message) }
  }

  async function applyFrequency(item) {
    const draft = freqEdits[item.id]
    const years = Number(draft)
    if (!Number.isInteger(years) || years < 1 || years > 20) {
      onError('Frequency must be a whole number of years (1–20).')
      return
    }
    onError(null)
    try {
      await setListItemFrequency(item.id, years)
      setFreqEdits((f) => { const n = { ...f }; delete n[item.id]; return n })
      await reload()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <Toolbar
        search={search} setSearch={setSearch}
        showRetired={showRetired} setShowRetired={setShowRetired}
        retiredCount={retiredCount}
      />

      <div className="md-addbar">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={addPlaceholder} />
        {withFrequency && (
          <input
            type="number" min="1" max="20"
            value={freq} onChange={(e) => setFreq(e.target.value)}
            placeholder="Freq (yrs)" style={{ maxWidth: 110 }}
            title="Periodic review frequency in years"
          />
        )}
        <button type="button" disabled={busy} onClick={handleAdd}>{busy ? 'Adding…' : '+ Add'}</button>
      </div>

      {!items ? (
        <Spinner label="Loading…" />
      ) : visible.length === 0 ? (
        <EmptyState>{search ? 'Nothing matches the search.' : 'Empty list — add the first item above.'}</EmptyState>
      ) : (
        <table className="md-table">
          <thead>
            <tr>
              <th>Value</th>
              {withFrequency && <th style={{ width: 220 }}>Review frequency</th>}
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => {
              const editing = freqEdits[i.id] !== undefined
              return (
                <tr key={i.id} className={i.isActive ? '' : 'md-row-retired'}>
                  <td>{i.value}</td>
                  {withFrequency && (
                    <td>
                      {editing ? (
                        <span className="md-freq-edit">
                          <input
                            type="number" min="1" max="20" autoFocus
                            value={freqEdits[i.id]}
                            onChange={(e) => setFreqEdits((f) => ({ ...f, [i.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyFrequency(i) }}
                          />
                          <button type="button" onClick={() => applyFrequency(i)}>✓</button>
                          <button type="button" className="secondary"
                            onClick={() => setFreqEdits((f) => { const n = { ...f }; delete n[i.id]; return n })}>✕</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="md-freq-value"
                          title="Click to edit frequency"
                          onClick={() => setFreqEdits((f) => ({ ...f, [i.id]: i.frequencyYears ?? '' }))}
                        >
                          {i.frequencyYears ? `Every ${i.frequencyYears} year${i.frequencyYears > 1 ? 's' : ''}` : 'Set frequency…'}
                        </button>
                      )}
                    </td>
                  )}
                  <td><StatusPill active={i.isActive} /></td>
                  <td className="md-actions">
                    <button type="button" className="secondary" onClick={() => handleToggle(i)}>
                      {i.isActive ? 'Retire' : 'Restore'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {withFrequency && (
        <p className="muted" style={{ marginBottom: 0, fontSize: 12.5 }}>
          The QA-IT register auto-computes each system's next planned review as
          base date + frequency; categories without a frequency don't auto-fill.
        </p>
      )}
    </>
  )
}
