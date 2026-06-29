import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSites, getReportPeriods } from '../client'

const AppContext = createContext(null)

const SITE_STORAGE_KEY = 'qms.selectedSiteId'
const PERIOD_STORAGE_KEY = 'qms.selectedPeriodId'

export function AppProvider({ children }) {
  const [sites, setSites] = useState([])
  const [reportPeriods, setReportPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedSiteId, setSelectedSiteIdState] = useState(() => {
    const stored = localStorage.getItem(SITE_STORAGE_KEY)
    return stored ? Number(stored) : null
  })
  const [selectedPeriodId, setSelectedPeriodIdState] = useState(() => {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY)
    return stored ? Number(stored) : null
  })

  const setSelectedSiteId = useCallback((id) => {
    setSelectedSiteIdState(id)
    if (id) localStorage.setItem(SITE_STORAGE_KEY, String(id))
    else localStorage.removeItem(SITE_STORAGE_KEY)
  }, [])

  const setSelectedPeriodId = useCallback((id) => {
    setSelectedPeriodIdState(id)
    if (id) localStorage.setItem(PERIOD_STORAGE_KEY, String(id))
    else localStorage.removeItem(PERIOD_STORAGE_KEY)
  }, [])

  const refreshSites = useCallback(async () => {
    const data = await getSites()
    setSites(data)
    return data
  }, [])

  const refreshReportPeriods = useCallback(async () => {
    const data = await getReportPeriods()
    setReportPeriods(data)
    return data
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [siteData, periodData] = await Promise.all([getSites(), getReportPeriods()])
      setSites(siteData)
      setReportPeriods(periodData)
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load sites/report periods.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Once data has loaded, make sure the selection still points at something real;
  // otherwise default to the first site and the most recent (already-sorted) period.
  useEffect(() => {
    if (loading) return
    if (sites.length > 0 && !sites.some((s) => s.id === selectedSiteId)) {
      setSelectedSiteId(sites[0].id)
    }
    if (reportPeriods.length > 0 && !reportPeriods.some((p) => p.id === selectedPeriodId)) {
      setSelectedPeriodId(reportPeriods[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sites, reportPeriods])

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId]
  )
  const selectedPeriod = useMemo(
    () => reportPeriods.find((p) => p.id === selectedPeriodId) || null,
    [reportPeriods, selectedPeriodId]
  )
  const isPeriodLocked = selectedPeriod?.status === 'Locked'

  const value = {
    sites,
    reportPeriods,
    loading,
    error,
    selectedSiteId,
    setSelectedSiteId,
    selectedPeriodId,
    setSelectedPeriodId,
    selectedSite,
    selectedPeriod,
    isPeriodLocked,
    refreshSites,
    refreshReportPeriods
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within an AppProvider')
  return ctx
}
