const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < MINUTE) {
    return '刚刚'
  }

  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE)
    return `${minutes} 分钟前`
  }

  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return `${hours} 小时前`
  }

  if (diff < WEEK) {
    const days = Math.floor(diff / DAY)
    return `${days} 天前`
  }

  return new Date(timestamp).toLocaleDateString('zh-CN')
}

export function formatDuration(ms: number): string {
  if (ms < SECOND) {
    return `${ms}ms`
  }

  if (ms < MINUTE) {
    return `${(ms / SECOND).toFixed(1)}s`
  }

  const minutes = Math.floor(ms / MINUTE)
  const seconds = Math.floor((ms % MINUTE) / SECOND)
  return `${minutes}m ${seconds}s`
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
