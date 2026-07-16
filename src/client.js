import axios from 'axios'

// IMPORTANT: Vite bakes import.meta.env.* values in at BUILD time, not runtime.
// So VITE_API_BASE_URL must be set in Railway's frontend service variables
// BEFORE the build runs.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

// ---- Auth token handling ----
// The JWT is stored by AuthContext; every request carries it. A 401 anywhere
// (expired/invalid token) broadcasts an event so AuthContext can log out cleanly.
export const TOKEN_STORAGE_KEY = 'qms.authToken'

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error.config?.url?.includes('/api/auth/login')) {
      window.dispatchEvent(new Event('qms:unauthorized'))
    }
    return Promise.reject(error)
  }
)

// ---- Auth ----
export const login = (username, password) =>
  api.post('/api/auth/login', { username, password }).then(r => r.data)
export const getMe = () => api.get('/api/auth/me').then(r => r.data)
export const getUsers = () => api.get('/api/auth/users').then(r => r.data)
export const createUser = (payload) => api.post('/api/auth/users', payload).then(r => r.data)
export const toggleUserActive = (id) => api.patch(`/api/auth/users/${id}/toggle-active`).then(r => r.data)
export const resetUserPassword = (id, newPassword) =>
  api.patch(`/api/auth/users/${id}/password`, { newPassword }).then(r => r.data)

// ---- Sites ----
export const getSites = () => api.get('/api/sites').then(r => r.data)
export const createSite = (site) => api.post('/api/sites', site).then(r => r.data)

// ---- Report Periods ----
export const getReportPeriods = () => api.get('/api/report-periods').then(r => r.data)
export const createReportPeriod = (period) => api.post('/api/report-periods', period).then(r => r.data)
export const lockReportPeriod = (id) => api.patch(`/api/report-periods/${id}/lock`).then(r => r.data)

// ---- Site Submissions (submit -> corporate review workflow) ----
export const getSiteSubmissions = (reportPeriodId) =>
  api.get('/api/site-submissions', { params: { reportPeriodId } }).then(r => r.data)
// Site submits its month to corporate: { siteId, reportPeriodId }
export const submitToCorporate = (payload) =>
  api.post('/api/site-submissions/submit', payload).then(r => r.data)
// Corporate decision: decision = 'Approve' | 'Return', comments required on return
export const reviewSubmission = (submissionId, decision, comments) =>
  api.post(`/api/site-submissions/${submissionId}/review`, { decision, comments }).then(r => r.data)
// Corporate review grid: every site's workflow state + data counts for a period
export const getSubmissionOverview = (reportPeriodId) =>
  api.get('/api/site-submissions/overview', { params: { reportPeriodId } }).then(r => r.data)

// ---- Schema (definitions for all 20 metric sheets) ----
// The backend serializes column Type as PascalCase ("Number", "Computed");
// the UI compares lowercase everywhere, so normalize once here.
const normalizeSchema = (schema) =>
  schema.map((m) => ({
    ...m,
    columns: m.columns.map((c) => ({ ...c, type: String(c.type || '').toLowerCase() }))
  }))

export const getScorecardSchema = () =>
  api.get('/api/scorecard/schema').then(r => normalizeSchema(r.data))

// ---- Data entry ----
export const getScorecardRows = (siteId, reportPeriodId, metricKey) =>
  api.get('/api/scorecard/rows', { params: { siteId, reportPeriodId, metricKey } }).then(r => r.data)

// payload: { siteId, reportPeriodId, metricKey, rows: [{ rowIndex, cells: { colKey: value } }] }
// Replace semantics: the posted rows fully define that metric for the site/period.
export const saveScorecardRows = (payload) =>
  api.post('/api/scorecard/rows', payload).then(r => r.data)

// Row counts per metric for a site/period (drives the "filled sheets" checklist).
export const getScorecardStatus = (siteId, reportPeriodId) =>
  api.get('/api/scorecard/status', { params: { siteId, reportPeriodId } }).then(r => r.data)

// ---- Template download (blank .xlsx, one tab per metric) ----
export const downloadScorecardTemplate = () =>
  api.get('/api/scorecard/template', { responseType: 'blob' }).then(r => r.data)

// ---- Excel import ----
export const importScorecard = (siteId, reportPeriodId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/api/scorecard/import', formData, {
    params: { siteId, reportPeriodId },
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

// ---- Analytics ----
// body: { metricKey, columnKey?, fromYear, fromMonth, toYear, toMonth, siteIds?, granularity }
// Returns flat points: [{ siteId, siteName, reportPeriodId, periodLabel, year, month, metricKey, columnKey, value }]
export const getScorecardAnalytics = (query) =>
  api.post('/api/scorecard/analytics', query).then(r => r.data)

export default api

// ---- QA-IT Compliance: periodic review register (per site per year) ----
export const getQaItRegister = (siteId, year) =>
  api.get('/api/qa-it/periodic-reviews', { params: { siteId, year } }).then(r => r.data)
export const saveQaItRegister = (payload) =>
  api.post('/api/qa-it/periodic-reviews/save', payload).then(r => r.data)

// ---- Master data (equipment per site + controlled lists) ----
export const getEquipmentMaster = (siteId, includeInactive = false) =>
  api.get('/api/master/equipment', { params: { siteId, includeInactive } }).then(r => r.data)
export const createEquipment = (payload) =>
  api.post('/api/master/equipment', payload).then(r => r.data)
export const toggleEquipment = (id) =>
  api.patch(`/api/master/equipment/${id}/toggle-active`).then(r => r.data)
export const getMasterList = (key, includeInactive = false) =>
  api.get(`/api/master/lists/${key}`, { params: { includeInactive } }).then(r => r.data)
export const addMasterListItem = (key, value, frequencyYears = null) =>
  api.post(`/api/master/lists/${key}`, { value, frequencyYears }).then(r => r.data)
export const setListItemFrequency = (id, frequencyYears) =>
  api.patch(`/api/master/lists/items/${id}/frequency`, { frequencyYears }).then(r => r.data)
export const toggleMasterListItem = (id) =>
  api.patch(`/api/master/lists/items/${id}/toggle-active`).then(r => r.data)

// ---- QA-IT reminder notifications (corporate) ----
export const getReminderSettings = () =>
  api.get('/api/settings/qa-it-reminder').then(r => r.data)
export const updateReminderSettings = (payload) =>
  api.put('/api/settings/qa-it-reminder', payload).then(r => r.data)
export const sendTestEmail = (to) =>
  api.post('/api/settings/qa-it-reminder/test', { to }).then(r => r.data)
export const runRemindersNow = () =>
  api.post('/api/settings/qa-it-reminder/run-now').then(r => r.data)
export const setUserEmail = (id, email) =>
  api.patch(`/api/auth/users/${id}/email`, { email }).then(r => r.data)

// ---- Master data: Excel template + bulk import ----
export const downloadMasterTemplate = () =>
  api.get('/api/master/template', { responseType: 'blob' }).then(r => r.data)
export const importMasterData = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/master/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}
