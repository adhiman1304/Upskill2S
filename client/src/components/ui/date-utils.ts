// Local-time calendar helpers for DateField (kept out of .tsx files for react-refresh). Weeks start on Monday.

const pad = (value: number) => String(value).padStart(2, '0')

export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parses `YYYY-MM-DD` as a local date; null for empty or invalid input. */
export function fromIsoDate(value: string | null | undefined) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** "12 Nov 2026" */
export function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function sameDay(a: Date | null, b: Date | null) {
  return Boolean(a && b) && a!.getFullYear() === b!.getFullYear() && a!.getMonth() === b!.getMonth() && a!.getDate() === b!.getDate()
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Same day of month in another month, clamped to that month's last day. */
export function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last))
}

/** Weeks (Monday first) covering the month, including leading and trailing days of the neighbouring months. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const last = new Date(year, month + 1, 0)
  const weeks: Date[][] = []
  for (let cursor = start; cursor <= last || weeks.length === 0; ) {
    const week = Array.from({ length: 7 }, (_, index) => addDays(cursor, index))
    weeks.push(week)
    cursor = addDays(cursor, 7)
  }
  return weeks
}

export const weekdayLabels = [
  { short: 'Mo', long: 'Monday' },
  { short: 'Tu', long: 'Tuesday' },
  { short: 'We', long: 'Wednesday' },
  { short: 'Th', long: 'Thursday' },
  { short: 'Fr', long: 'Friday' },
  { short: 'Sa', long: 'Saturday' },
  { short: 'Su', long: 'Sunday' },
]
