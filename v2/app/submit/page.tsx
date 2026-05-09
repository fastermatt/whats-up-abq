'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Send, CheckCircle, Calendar, MapPin, Tag, DollarSign,
  Image as ImageIcon, X, Loader2, Info, Upload, Star, AlertCircle,
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

// Validate an image file: min 800×500, max 5 MB, landscape orientation
async function validateImageFile(file: File): Promise<string | null> {
  if (file.size > 5 * 1024 * 1024) return 'Photo must be under 5 MB'
  return new Promise(resolve => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.naturalWidth < 800) return resolve('Photo must be at least 800 px wide')
      if (img.naturalHeight < 500) return resolve('Photo must be at least 500 px tall')
      if (img.naturalWidth < img.naturalHeight) return resolve('Photo must be landscape (wider than tall)')
      resolve(null)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('Could not read image') }
    img.src = url
  })
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState | 'photo' | 'ticket', string>>>({})

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [field]: value }))
    setFieldErrors(e => ({ ...e, [field]: undefined }))
  }

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

  async function handlePhotoChange(file: File) {
    setErrorMsg('')
    const err = await validateImageFile(file)
    if (err) {
      setFieldErrors(e => ({ ...e, photo: err }))
      return
    }
    setFieldErrors(e => ({ ...e, photo: undefined }))
    setPhoto(file)
  }

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

    // Client-side validation for all required fields
    const errs: typeof fieldErrors = {}
    if (!form.title.trim())        errs.title        = 'Event name is required'
    if (!form.description.trim() || form.description.trim().length < 30)
                                   errs.description  = 'Description must be at least 30 characters'
    if (!form.event_date)          errs.event_date   = 'Date is required'
    if (!form.start_time)          errs.start_time   = 'Start time is required'
    if (!form.category)            errs.category     = 'Category is required'
    if (!form.venue_name.trim())   errs.venue_name   = 'Venue name is required'
    if (!form.venue_address.trim()) errs.venue_address = 'Venue address is required'
    if (!photoFile)                errs.photo        = 'An event photo is required'
    if (!form.is_free && !form.ticket_url.trim())
                                   errs.ticket       = 'Provide a ticket URL or mark the event as free'

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      // Scroll to first error
      const first = document.querySelector('[data-field-error]')
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      let photo_url = ''
      if (photoFile) photo_url = await uploadPhoto(photoFile, user.id)

      const toInt = (s: string): number | null => {
        const n = parseFloat(s)
        return isNaN(n) ? null : Math.round(n * 100)
      }

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:             form.title.trim(),
          description:       form.description.trim(),
          venue_name:        form.venue_name.trim(),
          venue_address:     form.venue_address.trim(),
          event_date:        form.event_date,
          start_time:        form.start_time || null,
          end_time:          form.end_time || null,
          category:          form.category,
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
        const msg = data.error ?? 'Something went wrong'
        setErrorMsg(msg)
        setStatus('error')
        // If the server flagged a non-metro venue address, also mark the
        // venue_address field so the user knows where to fix.
        if (/greater Albuquerque|metro/i.test(msg)) {
          setFieldErrors(prev => ({ ...prev, venue_address: 'Address must be in the greater ABQ metro' }))
        }
        // Scroll the prominent error banner into view
        setTimeout(() => {
          document.querySelector('[data-submit-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 50)
        return
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error')
      setStatus('error')
    }
  }

  const inputClass = (hasError?: boolean) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm text-[#1a1614] bg-white placeholder-[#c4a97d] focus:outline-none focus:ring-2 transition ${
      hasError
        ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
        : 'border-[#ddc9a3] focus:border-[#9a442d] focus:ring-[#9a442d]/20'
    }`

  const FieldError = ({ name }: { name: keyof typeof fieldErrors }) =>
    fieldErrors[name] ? (
      <p data-field-error className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
        <span>↑</span> {fieldErrors[name]}
      </p>
    ) : null

  const Req = () => <span className="text-[#9a442d]" aria-label="required">*</span>

  if (!authChecked) {
    return (
      <main id="main" className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#9a442d] animate-spin" />
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main id="main" className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center animate-fade-up">
          <CheckCircle className="w-16 h-16 text-[#4f6249] mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Event submitted!
          </h1>
          <p className="text-sm text-[#6b5d57] mb-6 leading-relaxed">
            Thanks for contributing to ABQ Unplugged. We review every submission before it goes live, usually within 24 hours.
            You&apos;ll see the event appear on the site once approved.
          </p>
          {/* Primary action gets visual weight; "Submit another" is rare so it
              demotes to a tertiary text link below (round-4 critique #20). */}
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#9a442d] text-white text-base font-bold hover:bg-[#7d3725] transition-colors min-w-[220px]"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              Browse events
            </Link>
            <button
              onClick={() => { setStatus('idle'); setForm(EMPTY_FORM); setPhoto(null); setFieldErrors({}) }}
              className="text-xs text-[#6b5d57] hover:text-[#9a442d] transition-colors underline underline-offset-2"
            >
              Submit another event
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main id="main" className="min-h-dvh bg-[#fbf7f1]">
      <header className="sticky top-0 z-20 bg-[#fbf7f1]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
        </div>
      </header>

      {/* ── Hero banner ── */}
      <div className="bg-gradient-to-br from-[#3d1a0e] via-[#7d3725] to-[#a0522d] text-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-7">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[#f5c9a0] fill-[#f5c9a0]" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#f5c9a0] font-semibold">
              Community submissions
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Submit your event
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-md">
            Know about something happening in ABQ that isn&apos;t on the site?
            Fill out every field below and we&apos;ll review it within 24 hours.
          </p>
          <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2.5 w-fit">
            <Info className="w-3.5 h-3.5 text-[#f5c9a0] flex-shrink-0" />
            <p className="text-[11px] text-white/80 leading-relaxed">
              Approved events show a <span className="font-semibold text-white">Community</span> badge and credit you as the submitter.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-[11px] text-[#6b5d57] mb-5">
          All fields marked <span className="text-[#9a442d] font-bold">*</span> are required.
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* ── Event core ── */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider"><span className="text-[#9a442d]/55">Step 1 of 4 ·</span> The event</h2>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                Event name <Req />
              </label>
              <input
                type="text" required maxLength={200} value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="e.g. Mariachi Night at Nob Hill"
                className={inputClass(!!fieldErrors.title)}
              />
              <FieldError name="title" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                Description <Req />
              </label>
              <textarea
                rows={4} maxLength={2000} required value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="What makes this event special? Who's playing / speaking / performing? What should people know before they go?"
                className={inputClass(!!fieldErrors.description) + ' resize-none'}
              />
              <div className="flex items-center justify-between mt-1">
                <FieldError name="description" />
                <p className="text-[10px] text-[#6b5d57] ml-auto">{form.description.length}/2000</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date <Req />
                </label>
                <input
                  type="date" required value={form.event_date}
                  min={new Date().toISOString().slice(0,10)}
                  onChange={e => update('event_date', e.target.value)}
                  className={inputClass(!!fieldErrors.event_date)}
                />
                <FieldError name="event_date" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                  Start time <Req />
                </label>
                <input
                  type="time" required value={form.start_time}
                  onChange={e => update('start_time', e.target.value)}
                  className={inputClass(!!fieldErrors.start_time)}
                />
                <FieldError name="start_time" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">End time</label>
                <input
                  type="time" value={form.end_time}
                  onChange={e => update('end_time', e.target.value)}
                  className={inputClass()}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category <Req />
              </label>
              <select
                required value={form.category}
                onChange={e => update('category', e.target.value)}
                className={inputClass(!!fieldErrors.category)}
              >
                <option value="">Pick a category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError name="category" />
            </div>
          </section>

          {/* ── Venue ── */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider"><span className="text-[#9a442d]/55">Step 2 of 4 ·</span> Venue</h2>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Venue name <Req />
              </label>
              <input
                type="text" required maxLength={200} value={form.venue_name}
                onChange={e => update('venue_name', e.target.value)}
                placeholder="e.g. Sunshine Theater"
                className={inputClass(!!fieldErrors.venue_name)}
              />
              <FieldError name="venue_name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                Address <Req />
              </label>
              <input
                type="text" required maxLength={300} value={form.venue_address}
                onChange={e => update('venue_address', e.target.value)}
                placeholder="e.g. 120 Central Ave SW, Albuquerque, NM 87102"
                className={inputClass(!!fieldErrors.venue_address)}
              />
              <FieldError name="venue_address" />
            </div>
          </section>

          {/* ── Photo — most prominent section ── */}
          <section className={`rounded-2xl p-5 space-y-4 border-2 transition-colors ${
            fieldErrors.photo
              ? 'bg-red-50 border-red-300'
              : photoFile
                ? 'bg-[#f0f9f5] border-[#4f6249]/40'
                : 'bg-gradient-to-br from-[#fff8f4] to-[#fdf3ec] border-[#9a442d]/30'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-[#9a442d]/55 uppercase tracking-wider mb-1">Step 3 of 4</p>
                <div className="flex items-center gap-2 mb-0.5">
                  <ImageIcon className="w-4 h-4 text-[#9a442d]" />
                  <h2 className="text-sm font-black text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
                    Event Photo <Req />
                  </h2>
                </div>
                <p className="text-[11px] text-[#6a5a54]">
                  Required. This is how people find your event.
                </p>
              </div>
              {!photoFile && (
                <span className="flex-shrink-0 bg-[#9a442d] text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full">
                  Required
                </span>
              )}
              {photoFile && (
                <span className="flex-shrink-0 bg-[#4f6249] text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" /> Photo added
                </span>
              )}
            </div>

            {/* Spec list */}
            {!photoFile && (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ['📐', 'Landscape orientation (wider than tall)'],
                  ['📏', 'Minimum 800 × 500 px'],
                  ['🗂️', 'JPG, PNG, or WebP only'],
                  ['⚖️', 'Max 5 MB file size'],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1.5">
                    <span className="text-sm">{icon}</span>
                    <span className="text-[10px] text-[#4a3f3a] font-medium leading-snug">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upload area or preview */}
            {photoPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview} alt="preview"
                  className="w-full aspect-[16/10] object-cover rounded-xl shadow-sm"
                />
                {/* Card-style overlay showing how it'll look */}
                <div className="absolute inset-0 rounded-xl ring-2 ring-[#4f6249]/30 pointer-events-none" />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded-full">
                  Preview — how it appears on the site
                </div>
                <button
                  type="button" onClick={() => { setPhoto(null); setFieldErrors(e => ({ ...e, photo: undefined })) }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  aria-label="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center w-full aspect-[16/10] border-2 border-dashed rounded-xl cursor-pointer transition-all hover:scale-[1.01] ${
                fieldErrors.photo ? 'border-red-300 bg-red-50/50' : 'border-[#9a442d]/30 bg-white/60 hover:bg-white/90 hover:border-[#9a442d]/60'
              }`}>
                <div className="flex flex-col items-center gap-2 text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-[#9a442d]/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-[#9a442d]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#4a3f3a]">Tap to upload photo</p>
                    <p className="text-[10px] text-[#6b5d57] mt-0.5">Landscape · min 800×500 · JPG/PNG/WebP · max 5 MB</p>
                  </div>
                </div>
                <input
                  type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    handlePhotoChange(f)
                  }}
                />
              </label>
            )}

            {fieldErrors.photo && (
              <p data-field-error className="text-[11px] text-red-600 flex items-center gap-1">
                <span>↑</span> {fieldErrors.photo}
              </p>
            )}

            {status === 'submitting' && photoFile && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="space-y-1">
                <p className="text-[10px] text-[#6b5d57]">Uploading photo… {uploadProgress}%</p>
                <div className="h-1.5 bg-[#f0e4cc] rounded-full overflow-hidden">
                  <div className="h-full bg-[#9a442d] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </section>

          {/* ── Tickets & price ── */}
          <section className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#9a442d] uppercase tracking-wider"><span className="text-[#9a442d]/55">Step 4 of 4 ·</span> Tickets &amp; price <Req /></h2>

            <label className="flex items-center gap-2.5 text-sm text-[#4a3f3a] cursor-pointer select-none">
              <input
                type="checkbox" checked={form.is_free}
                onChange={e => {
                  update('is_free', e.target.checked)
                  setFieldErrors(fe => ({ ...fe, ticket: undefined }))
                }}
                className="w-4 h-4 accent-[#9a442d]"
              />
              <span>This is a <strong>free</strong> event (no tickets needed)</span>
            </label>

            {!form.is_free && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                    Ticket URL <Req />
                  </label>
                  <input
                    type="url" maxLength={500} value={form.ticket_url}
                    onChange={e => { update('ticket_url', e.target.value); setFieldErrors(fe => ({ ...fe, ticket: undefined })) }}
                    placeholder="https://ticketmaster.com/… or https://eventbrite.com/…"
                    className={inputClass(!!fieldErrors.ticket)}
                  />
                  {fieldErrors.ticket && (
                    <p data-field-error className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <span>↑</span> {fieldErrors.ticket}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Min price
                    </label>
                    <input
                      type="number" min="0" step="0.01" value={form.price_min}
                      onChange={e => update('price_min', e.target.value)}
                      placeholder="10.00" className={inputClass()}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Max price</label>
                    <input
                      type="number" min="0" step="0.01" value={form.price_max}
                      onChange={e => update('price_max', e.target.value)}
                      placeholder="25.00" className={inputClass()}
                    />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Global error — prominent banner so server-side rejection
              messages (e.g. greater-ABQ guard) actually get noticed. */}
          {errorMsg && (
            <div
              data-submit-error
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5"
            >
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold leading-tight">Couldn&apos;t submit your event</p>
                <p className="text-red-600 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          <button
            type="submit" disabled={status === 'submitting'}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#9a442d] text-white font-bold text-sm hover:bg-[#7d3725] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-[#9a442d]/20"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            {status === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {photoFile && uploadProgress > 0 && uploadProgress < 100
                  ? `Uploading photo (${uploadProgress}%)…`
                  : 'Submitting…'}
              </>
            ) : (
              <><Send className="w-4 h-4" /> Submit for review</>
            )}
          </button>

          <p className="text-[10px] text-[#6b5d57] text-center pb-6">
            Submitting as <b>{user?.email}</b> · Limit 3 submissions per day · Reviewed within 24 hours
          </p>
        </form>
      </div>
    </main>
  )
}
