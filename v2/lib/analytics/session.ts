export const VISITOR_STORAGE_KEY = '_abq_sid'
export const SESSION_STORAGE_KEY = '_abq_sess'
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AnalyticsSession {
  id: string
  lastActiveAt: number
}

export interface SessionResult extends AnalyticsSession {
  isNew: boolean
}

export function getOrCreateVisitorId(
  storage: StorageLike,
  createId: () => string,
): string {
  const existing = storage.getItem(VISITOR_STORAGE_KEY)
  if (existing) return existing

  const visitorId = createId()
  storage.setItem(VISITOR_STORAGE_KEY, visitorId)
  return visitorId
}

function parseSession(raw: string | null): AnalyticsSession | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsSession>
    if (typeof parsed.id !== 'string' || !parsed.id) return null
    if (typeof parsed.lastActiveAt !== 'number' || !Number.isFinite(parsed.lastActiveAt)) return null
    return { id: parsed.id, lastActiveAt: parsed.lastActiveAt }
  } catch {
    return null
  }
}

export function getOrCreateSession(
  storage: StorageLike,
  now: number,
  createId: () => string,
): SessionResult {
  const existing = parseSession(storage.getItem(SESSION_STORAGE_KEY))
  const expired = existing ? now - existing.lastActiveAt > SESSION_TIMEOUT_MS : true
  const session: SessionResult = existing && !expired
    ? { id: existing.id, lastActiveAt: now, isNew: false }
    : { id: createId(), lastActiveAt: now, isNew: true }

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    id: session.id,
    lastActiveAt: session.lastActiveAt,
  }))
  return session
}
