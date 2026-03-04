const MOCK_QUERY_KEY = 'mockApi'
const MOCK_STORAGE_KEY = 'vitamin:webui:use-mock-api'

function parseBooleanLike(value: string | null): boolean | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
    return true
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
    return false
  }
  return null
}

function readFromUrl(): boolean | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = new URLSearchParams(window.location.search).get(MOCK_QUERY_KEY)
  return parseBooleanLike(value)
}

function readFromStorage(): boolean | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.localStorage.getItem(MOCK_STORAGE_KEY)
  return parseBooleanLike(value)
}

export function isMockApiEnabled(): boolean {
  const byUrl = readFromUrl()
  if (byUrl !== null) {
    return byUrl
  }

  const byStorage = readFromStorage()
  if (byStorage !== null) {
    return byStorage
  }

  return true
}

export function getMockApiStorageKey(): string {
  return MOCK_STORAGE_KEY
}

export function setMockApiEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(MOCK_STORAGE_KEY, enabled ? '1' : '0')
}
