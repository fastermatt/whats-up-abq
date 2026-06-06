'use client'

import { useState } from 'react'
import { InstagramIcon } from '@/app/components/InstagramIcon'

export function LandingEmailForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || status !== 'idle') return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl bg-terra px-6 py-8 text-center">
        <p
          className="text-xl font-black text-white mb-1"
          style={{ fontFamily: 'var(--font-epilogue)' }}
        >
          You&apos;re in.
        </p>
        <p className="text-sm text-white/80 mb-5">
          Weekend picks land every Friday morning. Check your inbox.
        </p>
        <a
          href="https://instagram.com/abqunplugged"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="instagram-follow"
          data-umami-event-position="landing-email-success"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/15 text-white text-sm font-semibold border border-white/25 hover:bg-white/25 transition-colors"
        >
          <InstagramIcon size={15} />
          Follow @abqunplugged for daily picks
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-ink px-6 py-7">
      <p
        className="text-lg font-black text-cream mb-1"
        style={{ fontFamily: 'var(--font-epilogue)' }}
      >
        Get Friday picks in your inbox.
      </p>
      <p className="text-xs text-cream/45 mb-5">
        Best of ABQ every weekend. Free, no spam, unsubscribe anytime.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm bg-white/8 border border-white/12 text-cream placeholder:text-cream/30 focus-visible:outline-none focus:border-terra/60 focus-visible:ring-1 focus-visible:ring-terra/30 transition-all"
          style={{ background: 'rgba(251,247,241,0.07)', borderColor: 'rgba(251,247,241,0.11)' }}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-5 py-2.5 rounded-xl bg-terra text-white text-sm font-bold hover:bg-terra-hover transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && (
        <p className="text-xs text-red-400 mt-2">Something went wrong — try again.</p>
      )}
    </div>
  )
}
