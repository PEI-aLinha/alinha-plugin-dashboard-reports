import { TIME_ZONE } from '@alinha/plugin-sdk'

/** What the person chose in the history filters. Empty values mean "no filter". */
export interface HistoryFilters {
  /** Entity type code, or 'all'. */
  entityType: string
  /** 'all', 'me' (the person signed in) or 'system'. */
  actor: 'all' | 'me' | 'system'
  /** Calendar days from `<input type="date">` (YYYY-MM-DD), both inclusive. */
  fromDay: string
  toDay: string
}

export const NO_FILTERS: HistoryFilters = { entityType: 'all', actor: 'all', fromDay: '', toDay: '' }

/** Rows per page. The contract allows up to 100. */
export const PAGE_SIZE = 20

/** Whether any filter is set (drives the "nothing matches" empty state). */
export function isFiltered(f: HistoryFilters): boolean {
  return f.entityType !== NO_FILTERS.entityType || f.actor !== NO_FILTERS.actor || f.fromDay !== '' || f.toDay !== ''
}

/** True when the "until" day is before the "from" day: the API would answer 400, so the page says so instead. */
export function invalidRange(f: HistoryFilters): boolean {
  return f.fromDay !== '' && f.toDay !== '' && f.toDay < f.fromDay
}

/**
 * Query string for `GET /api/audit/events`. Days are calendar days in Lisbon, the zone the table shows times in
 * (`TIME_ZONE`), whatever the browser's zone: "from" starts at that day's midnight, and "until" includes the whole
 * day, so it becomes the next day's midnight (the API's `to` is exclusive).
 */
export function historyQuery(f: HistoryFilters, page: number, myId: string | null): string {
  const q = new URLSearchParams()
  if (f.entityType !== 'all') q.set('entityType', f.entityType)
  if (f.actor === 'system') q.set('actor', 'system')
  if (f.actor === 'me' && myId) q.set('actor', myId)
  if (f.fromDay) q.set('from', startOfDay(f.fromDay, 0).toISOString())
  if (f.toDay) q.set('to', startOfDay(f.toDay, 1).toISOString())
  if (page > 0) q.set('page', String(page))
  q.set('pageSize', String(PAGE_SIZE))
  return q.toString()
}

/** Midnight in `TIME_ZONE` of `day` (YYYY-MM-DD) plus `addDays`, as an instant. */
export function startOfDay(day: string, addDays = 0): Date {
  const [y, m, d] = day.split('-').map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d + addDays)
  // Local midnight = UTC midnight minus the zone's offset. Lisbon changes its offset at 01:00 UTC, never around
  // midnight, but the second pass keeps this right for any zone whose offset differs at the two instants.
  let instant = utcMidnight - offsetMs(utcMidnight)
  instant = utcMidnight - offsetMs(instant)
  return new Date(instant)
}

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })

/** Offset of `TIME_ZONE` from UTC at `instant`, in ms ("GMT+01:00" → 3 600 000; "GMT" → 0). */
function offsetMs(instant: number): number {
  const name = offsetFormat.formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
  if (!match) return 0
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '-' ? -1 : 1) * minutes * 60_000
}
