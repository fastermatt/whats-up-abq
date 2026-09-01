'use client'

import { createClient } from '@/lib/supabase/client'
import {
  getOrCreateSession,
  getOrCreateVisitorId,
  type SessionResult,
} from './session'

export { getOrCreateSession, getOrCreateVisitorId } from './session'

export interface AnalyticsContext {
  visitor_id: string
  session_id: string
}

let fallbackVisitorId: string | null = null
let fallbackSession: SessionResult | null = null

function createId(): string {
  return crypto.randomUUID()
}

function isExcluded(): boolean {
  try {
    return localStorage.getItem('_abq_no_track') === '1'
  } catch {
    return false
  }
}

export function getVisitorId(): string {
  try {
    return getOrCreateVisitorId(localStorage, createId)
  } catch {
    fallbackVisitorId ??= createId()
    return fallbackVisitorId
  }
}

function getSession(): SessionResult {
  const now = Date.now()
  try {
    return getOrCreateSession(sessionStorage, now, createId)
  } catch {
    const expired = !fallbackSession || now - fallbackSession.lastActiveAt > 30 * 60 * 1000
    if (expired || !fallbackSession) {
      fallbackSession = { id: createId(), lastActiveAt: now, isNew: true }
    } else {
      fallbackSession = { id: fallbackSession.id, lastActiveAt: now, isNew: false }
    }
    return fallbackSession
  }
}

export function getSessionId(): string {
  return getAnalyticsContext()?.session_id ?? getSession().id
}

export function getAnalyticsContext(): AnalyticsContext | null {
  if (typeof window === 'undefined' || isExcluded()) return null
  const visitorId = getVisitorId()
  const session = getSession()
  const context = { visitor_id: visitorId, session_id: session.id }
  if (session.isNew) {
    insertEvent('session_start', context, {
      referrer: document.referrer || null,
      path: window.location.pathname,
    })
  }
  return context
}

function getDevice(): 'mobile' | 'desktop' {
  return navigator.maxTouchPoints > 0 || window.innerWidth < 768 ? 'mobile' : 'desktop'
}

function insertEvent(
  eventType: string,
  context: AnalyticsContext,
  data: Record<string, unknown>,
): void {
  const supabase = createClient()
  void supabase
    .schema('public')
    .from('analytics')
    .insert({
      event_type: eventType,
      visitor_id: context.visitor_id,
      session_id: context.session_id,
      device: getDevice(),
      data: { ...data, user_agent: navigator.userAgent },
    })
    .then(() => undefined)
}

export function trackEvent(
  eventType: string,
  data: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined' || isExcluded()) return

  const visitorId = getVisitorId()
  const session = getSession()
  const context = { visitor_id: visitorId, session_id: session.id }

  if (session.isNew) {
    insertEvent('session_start', context, {
      referrer: document.referrer || null,
      path: window.location.pathname,
    })
  }
  if (eventType !== 'session_start') insertEvent(eventType, context, data)
}
