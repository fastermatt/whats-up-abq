'use client'

import type { Design } from '../types'

const KEY = 'abq-ig-saved-designs'
const TEMPLATE_KEY = 'ig.user-templates'
const MAX = 50
const MAX_TEMPLATES = 30

export function listSaved(): Design[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Design[]
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch { return [] }
}

export function saveDesign(d: Design, thumbnail?: string): Design {
  if (typeof window === 'undefined') return d
  const existing = listSaved()
  const withThumb = { ...d, thumbnail: thumbnail ?? d.thumbnail, updatedAt: Date.now() }
  const idx = existing.findIndex(e => e.id === d.id)
  const next = idx >= 0
    ? existing.map((e, i) => i === idx ? withThumb : e)
    : [withThumb, ...existing]
  localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)))
  return withThumb
}

export function deleteSaved(id: string): void {
  if (typeof window === 'undefined') return
  const existing = listSaved().filter(d => d.id !== id)
  localStorage.setItem(KEY, JSON.stringify(existing))
}

export function duplicateSaved(id: string): Design | null {
  const existing = listSaved()
  const src = existing.find(d => d.id === id)
  if (!src) return null
  const copy: Design = {
    ...src,
    id: Math.random().toString(36).slice(2, 10),
    name: `${src.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  saveDesign(copy)
  return copy
}

// ── User-saved templates ──────────────────────────────────────────────────
// Stored separately under `ig.user-templates`. These appear in the Toolbar
// gallery under a "My Templates" tab and are independent of saved designs.

export function listUserTemplates(): Design[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as Design[]
    return Array.isArray(arr) ? arr.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch { return [] }
}

export function saveUserTemplate(d: Design, thumbnail?: string): Design {
  if (typeof window === 'undefined') return d
  const existing = listUserTemplates()
  const withThumb: Design = {
    ...d,
    // New ID so the template lives independently of the source design and
    // doesn't get clobbered by future saves of the working design.
    id: Math.random().toString(36).slice(2, 10),
    thumbnail: thumbnail ?? d.thumbnail,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const next = [withThumb, ...existing]
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next.slice(0, MAX_TEMPLATES)))
  return withThumb
}

export function deleteUserTemplate(id: string): void {
  if (typeof window === 'undefined') return
  const existing = listUserTemplates().filter(d => d.id !== id)
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(existing))
}
