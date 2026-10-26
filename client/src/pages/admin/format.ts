const numberFormat = new Intl.NumberFormat()

export function formatNumber(value: number | null | undefined) { return value === null || value === undefined ? '—' : numberFormat.format(value) }

export function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatRelative(value: string | null, now = Date.now()) {
  if (!value) return 'never'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return 'unknown'
  const seconds = Math.round((now - time) / 1000)
  const future = seconds < 0
  const abs = Math.abs(seconds)
  const text = abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.floor(abs / 60)}m` : abs < 86400 ? `${Math.floor(abs / 3600)}h` : `${Math.floor(abs / 86400)}d`
  return future ? `in ${text}` : `${text} ago`
}

export function formatDuration(startedAt: string | null, finishedAt: string | null, now = Date.now()) {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : now
  if (Number.isNaN(start) || Number.isNaN(end)) return '—'
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
