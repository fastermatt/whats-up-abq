// Auto-generated via Supabase MCP generate_typescript_types
// Project: bsmvfutebmbkjvlrhiyq (abq-unplugged, us-west-2)
// Generated: 2026-04-15
// DO NOT EDIT manually — regenerate via: supabase gen types typescript --project-id bsmvfutebmbkjvlrhiyq

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── v2 schema types (hand-coded to match migrations) ────────────────────────
// The Supabase MCP generator only outputs public.* — v2.* types are defined here.

export interface V2Category {
  slug: string
  parent_slug: string | null
  label: string
  display_order: number
  icon: string | null
  color_hex: string | null
  created_at: string
}

export interface V2Venue {
  id: string
  name: string
  slug: string
  google_place_id: string | null
  address_line: string | null
  city: string
  state: string
  postal_code: string | null
  lat: number | null
  lng: number | null
  website: string | null
  phone: string | null
  default_image_url: string | null
  neighborhood: string | null
  source_hints: Json
  created_at: string
  updated_at: string
}

export interface V2Event {
  id: string
  canonical_event_id: string | null
  source: string
  source_id: string
  primary_source: string
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  timezone: string
  venue_id: string | null
  venue_name_raw: string | null
  category_slug: string | null
  status: 'active' | 'cancelled' | 'postponed' | 'hidden'
  legacy_slug: string | null
  slug: string
  price_min_cents: number | null
  price_max_cents: number | null
  age_restriction: string | null
  raw: Json
  created_at: string
  updated_at: string
}

export interface V2EventImage {
  sha256: string
  original_url: string
  og_url: string
  width: number | null
  height: number | null
  mime_type: string | null
  size_bytes: number | null
  source_url: string | null
  created_at: string
}

export interface V2EventImageLink {
  event_id: string
  sha256: string
  is_primary: boolean
  sort_order: number
}

export interface V2TicketLink {
  id: string
  event_id: string
  source: string
  source_id: string | null
  source_url: string
  label: string | null
  price_min_cents: number | null
  price_max_cents: number | null
  currency: string
  is_official: boolean
  sold_out: boolean
  last_checked_at: string | null
  created_at: string
}

export interface V2VenueMapping {
  id: string
  venue_id: string
  source: string
  source_name: string
  source_id: string | null
  normalized_key: string
  confidence: number
  created_at: string
}

export interface V2IngestRun {
  id: string
  source: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'ok' | 'partial' | 'failed'
  events_seen: number
  events_inserted: number
  events_updated: number
  events_quarantined: number
  images_fetched: number
  images_dedup_hits: number
  api_calls: number
  api_cache_hits: number
  duration_ms: number | null
  error_message: string | null
  meta: Json
}

export interface V2IngestQuarantine {
  id: string
  run_id: string | null
  source: string
  source_id: string | null
  raw: Json
  error_message: string
  error_path: string | null
  resolved: boolean
  resolved_note: string | null
  created_at: string
}

export interface V2ApiQuota {
  vendor: string
  daily_cap: number
  monthly_cap: number | null
  today_count: number
  today_date: string
  month_count: number
  month_start: string
  last_reset_at: string
  last_request_at: string | null
}

// ─── Joined / enriched types used by the frontend ────────────────────────────

export interface EventWithRelations extends V2Event {
  venue: V2Venue | null
  category: V2Category | null
  ticket_links: V2TicketLink[]
  primary_image: V2EventImage | null
}
