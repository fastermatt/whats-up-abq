import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getOrCreateSession,
  getOrCreateVisitorId,
  SESSION_STORAGE_KEY,
  SESSION_TIMEOUT_MS,
  type StorageLike,
} from './session.ts'

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

test('visitor id persists for the browser install', () => {
  const storage = new MemoryStorage()
  let generated = 0
  const createId = () => `visitor-${++generated}`

  assert.equal(getOrCreateVisitorId(storage, createId), 'visitor-1')
  assert.equal(getOrCreateVisitorId(storage, createId), 'visitor-1')
  assert.equal(generated, 1)
})

test('session id persists and activity extends the 30-minute window', () => {
  const storage = new MemoryStorage()
  let generated = 0
  const createId = () => `session-${++generated}`

  const first = getOrCreateSession(storage, 1_000, createId)
  const active = getOrCreateSession(storage, 1_000 + SESSION_TIMEOUT_MS, createId)

  assert.deepEqual(first, { id: 'session-1', lastActiveAt: 1_000, isNew: true })
  assert.deepEqual(active, {
    id: 'session-1',
    lastActiveAt: 1_000 + SESSION_TIMEOUT_MS,
    isNew: false,
  })
  assert.equal(generated, 1)
})

test('session id rotates after more than 30 minutes idle', () => {
  const storage = new MemoryStorage()
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: 'old', lastActiveAt: 1_000 }))

  const rotated = getOrCreateSession(storage, 1_001 + SESSION_TIMEOUT_MS, () => 'new')

  assert.deepEqual(rotated, {
    id: 'new',
    lastActiveAt: 1_001 + SESSION_TIMEOUT_MS,
    isNew: true,
  })
})

test('corrupt session storage mints a clean session', () => {
  const storage = new MemoryStorage()
  storage.setItem(SESSION_STORAGE_KEY, '{broken')

  assert.deepEqual(getOrCreateSession(storage, 42, () => 'replacement'), {
    id: 'replacement',
    lastActiveAt: 42,
    isNew: true,
  })
})
