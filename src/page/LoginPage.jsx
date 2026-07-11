import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Single sign-in screen for both audiences: site users land in their own
// site's workspace; corporate users land on the review dashboard.
export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to sign in. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">QMS</div>
          <h1>Site Reporting Portal</h1>
          <p className="muted">
            Sign in with your site account to enter and submit your monthly data,
            or with a corporate account to review and collate submissions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="picker-label">
            Username
            <input
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. site.north or admin"
            />
          </label>

          <label className="picker-label">
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </label>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <button type="submit" disabled={busy} className="login-button">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted login-footnote">
          Don't have an account? Site logins are created by the corporate team.
        </p>
      </div>
    </div>
  )
}
