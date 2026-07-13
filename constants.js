// These mirror the backend enums exactly (Models/Enums.cs). Bulk-save endpoints
// match these against C#'s Enum.TryParse, so the `value` strings here must stay
// identical to the C# enum member names.

export const REPORT_PERIOD_STATUSES = {
  Open: 'Open',
  Submitted: 'Submitted',
  Locked: 'Locked'
}

// Lifecycle of one site's monthly submission (mirrors SubmissionStatus enum):
//  NotStarted -> Submitted -> Approved, or Submitted -> Returned -> Submitted...
export const SUBMISSION_STATUSES = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'Submitted', label: 'Awaiting review' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Returned', label: 'Returned for revision' }
]

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Looks up the friendly label for any of the status lists above.
export function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value
}

// CSS class suffix for the .status-* badge rules in index.css. Falls back to the raw value
// (e.g. "Proposed", "Planned", "OnHold") so badges still render sensibly for status values
// that don't have a dedicated color in the stylesheet.
export function statusBadgeClass(value) {
  return `status-badge status-${value}`
}

export function formatPeriodLabel(period) {
  if (!period) return ''
  return `${MONTH_NAMES[period.month - 1] ?? period.month} ${period.year}`
}
