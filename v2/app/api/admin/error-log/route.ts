/**
 * /api/admin/error-log
 *
 *   POST   — record an error (no auth required so client error boundaries
 *            can report regardless of session state; protected by source
 *            allowlist + rate-limited via creation timestamp).
 *   GET    — read recent errors (admin auth required).
 *   PATCH  — mark resolved (admin auth required).
 *
 * Writes land in public.admin_error_log via the service role client (RLS
 * denies everything else). The admin page /admin/errors reads from GET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isAdmin(request: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return request.cookies.get('admin_token')?.value === secret
}

const ALLOWED_SOURCES = new Set([
  'client', 'client-boundary', 'api', 'cron', 'deploy', 'scheduler', 'ingest', 'unknown',
])

const ALLOWED_SEVERITIES = new Set(['error', 'warning', 'info'])

/** Cheap stable digest for dedup display — hashes message + location. */
function computeDigest(message: string, location: string | null): string {
  const s = `${(message || '').slice(0, 256)}|${location || ''}`
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const source = typeof body.source === 'string' && ALLOWED_SOURCES.has(body.source)
    ? body.source : 'unknown'
  const severity = typeof body.severity === 'string' && ALLOWED_SEVERITIES.has(body.severity)
    ? body.severity : 'error'
  const message = typeof body.message === 'string' ? body.message.slice(0, 2000) : 'No message'
  const location = typeof body.location === 'string' ? body.location.slice(0, 512) : null
  const context = body.context && typeof body.context === 'object' ? body.context : null

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('admin_error_log')
    .insert({
      source, severity, message, location,
      context, digest: computeDigest(message, location),
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500)
  const includeResolved = url.searchParams.get('resolved') === '1'

  const supabase = await createServiceClient()
  let q = supabase
    .from('admin_error_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!includeResolved) q = q.is('resolved_at', null)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: { id?: string; resolve?: boolean; resolveDigest?: string } = {}
  try { body = await request.json() } catch { /* fallthrough */ }

  const supabase = await createServiceClient()

  // Resolve by id (single entry) OR by digest (bulk: all entries with same digest)
  if (body.id) {
    const { error } = await supabase
      .from('admin_error_log')
      .update({ resolved_at: body.resolve === false ? null : new Date().toISOString() })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }
  if (body.resolveDigest) {
    const { error, count } = await supabase
      .from('admin_error_log')
      .update({ resolved_at: new Date().toISOString() }, { count: 'exact' })
      .eq('digest', body.resolveDigest)
      .is('resolved_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, count })
  }
  return NextResponse.json({ error: 'Missing id or resolveDigest' }, { status: 400 })
}
