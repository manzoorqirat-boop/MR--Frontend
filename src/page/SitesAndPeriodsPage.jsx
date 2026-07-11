import React, { useCallback, useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import {
  createSite,
  createReportPeriod,
  lockReportPeriod,
  getUsers,
  createUser,
  toggleUserActive,
  resetUserPassword
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
        password,
        role,
        siteId: role === 'SiteUser' ? Number(userSiteId) : null
      })
      setNotice(`Login '${created.username}' created. Share the username and password with the ${role === 'SiteUser' ? 'site' : 'corporate'} team securely.`)
      setUsername('')
      setDisplayName('')
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
