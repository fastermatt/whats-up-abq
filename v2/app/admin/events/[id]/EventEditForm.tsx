'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  '', 'Music', 'Comedy', 'Sports', 'Arts & Theater', 'Family',
  'Film', 'Food & Drink', 'Festivals', 'Outdoor', 'Community',
]
const MUSIC_SUBS = ['', 'Rock', 'Pop', 'Country', 'Jazz', 'Hip-Hop', 'R&B', 'Electronic', 'Latin', 'Folk', 'Metal', 'Classical', 'Blues', 'Soul', 'Alternative', 'Indie']
const SPORTS_SUBS = ['', 'Baseball', 'Soccer', 'Football', 'Basketball', 'Hockey', 'Combat', 'Motorsports', 'College', 'Running', 'Rodeo']

interface Props {
  eventId: string
  rawTitle: string
  initialValues: {
    category: string
    subcategory: string
    title_override: string
    admin_notes: string
    hidden: boolean
  }
}

export function EventEditForm({ eventId, rawTitle, initialValues }: Props) {
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  const set = (key: string, value: string | boolean) =>
    setValues(v => ({ ...v, [key]: value }))

  const subs = values.category === 'Music' ? MUSIC_SUBS
    : values.category === 'Sports' ? SPORTS_SUBS
    : ['']

  const save = async () => {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/admin/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: eventId,
        category: values.category || null,
        subcategory: values.subcategory || null,
        title_override: values.title_override || null,
        admin_notes: values.admin_notes || null,
        hidden: values.hidden,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const inputClass = 'w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#9a442d] transition-colors'
  const selectClass = `${inputClass} appearance-none cursor-pointer`

  return (
    <div className="space-y-5 bg-white/5 rounded-2xl p-6">
      {/* Hidden toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Visibility</p>
          <p className="text-xs text-white/40">Hidden events won&apos;t appear on the site</p>
        </div>
        <button
          onClick={() => set('hidden', !values.hidden)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            values.hidden
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
          }`}
        >
          {values.hidden ? 'Hidden' : 'Visible'}
        </button>
      </div>

      <div className="border-t border-white/10" />

      {/* Title override */}
      <div>
        <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Title Override</label>
        <input
          type="text"
          value={values.title_override}
          onChange={e => set('title_override', e.target.value)}
          placeholder={rawTitle || 'Leave blank to use original title'}
          className={inputClass}
        />
      </div>

      {/* Category */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Category</label>
          <select
            value={values.category}
            onChange={e => { set('category', e.target.value); set('subcategory', '') }}
            className={selectClass}
          >
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#1a1614]">{c || '— no override —'}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Subcategory</label>
          <select
            value={values.subcategory}
            onChange={e => set('subcategory', e.target.value)}
            disabled={subs.length <= 1}
            className={`${selectClass} disabled:opacity-40`}
          >
            {subs.map(s => <option key={s} value={s} className="bg-[#1a1614]">{s || '— none —'}</option>)}
          </select>
        </div>
      </div>

      {/* Admin notes */}
      <div>
        <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Admin Notes</label>
        <textarea
          value={values.admin_notes}
          onChange={e => set('admin_notes', e.target.value)}
          placeholder="Internal notes (not shown to users)"
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[#9a442d] text-white font-semibold rounded-xl text-sm hover:bg-[#7d3725] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
      </div>
    </div>
  )
}
