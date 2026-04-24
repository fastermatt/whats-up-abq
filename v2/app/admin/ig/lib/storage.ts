'use client'

import type { Design } from '../types'

const KEY = 'abq-ig-saved-designs'
const MAX = 50

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
