import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { login as apiLogin, getMe, TOKEN_STORAGE_KEY } from '../client'

// Holds the logged-in user: { id, username, displayName, role, siteId, siteName, siteCode }
// role is 'SiteUser' (bound to one site) or 'Corporate' (reviews all sites).
const AuthContext = createContext(null)

const USER_STORAGE_KEY = 'qms.authUser'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  // While true we're re-validating a stored token against /api/auth/me.
  const [initializing, setInitializing] = useState(() => !!localStorage.getItem(TOKEN_STORAGE_KEY))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setUser(null)
  }, [])

  const login = useCallback(async (username, password) => {
    const { token, user: loggedIn } = await apiLogin(username, password)
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedIn))
    setUser(loggedIn)
    return loggedIn
  }, [])

  // Re-validate a stored token on load so a stale/expired session doesn't
  // render the app and then fail on every request.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
      setInitializing(false)
      return
    }
    let cancelled = false
    getMe()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me))
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Any API call returning 401 logs the session out (see client.js interceptor).
  useEffect(() => {
    const onUnauthorized = () => logout()
    window.addEventListener('qms:unauthorized', onUnauthorized)
    return () => window.removeEventListener('qms:unauthorized', onUnauthorized)
  }, [logout])

  const isCorporate = user?.role === 'Corporate'

  return (
    <AuthContext.Provider value={{ user, isCorporate, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
