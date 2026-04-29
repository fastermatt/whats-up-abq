'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, ChevronDown, ChevronUp } from 'lucide-react'
import { PreferencesPicker, type UserPreferences } from '@/app/components/PreferencesPicker'

const NEIGHBORHOODS = [
  'Downtown', 'Nob Hill', 'Old Town', 'North Valley', 'South Valley',
  'NE Heights', 'Westside', 'Rio Rancho', 'Corrales', 'Bernalillo',
  'University', 'Barelas', 'Huning Highland', 'Los Ranchos',
]

interface Props {
  userId: string
  currentDisplayName: string
  currentHandle: string
  currentNeighborhood: string
  currentBio: string
  currentPreferences: UserPreferences
}

export function EditProfileForm({
  userId,
  currentDisplayName,
  currentHandle,
  currentNeighborhood,
  currentBio,
  currentPreferences,
}: Props) {
  const router = useRouter()
  const [open, setOpen]               = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [handle, setHandle]           = useState(currentHandle.replace('@', ''))
  const [neighborhood, setNeighborhood] = useState(currentNeighborhood)
  const [bio, setBio]                 = useState(currentBio)
  const [error, setError]             = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        handle: handle.trim() ? handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') : null,
        neighborhood: neighborhood || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    setSaving(false)
    if (err) {
      setError(err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    }
  }

  return (
    <div className="bg-[#fdf9f4] rounded-2xl border border-[#e8d9bf] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-[#f7f0e5] transition-colors"
      >
        <span className="text-sm font-bold text-[#1a1614]">Edit Profile &amp; Preferences</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#6b5d57]" />
          : <ChevronDown className="w-4 h-4 text-[#6b5d57]" />}
      </button>

      {open && (
        <div className="border-t border-[#e8d9bf]">
          {/* ── Profile fields ── */}
          <form onSubmit={handleSave} className="px-4 pt-4 pb-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-white text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                  Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b5d57]">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={e => setHandle(e.target.value)}
                    placeholder="handle"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#ddc9a3] bg-white text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                Neighborhood
              </label>
              <select
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-white text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
              >
                <option value="">Select your neighborhood</option>
                {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="What kind of events do you love?"
                rows={2}
                maxLength={160}
                className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-white text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d] resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
            </button>
          </form>

          {/* ── Preferences ── */}
          <div className="border-t border-[#e8d9bf] px-4 pt-5 pb-6">
            <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-[#9a442d] mb-1">
              What are you into?
            </p>
            <p className="text-[12px] text-[#6b5d57] mb-5 leading-relaxed">
              We use this to filter your For You feed and skip events that aren&apos;t for you.
            </p>
            <PreferencesPicker
              userId={userId}
              initial={currentPreferences}
            />
          </div>
        </div>
      )}
    </div>
  )
}
