'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle, Calendar, MapPin, Tag, DollarSign, User, Mail } from 'lucide-react'

const CATEGORIES = ['Music', 'Sports', 'Arts & Theater', 'Comedy', 'Family', 'Food & Drink', 'Film', 'Community', 'Festivals', 'Outdoor']

type FormState = {
  title: string; description: string; venue: string; address: string
  event_date: string; event_time: string; ticket_url: string; price: string
  category: string; contact_name: string; contact_email: string
}

const EMPTY_FORM: FormState = {
  title: '', description: '', venue: '', address: '', event_date: '', event_time: '',
  ticket_url: '', price: '', category: '', contact_name: '', contact_email: '',
}

export default function SubmitEventPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const update = (field: keyof FormState, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.event_date) {
      setErrorMsg('Event name and date are required.')
      return
    }
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Something went wrong'); setStatus('error'); return }
      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-xl border border-[#ddc9a3] text-sm text-[#1a1614] bg-[#fbf7f1] placeholder-[#c4a97d] focus:outline-none focus:border-[#9a442d] transition-colors"

  if (status === 'success') {
    return (
      <main className="min-h-dvh bg-[--bg] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-[#4f6249] mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Event Submitted!
          </h1>
          <p className="text-sm text-[#8a7a74] mb-6 leading-relaxed">
            Thanks for contributing to ABQ Unplugged. Our team will review your event and add it to the site within 24–48 hours.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/events" className="px-4 py-2 rounded-full bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors">
              Browse Events
            </Link>
            <button
              onClick={() => { setStatus('idle'); setForm(EMPTY_FORM) }}
              className="px-4 py-2 rounded-full border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:border-[#9a442d] transition-colors"
            >
              Submit Another
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[--bg]">
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/events" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Events</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Submit an Event
          </h1>
          <p className="text-sm text-[#8a7a74]">
            Know about a local event we&apos;re missing? Submit it and we&apos;ll add it within 24–48 hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Details */}
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#9a442d] uppercase tracking-wider">Event Details</h2>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1">Event Name *</label>
              <input type="text" required maxLength={200} value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="e.g. Mariachi Night at Nob Hill" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1">Description</label>
              <textarea rows={3} maxLength={1000} value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Tell us about the event..."
                className={inputClass + ' resize-none'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date *
                </label>
                <input type="date" required value={form.event_date}
                  onChange={e => update('event_date', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1">Time</label>
                <input type="time" value={form.event_time}
                  onChange={e => update('event_time', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Category
              </label>
              <select value={form.category} onChange={e => update('category', e.target.value)} className={inputClass}>
                <option value="">Select a category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Venue */}
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#9a442d] uppercase tracking-wider">Venue</h2>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Venue Name
              </label>
              <input type="text" maxLength={200} value={form.venue}
                onChange={e => update('venue', e.target.value)}
                placeholder="e.g. Sunshine Theater" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1">Address</label>
              <input type="text" maxLength={300} value={form.address}
                onChange={e => update('address', e.target.value)}
                placeholder="e.g. 120 Central Ave SW, Albuquerque, NM" className={inputClass} />
            </div>
          </div>

          {/* Tickets */}
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#9a442d] uppercase tracking-wider">Tickets &amp; Price</h2>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1">Ticket URL</label>
              <input type="url" maxLength={500} value={form.ticket_url}
                onChange={e => update('ticket_url', e.target.value)}
                placeholder="https://eventbrite.com/e/..." className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Price
              </label>
              <input type="text" maxLength={50} value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="e.g. Free, $10, $15–$25" className={inputClass} />
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#9a442d] uppercase tracking-wider">Your Info (Optional)</h2>
            <p className="text-xs text-[#8a7a74]">We may contact you if we have questions about the event.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Name
                </label>
                <input type="text" maxLength={100} value={form.contact_name}
                  onChange={e => update('contact_name', e.target.value)}
                  placeholder="Your name" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <input type="email" maxLength={200} value={form.contact_email}
                  onChange={e => update('contact_email', e.target.value)}
                  placeholder="you@email.com" className={inputClass} />
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{errorMsg}</p>
          )}

          <button type="submit" disabled={status === 'submitting'}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-epilogue)' }}>
            {status === 'submitting' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              <><Send className="w-4 h-4" /> Submit Event</>
            )}
          </button>
        </form>
      </div>
    </main>
  )
}
