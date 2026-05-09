'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Send, CheckCircle, Loader2,
  Flag, Lightbulb, Sparkles, Bug, MessageSquare,
} from 'lucide-react'

type Category = 'event_report' | 'event_idea' | 'site_suggestion' | 'bug_report' | 'general'

const OPTIONS: { value: Category; label: string; icon: typeof Flag; blurb: string }[] = [
  { value: 'event_idea',      label: 'Event idea',        icon: Lightbulb,     blurb: 'Tell us about an event you think should be on the site' },
  { value: 'site_suggestion', label: 'Site suggestion',   icon: Sparkles,      blurb: 'Ideas to make ABQ Unplugged better' },
  { value: 'bug_report',      label: 'Bug report',        icon: Bug,           blurb: 'Something broken or acting weird?' },
  { value: 'event_report',    label: 'Report an event',   icon: Flag,          blurb: 'Wrong info, duplicate, or inappropriate content' },
  { value: 'general',         label: 'Something else',    icon: MessageSquare, blurb: 'General questions or feedback' },
]

const VALID_CATEGORIES: Category[] = ['event_report', 'event_idea', 'site_suggestion', 'bug_report', 'general']

export default function FeedbackPage() {
  const searchParams = useSearchParams()
  const presetCategory = searchParams.get('category') as Category | null
  const presetEventId  = searchParams.get('event_id') ?? null

  const [category, setCategory] = useState<Category | null>(
    presetCategory && VALID_CATEGORIES.includes(presetCategory) ? presetCategory : null
  )
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [email,    setEmail]    = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [status,   setStatus]   = useState<'idle'|'submitting'|'success'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setErrorMsg('Pick a feedback type first'); return }
    if (!message.trim())  { setErrorMsg('Please include a message'); return }

    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject:       subject.trim() || null,
          message:       message.trim(),
          contact_email: userEmail ?? email.trim() ?? null,
          event_id:      presetEventId ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Something went wrong'); setStatus('error'); return }
      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-xl border border-[#ddc9a3] text-sm text-[#1a1614] bg-white placeholder-[#c4a97d] focus:outline-none focus:border-[#9a442d] focus:ring-2 focus:ring-[#9a442d]/20 transition'

  if (status === 'success') {
    return (
      <main className="min-h-dvh bg-[#fbf7f1] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center animate-fade-up">
          <CheckCircle className="w-16 h-16 text-[#4f6249] mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Thanks. We got it.
          </h1>
          <p className="text-sm text-[#6b5d57] mb-6 leading-relaxed">
            Your feedback is in the inbox. If you gave us an email, we&apos;ll follow up if there&apos;s anything to share.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/" className="px-4 py-2 rounded-full bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors">
              Back to home
            </Link>
            <button
              onClick={() => { setStatus('idle'); setCategory(null); setSubject(''); setMessage(''); setEmail('') }}
              className="px-4 py-2 rounded-full border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:border-[#9a442d] transition-colors"
            >
              Send another
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
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Home</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#006a62] font-semibold mb-1">Feedback &amp; ideas</p>
          <h1 className="text-2xl font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Tell us what you think
          </h1>
          <p className="text-sm text-[#6b5d57]">
            Every message lands in our inbox and gets read. Bugs, ideas, event reports: all welcome.
          </p>
          {presetEventId && (
            <div className="mt-3 flex items-center gap-2 bg-[#9a442d]/8 border border-[#9a442d]/20 rounded-xl px-3 py-2">
              <Flag className="w-3.5 h-3.5 text-[#9a442d] flex-shrink-0" />
              <p className="text-[11px] text-[#4a3f3a]">
                Reporting about event <Link href={`/events/${presetEventId}`} className="text-[#9a442d] underline">#{presetEventId.slice(0,8)}…</Link>
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#4a3f3a] mb-2">What are you telling us about?</p>
            {OPTIONS.map(({ value, label, icon: Icon, blurb }) => {
              const isActive = category === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? 'border-[#9a442d] bg-[#9a442d]/5'
                      : 'border-[#f0e4cc] bg-white hover:border-[#ddc9a3]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-[#9a442d] text-white' : 'bg-[#f0e4cc] text-[#9a442d]'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-[#1a1614]">{label}</p>
                    <p className="text-xs text-[#6b5d57] mt-0.5">{blurb}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {category && (
            <>
              <div className="bg-white rounded-2xl border border-[#f0e4cc] p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                    Subject <span className="text-[#6b5d57] font-normal">(optional)</span>
                  </label>
                  <input type="text" maxLength={200} value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="One-line summary" className={inputClass} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                    Message <span className="text-[#9a442d]">*</span>
                  </label>
                  <textarea rows={6} maxLength={5000} required value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="The more detail the better..."
                    className={inputClass + ' resize-none'} />
                  <p className="text-[10px] text-[#6b5d57] mt-1">{message.length}/5000</p>
                </div>

                {!userEmail && (
                  <div>
                    <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                      Email <span className="text-[#6b5d57] font-normal">(optional — only if you want a reply)</span>
                    </label>
                    <input type="email" maxLength={200} value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com" className={inputClass} />
                  </div>
                )}

                {userEmail && (
                  <p className="text-[11px] text-[#6b5d57]">Sending as <b>{userEmail}</b></p>
                )}
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{errorMsg}</p>
              )}

              <button type="submit" disabled={status === 'submitting'}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-epilogue)' }}>
                {status === 'submitting' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-4 h-4" /> Send feedback</>
                )}
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  )
}
