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

/** True when the "until" day is before the "from" day: the API would answer 400, so the page says so instead. */
export function invalidRange(f: HistoryFilters): boolean {
  return f.fromDay !== '' && f.toDay !== '' && f.toDay < f.fromDay
}

/**
 * Query string for `GET /api/audit/events`. Days are the person's calendar days: "from" starts at local midnight,
 * and "until" includes the whole day, so it becomes the next day's midnight (the API's `to` is exclusive).
 */
export function historyQuery(f: HistoryFilters, page: number, myId: string | null): string {
  const q = new URLSearchParams()
  if (f.entityType !== 'all') q.set('entityType', f.entityType)
  if (f.actor === 'system') q.set('actor', 'system')
  if (f.actor === 'me' && myId) q.set('actor', myId)
  if (f.fromDay) q.set('from', startOfDay(f.fromDay).toISOString())
  if (f.toDay) {
    const end = startOfDay(f.toDay)
    end.setDate(end.getDate() + 1)
    q.set('to', end.toISOString())
  }
  if (page > 0) q.set('page', String(page))
  q.set('pageSize', String(PAGE_SIZE))
  return q.toString()
}

function startOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
