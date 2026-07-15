import React, { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  createSite,
  createReportPeriod,
  lockReportPeriod,
  getUsers,
  createUser,
  toggleUserActive,
  resetUserPassword,
  getEquipmentMaster,
  createEquipment,
  toggleEquipment,
  getMasterList,
  addMasterListItem,
  toggleMasterListItem,
  setListItemFrequency,
  getReminderSettings,
  updateReminderSettings,
  sendTestEmail,
  runRemindersNow,
  setUserEmail
} from '../client'
import { formatPeriodLabel, MONTH_NAMES } from '../../constants'
import StatusBadge from '../StatusBadge'
import { Spinner, ErrorBanner, EmptyState } from '../components/Feedback'

const now = new Date()

// Corporate-only admin: manage sites, report periods, and the site/corporate
// logins. Submission review lives on the Corporate Review page.
export default function SitesAndPeriodsPage() {
  const { sites, reportPeriods, loading, refreshSites, refreshReportPeriods } = useAppContext()

  const [error, setError] = useState(null)

  // ---- New site form ----
  const [siteName, setSiteName] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [savingSite, setSavingSite] = useState(false)

  async function handleCreateSite() {
    if (!siteName.trim() || !siteCode.trim()) {
      setError('Site name and code are both required.')
      return
    }
    setSavingSite(true)
    setError(null)
    try {
      await createSite({ name: siteName.trim(), code: siteCode.trim(), isActive: true })
      setSiteName('')
      setSiteCode('')
      await refreshSites()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSavingSite(false)
    }
  }

  // ---- New period form ----
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [savingPeriod, setSavingPeriod] = useState(false)

  async function handleCreatePeriod() {
    setSavingPeriod(true)
    setError(null)
    try {
      await createReportPeriod({ month: Number(month), year: Number(year) })
      await refreshReportPeriods()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setSavingPeriod(false)
    }
  }

  async function handleLock(id) {
    const period = reportPeriods.find((p) => p.id === id)
    const label = period ? formatPeriodLabel(period) : 'this period'
    if (!window.confirm(`Lock ${label}? Once locked, no further data can be entered or deleted for it.`)) return
    setError(null)
    try {
      await lockReportPeriod(id)
      await refreshReportPeriods()
    } catch (err) {
      setError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <>
      <ErrorBanner message={error} />

      {loading && <Spinner label="Loading sites and periods…" />}

      <div className="grid-2">
        {/* ---------------- Sites ---------------- */}
        <div className="card">
          <h2>Sites</h2>
          {sites.length === 0 ? (
            <EmptyState>No sites yet. Add the first one below.</EmptyState>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th style={{ width: 110 }}>Code</th></tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id}><td>{s.name}</td><td>{s.code}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginBottom: 8 }}>Add a site</h3>
          <div className="row">
            <label className="picker-label">
              Name
              <input type="text" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Plant North" />
            </label>
            <label className="picker-label">
              Code
              <input type="text" value={siteCode} onChange={(e) => setSiteCode(e.target.value)} placeholder="e.g. SITE-A" />
            </label>
            <button disabled={savingSite} onClick={handleCreateSite} style={{ alignSelf: 'flex-end' }}>
              {savingSite ? 'Adding…' : 'Add site'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Codes must be unique. After adding a site, create a login for it below so the site team can sign in.
          </p>
        </div>

        {/* ---------------- Report periods ---------------- */}
        <div className="card">
          <h2>Report periods</h2>
          {reportPeriods.length === 0 ? (
            <EmptyState>No report periods yet. Create one below.</EmptyState>
          ) : (
            <table>
              <thead>
                <tr><th>Period</th><th style={{ width: 110 }}>Status</th><th style={{ width: 80 }}></th></tr>
              </thead>
              <tbody>
                {reportPeriods.map((p) => (
                  <tr key={p.id}>
                    <td>{formatPeriodLabel(p)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      {p.status !== 'Locked' ? (
                        <button className="secondary" onClick={() => handleLock(p.id)}>Lock</button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginBottom: 8 }}>Create a period</h3>
          <div className="row">
            <label className="picker-label">
              Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
            </label>
            <label className="picker-label">
              Year
              <input type="number" value={year} min="2000" max="2100" onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} />
            </label>
            <button disabled={savingPeriod} onClick={handleCreatePeriod} style={{ alignSelf: 'flex-end' }}>
              {savingPeriod ? 'Saving…' : 'Create period'}
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Creating an existing month/year just returns the existing period.
            Review and approve submissions on the Corporate Review page.
          </p>
        </div>
      </div>

      <MasterDataPanel sites={sites} onError={setError} />

      <ReminderSettingsPanel onError={setError} />

      <UserManagementPanel sites={sites} onError={setError} />
    </>
  )
}

// ---- Logins for sites and corporate reviewers ----
function UserManagementPanel({ sites, onError }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('SiteUser')
  const [userSiteId, setUserSiteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsers(await getUsers())
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    onError(null)
    setNotice(null)
    if (!username.trim() || !password) {
      onError('Username and password are required for a new login.')
      return
    }
    if (role === 'SiteUser' && !userSiteId) {
      onError('Pick which site this login belongs to.')
      return
    }
    setSaving(true)
    try {
      const created = await createUser({
        username: username.trim(),
        displayName: displayName.trim() || username.trim(),
        email: email.trim() || null,
        password,
        role,
        siteId: role === 'SiteUser' ? Number(userSiteId) : null
      })
      setNotice(`Login '${created.username}' created. Share the username and password with the ${role === 'SiteUser' ? 'site' : 'corporate'} team securely.`)
      setUsername('')
      setDisplayName('')
      setEmail('')
      setPassword('')
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(u) {
    const verb = u.isActive ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${verb} the login '${u.username}'?`)) return
    onError(null)
    try {
      await toggleUserActive(u.id)
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  async function handleSetEmail(u) {
    const email = window.prompt(`Email for '${u.username}' (blank to remove):`, u.email || '')
    if (email === null) return
    onError(null)
    try {
      await setUserEmail(u.id, email.trim() || null)
      setNotice(`Email for '${u.username}' updated.`)
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  async function handleResetPassword(u) {
    const newPassword = window.prompt(`New password for '${u.username}' (min 8 characters):`)
    if (!newPassword) return
    onError(null)
    try {
      await resetUserPassword(u.id, newPassword)
      setNotice(`Password for '${u.username}' has been reset.`)
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }

  return (
    <div className="card">
      <h2>User logins</h2>
      <p className="muted">
        Each site signs in with its own account and can only see and submit its own data.
        Corporate accounts review submissions across all sites.
      </p>

      {notice && <div className="success-banner">{notice}</div>}

      {loading ? (
        <Spinner label="Loading users…" />
      ) : users.length === 0 ? (
        <EmptyState>No logins yet.</EmptyState>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Site</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 230 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>{u.email || <span className="muted">—</span>}</td>
                <td>
                  <span className={`role-chip ${u.role === 'Corporate' ? 'role-corporate' : 'role-site'}`}>
                    {u.role === 'Corporate' ? 'Corporate' : 'Site user'}
                  </span>
                </td>
                <td>{u.siteName ? `${u.siteName} (${u.siteCode})` : <span className="muted">All sites</span>}</td>
                <td>
                  {u.isActive
                    ? <span className="status-badge status-Open">Active</span>
                    : <span className="status-badge status-NotStarted">Inactive</span>}
                </td>
                <td>
                  <div className="row" style={{ marginBottom: 0, gap: 6 }}>
                    <button className="secondary" onClick={() => handleSetEmail(u)}>Email</button>
                    <button className="secondary" onClick={() => handleResetPassword(u)}>Reset password</button>
                    <button className="secondary" onClick={() => handleToggleActive(u)}>
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginBottom: 8 }}>Create a login</h3>
      <div className="row">
        <label className="picker-label">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="SiteUser">Site user</option>
            <option value="Corporate">Corporate</option>
          </select>
        </label>
        {role === 'SiteUser' && (
          <label className="picker-label">
            Site
            <select value={userSiteId} onChange={(e) => setUserSiteId(e.target.value)}>
              <option value="">— pick a site —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </label>
        )}
        <label className="picker-label">
          Username
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. site.north" />
        </label>
        <label className="picker-label">
          Display name
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Plant North QA" />
        </label>
        <label className="picker-label">
          Email (for reminders)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. qa.north@company.com" />
        </label>
        <label className="picker-label">
          Password
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" />
        </label>
        <button disabled={saving} onClick={handleCreate} style={{ alignSelf: 'flex-end' }}>
          {saving ? 'Creating…' : 'Create login'}
        </button>
      </div>
    </div>
  )
}

/* ==================== Master data (QA-IT Compliance) ==================== */
// Equipment/Instrument per site + the Department/Area and System Category
// controlled lists. Items are retired (deactivated), never hard-deleted, so
// historical registers keep their values.
function MasterDataPanel({ sites, onError }) {
  return (
    <div className="card">
      <h2>Master data</h2>
      <p className="muted">
        Controlled lists used by QA-IT Compliance. Sites pick from these; only corporate edits them.
        Retiring an item hides it from new entries without touching historical registers.
      </p>
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

/* ==================== QA-IT reminder notifications ==================== */
function ReminderSettingsPanel({ onError }) {
  const [settings, setSettings] = useState(null)
  const [leadDays, setLeadDays] = useState(15)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      const s = await getReminderSettings()
      setSettings(s)
      setLeadDays(s.leadDays)
      setEnabled(s.enabled)
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    }
  }, [onError])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    setNotice(null)
    onError(null)
    try {
      await updateReminderSettings({ enabled, leadDays: Number(leadDays) })
      setNotice('Reminder settings saved.')
      await load()
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testTo.trim()) { onError('Enter an address for the test email.'); return }
    setBusy(true)
    setNotice(null)
    onError(null)
    try {
      await sendTestEmail(testTo.trim())
      setNotice(`Test email sent to ${testTo.trim()}.`)
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRunNow() {
    setBusy(true)
    setNotice(null)
    onError(null)
    try {
      await runRemindersNow()
      setNotice('Reminder scan completed — due reminders (if any) have been emailed.')
    } catch (err) {
      onError(err?.response?.data?.error || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Email reminders — QA-IT periodic reviews</h2>
      <p className="muted">
        Site users with an email address receive one consolidated reminder per location when
        systems approach their planned review month, and an alert when the window
        (planned month +2 months) has passed with no review recorded.
      </p>

      {settings && !settings.smtpConfigured && (
        <p className="warning-box">
          SMTP is not configured — reminders cannot be sent. Set the backend env vars:
          SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optionally SMTP_FROM), then redeploy.
        </p>
      )}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="picker-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 'auto' }} />
          Reminders enabled
        </label>
        <label className="picker-label">
          Send reminder X days before the scheduled month
          <input type="number" min="0" max="365" value={leadDays}
            onChange={(e) => setLeadDays(e.target.value)} style={{ width: 110 }} />
        </label>
        <button type="button" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <div className="row" style={{ marginTop: 8, marginBottom: 0, alignItems: 'flex-end' }}>
        <label className="picker-label">
          Test email to
          <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@company.com" />
        </label>
        <button type="button" className="secondary" disabled={busy || !settings?.smtpConfigured} onClick={handleTest}>
          Send test email
        </button>
        <button type="button" className="secondary" disabled={busy || !settings?.smtpConfigured} onClick={handleRunNow}
          title="Scan the registers immediately instead of waiting for the 6-hourly run">
          Run reminder scan now
        </button>
      </div>
    </div>
  )
}
