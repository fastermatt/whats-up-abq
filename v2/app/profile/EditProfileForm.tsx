'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, ChevronDown, ChevronUp } from 'lucide-react'

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
}

export function EditProfileForm({ userId, currentDisplayName, currentHandle, currentNeighborhood, currentBio }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [handle, setHandle]     = useState(currentHandle.replace('@', ''))
  const [neighborhood, setNeighborhood] = useState(currentNeighborhood)
  const [bio, setBio]           = useState(currentBio)
  const [error, setError]       = useState('')

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
    <div className="bg-white rounded-2xl border border-[#f0e4cc] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#f7f2ec] transition-colors"
      >
        <span className="text-sm font-semibold text-[#1a1614]">Edit Profile</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#8a7a74]" /> : <ChevronDown className="w-4 h-4 text-[#8a7a74]" />}
      </button>

      {open && (
        <form onSubmit={handleSave} className="px-4 pb-4 space-y-3 border-t border-[#f0e4cc]">
          <div className="pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-[#f7f2ec] text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#4a3f3a] uppercase tracking-wide mb-1">
                Handle
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8a7a74]">@</span>
                <input
                  type="text"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  placeholder="handle"
                  className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#ddc9a3] bg-[#f7f2ec] text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
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
              className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-[#f7f2ec] text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d]"
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
              className="w-full px-3 py-2 rounded-lg border border-[#ddc9a3] bg-[#f7f2ec] text-sm text-[#1a1614] focus:outline-none focus:ring-1 focus:ring-[#9a442d] resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9a442d] text-white text-xs font-semibold hover:bg-[#7d3725] transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </form>
      )}
    </div>
  )
}
