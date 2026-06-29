import axios from 'axios'

// IMPORTANT: Vite bakes import.meta.env.* values in at BUILD time, not runtime.
// So VITE_API_BASE_URL must be set in Railway's frontend service variables
// BEFORE the build runs.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

// ---- Sites ----
export const getSites = () => api.get('/api/sites').then(r => r.data)
export const createSite = (site) => api.post('/api/sites', site).then(r => r.data)

// ---- Report Periods ----
export const getReportPeriods = () => api.get('/api/report-periods').then(r => r.data)
export const createReportPeriod = (period) => api.post('/api/report-periods', period).then(r => r.data)
export const lockReportPeriod = (id) => api.patch(`/api/report-periods/${id}/lock`).then(r => r.data)

// ---- Site Submissions ----
export const getSiteSubmissions = (reportPeriodId) =>
  api.get('/api/site-submissions', { params: { reportPeriodId } }).then(r => r.data)
export const markSiteSubmitted = (payload) =>
  api.post('/api/site-submissions', payload).then(r => r.data)

// ---- Training (sheet 1) ----
// ADDED: getTraining was missing — backend GET /api/training exists
export const getTraining = (siteId, reportPeriodId) =>
  api.get('/api/training', { params: { siteId, reportPeriodId } }).then(r => r.data)
export const saveTrainingBulk = (payload) =>
  api.post('/api/training/bulk', payload).then(r => r.data)
export const deleteTraining = (id) => api.delete(`/api/training/${id}`)

// ---- Initiatives (sheets 2-6) ----
// ADDED: getInitiatives was missing — backend GET /api/initiatives exists
export const getInitiatives = (siteId, reportPeriodId, type) =>
  api.get('/api/initiatives', { params: { siteId, reportPeriodId, type } }).then(r => r.data)
export const saveInitiativesBulk = (payload) =>
  api.post('/api/initiatives/bulk', payload).then(r => r.data)
export const deleteInitiative = (id) => api.delete(`/api/initiatives/${id}`)

// ---- Cost Savings (sheet 7) ----
// ADDED: getCostSavings was missing — backend GET /api/cost-savings exists
export const getCostSavings = (siteId, reportPeriodId) =>
  api.get('/api/cost-savings', { params: { siteId, reportPeriodId } }).then(r => r.data)
export const saveCostSavingsBulk = (payload) =>
  api.post('/api/cost-savings/bulk', payload).then(r => r.data)
export const deleteCostSaving = (id) => api.delete(`/api/cost-savings/${id}`)

// ---- Excel Import ----
export const importExcel = (siteId, reportPeriodId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/excel-import', formData, {
    params: { siteId, reportPeriodId },
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

// ---- Analytics ----
export const getInitiativeSummary = (reportPeriodId) =>
  api.get('/api/analytics/initiatives', { params: { reportPeriodId } }).then(r => r.data)
export const getTrainingSummary = (reportPeriodId) =>
  api.get('/api/analytics/training', { params: { reportPeriodId } }).then(r => r.data)
export const getCostSavingSummary = (reportPeriodId) =>
  api.get('/api/analytics/cost-savings', { params: { reportPeriodId } }).then(r => r.data)
export const getCostSavingTrend = (lastNMonths = 6) =>
  api.get('/api/analytics/cost-savings/trend', { params: { lastNMonths } }).then(r => r.data)
export const getGlobalReport = (reportPeriodId) =>
  api.get('/api/analytics/global-report', { params: { reportPeriodId } }).then(r => r.data)

export default api
