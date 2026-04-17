'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Send, CheckCircle, Calendar, MapPin, Tag, DollarSign,
  Image as ImageIcon, X, Loader2, Info,
} from 'lucide-react'

const CATEGORIES = [
  'Music', 'Sports', 'Arts & Theater', 'Comedy', 'Family',
  'Food & Drink', 'Film', 'Community', 'Festivals', 'Outdoor',
]

type FormState = {
  title:             string
  description:       string
  venue_name:        string
  venue_address:     string
  event_date:        string
  start_time:        string
  end_time:          string
  ticket_url:        string
  is_free:           boolean
  price_min:         string
  price_max:         string
  category:          string
  neighborhood_slug: string
}

const EMPTY_FORM: FormState = {
  title: '', description: '', venue_name: '', venue_address: '',
  event_date: '', start_time: '', end_time: '',
  ticket_url: '', is_free: false, price_min: '', price_max: '',
  category: '', neighborhood_slug: '',
}

export default function SubmitEventPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser]       = useState<{ id: string; email: string | null } | null>(null)
  const [form, setForm]       = useState<FormState>(EMPTY_FORM)
  const [photoFile, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus]   = useState<'idle'|'submitting'|'success'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [field]: value }))

  // Auth gate
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace('/login?redirectTo=/submit')
      } else {
        setUser({ id: data.user.id, email: data.user.email ?? null })
        setAuthChecked(true)
      }
    })
  }, [router])

  // Photo preview cleanup
  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  async function uploadPhoto(file: File, userId: string): Promise<string> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    setUploadProgress(15)
    const { error } = await supabase.storage
      .from('event-submissions')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error('Photo upload failed: ' + error.message)

    setUploadProgress(85)
    const { data } = supabase.storage.from('event-submissions').getPublicUrl(path)
    setUploadProgress(100)
    return data.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    if (!form.title.trim())      { setErrorMsg('Event name is required'); return }
    if (!form.event_date)        { setErrorMsg('Event date is required'); return }
    if (!form.venue_name.trim()) { setErrorMsg('Venue name is required'); return }

    setStatus('submitting')
    setErrorMsg('')

    try {
      // Upload photo first, if present
      let photo_url = ''
      if (photoFile) {
        photo_url = await uploadPhoto(photoFile, user.id)
      }

      const toInt = (s: string): number | null => {
        const n = parseFloat(s)
        return isNaN(n) ? null : Math.round(n * 100)
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:             form.title.trim(),
          description:       form.description.trim() || null,
          venue_name:        form.venue_name.trim(),
          venue_address:     form.venue_address.trim() || null,
          event_date:        form.event_date,
          start_time:        form.start_time || null,
          end_time:          form.end_time || null,
          category:          form.category || null,
          neighborhood_slug: form.neighborhood_slug || null,
          photo_url:         photo_url || null,
          ticket_url:        form.ticket_url.trim() || null,
          is_free:           form.is_free,
          price_min_cents:   form.is_free ? 0 : toInt(form.price_min),
          price_max_cents:   form.is_free ? 0 : toInt(form.price_max),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong')
        setStatus('error')
        return
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setStatus('error')
    }
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-[#ddc9a3] text-sm text-[#1a1614] bg-white placeholder-[#c4a97d] focus:outline-none focus:border-[#9a442d] focus:ring-2 focus:ring-[#9a442d]/20 transition'

  if (!authChecked) {
    return (
      <main className="min-h-dvh bg-[--bg] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#9a442d] animate-spin" />
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main className="min-h-dvh bg-[--bg] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center animate-fade-up">
          <CheckCircle className="w-16 h-16 text-[#4f6249] mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Event submitted!
          </h1>
          <p className="text-sm text-[#8a7a74] mb-6 leading-relaxed">
            Thanks for contributing to ABQ Unplugged. We review every submission before it goes live — usually within 24 hours.
            You&apos;ll see the event appear on the site once approved.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/events" className="px-4 py-2 rounded-full bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors">
              Browse events
            </Link>
            <button
              onClick={() => { setStatus('idle'); setForm(EMPTY_FORM); setPhoto(null) }}
              className="px-4 py-2 rounded-full border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:border-[#9a442d] transition-colors"
            >
              Submit another
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[#fbf7f1]">
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#9a442d] font-semibold mb-1">Community</p>
          <h1 className="text-2xl font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Submit an event
          </h1>
          <p className="text-sm text-[#8a7a74]">
            Know about something happening in ABQ that isn&apos;t on the site yet? Add it. We review every submission before it goes live.
          </p>
        </div>

        {/* Review notice */}
        <div className="bg-[#f0e4cc]/60 border border-[#ddc9a3] rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#9a442d] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#4a3f3a] mb-0.5">Review before publish</p>
            <p className="text-[11px] text-[#8a7a74] leading-relaxed">
              Every submission is reviewed before appearing on the site. Approved events display a <b>Community</b> badge and credit you as the submitter.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Event core */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider">The event</h2>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Event name <span className="text-[#9a442d]">*</span></label>
              <input type="text" required maxLength={200} value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="e.g. Mariachi Night at Nob Hill" className={inputClass} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Description</label>
              <textarea rows={4} maxLength={2000} value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="What makes this event special? Who&apos;s playing / speaking / performing? What should people know?"
                className={inputClass + ' resize-none'} />
              <p className="text-[10px] text-[#8a7a74] mt-1">{form.description.length}/2000</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date <span className="text-[#9a442d]">*</span>
                </label>
                <input type="date" required value={form.event_date}
                  min={new Date().toISOString().slice(0,10)}
                  onChange={e => update('event_date', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Start time</label>
                <input type="time" value={form.start_time}
                  onChange={e => update('start_time', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">End time</label>
                <input type="time" value={form.end_time}
                  onChange={e => update('end_time', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category
              </label>
              <select value={form.category} onChange={e => update('category', e.target.value)} className={inputClass}>
                <option value="">Pick a category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </section>

          {/* Venue */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider">Venue</h2>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Venue name <span className="text-[#9a442d]">*</span>
              </label>
              <input type="text" required maxLength={200} value={form.venue_name}
                onChange={e => update('venue_name', e.target.value)}
                placeholder="e.g. Sunshine Theater" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Address</label>
              <input type="text" maxLength={300} value={form.venue_address}
                onChange={e => update('venue_address', e.target.value)}
                placeholder="e.g. 120 Central Ave SW, Albuquerque, NM" className={inputClass} />
            </div>
          </section>

          {/* Photo */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-3">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Event photo
            </h2>
            <p className="text-[11px] text-[#8a7a74]">
              Optional but recommended. JPG, PNG, or WebP — max 5 MB. Landscape (16:10) works best.
            </p>
            {photoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="preview" className="w-full aspect-[16/10] object-cover rounded-xl" />
                <button type="button" onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  aria-label="Remove photo">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full aspect-[16/10] border-2 border-dashed border-[#ddc9a3] rounded-xl bg-[#fbf7f1]/50 hover:bg-[#f0e4cc]/40 cursor-pointer transition-colors">
                <ImageIcon className="w-8 h-8 text-[#c4a97d] mb-2" />
                <span className="text-xs text-[#8a7a74]">Tap to upload a photo</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (f.size > 5 * 1024 * 1024) { setErrorMsg('Photo must be under 5 MB'); return }
                    setErrorMsg(''); setPhoto(f)
                  }} />
              </label>
            )}
            {status === 'submitting' && photoFile && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="h-1 bg-[#f0e4cc] rounded-full overflow-hidden">
                <div className="h-full bg-[#9a442d] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </section>

          {/* Tickets */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider">Tickets &amp; price</h2>

            <label className="flex items-center gap-2 text-sm text-[#4a3f3a] cursor-pointer">
              <input type="checkbox" checked={form.is_free}
                onChange={e => update('is_free', e.target.checked)}
                className="w-4 h-4 accent-[#9a442d]" />
              Free event
            </label>

            {!form.is_free && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Min price
                  </label>
                  <input type="number" min="0" step="0.01" value={form.price_min}
                    onChange={e => update('price_min', e.target.value)}
                    placeholder="10.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Max price</label>
                  <input type="number" min="0" step="0.01" value={form.price_max}
                    onChange={e => update('price_max', e.target.value)}
                    placeholder="25.00" className={inputClass} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Ticket URL</label>
              <input type="url" maxLength={500} value={form.ticket_url}
                onChange={e => update('ticket_url', e.target.value)}
                placeholder="https://..." className={inputClass} />
            </div>
          </section>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorMsg}</p>
          )}

          <button type="submit" disabled={status === 'submitting'}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-epilogue)' }}>
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {photoFile && uploadProgress > 0 && uploadProgress < 100 ? `Uploading photo (${uploadProgress}%)…` : 'Submitting…'}
              </>
            ) : (
              <><Send className="w-4 h-4" /> Submit for review</>
            )}
          </button>

          <p className="text-[10px] text-[#8a7a74] text-center">
            Submitting as <b>{user?.email}</b>. 3 submissions per day.
          </p>
        </form>
      </div>
    </main>
  )
}
