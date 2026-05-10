'use client'

import { useState } from 'react'
import { InstagramIcon } from './InstagramIcon'

export function NewsletterBar() {
  const [email, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStatus('success')
        setValue('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-[#9a442d] text-white text-center py-3 px-4">
        <p className="text-sm font-semibold mb-1.5">You&apos;re subscribed ✦ Weekend picks hit your inbox every Friday.</p>
        {/* Convert the success moment — they just opted in once, so a follow
            ask here is the warmest possible context for the second action. */}
        <a
          href="https://instagram.com/abqunplugged"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="instagram-follow"
          data-umami-event-position="newsletter-success"
          className="inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline"
        >
          <InstagramIcon size={14} />
          Follow @abqunplugged for daily picks
        </a>
      </div>
    )
  }

  return (
    <div style={{ background: '#1a1210', borderTop: '1px solid rgba(240,228,204,0.07)', padding: '20px 16px' }}>
      {/* Placeholder and focus pseudo-styles */}
      <style>{`
        .nl-input::placeholder { color: rgba(251,247,241,0.30); }
        .nl-input:focus { border-color: rgba(154,68,45,0.60) !important; outline: none; }
      `}</style>
      <div className="max-w-lg mx-auto text-center">
        <p style={{ color: 'rgba(251,247,241,0.80)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          The best of ABQ this weekend — in your inbox.
        </p>
        <p style={{ color: 'rgba(251,247,241,0.35)', fontSize: 11, marginBottom: 14 }}>
          Free weekly. No spam. Unsubscribe anytime.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, maxWidth: 380, margin: '0 auto' }}>
          <input
            type="email"
            value={email}
            onChange={e => setValue(e.target.value)}
            placeholder="your@email.com"
            required
            className="nl-input"
            style={{
              flex: 1,
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              background: 'rgba(251,247,241,0.06)',
              border: '1px solid rgba(251,247,241,0.12)',
              color: '#fbf7f1',
            }}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              background: '#9a442d',
              color: '#fbf7f1',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              opacity: status === 'loading' ? 0.6 : 1,
            }}
          >
            {status === 'loading' ? '…' : 'Subscribe'}
          </button>
        </form>
        {status === 'error' && (
          <p style={{ color: '#f87171', fontSize: 11, marginTop: 8 }}>Something went wrong — try again.</p>
        )}
        {/* Always-visible IG link in the footer dark band. Padded to a
            44×44 minimum tap target — mobile audit caught the prior 105×17
            pill failing accessibility. Still visually secondary to the
            email signup; sits in its own bordered chip below the form. */}
        <a
          href="https://instagram.com/abqunplugged"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="instagram-follow"
          data-umami-event-position="newsletter-footer"
          style={{
            color: 'rgba(251,247,241,0.65)',
            fontSize: 12,
            fontWeight: 600,
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            minHeight: 44,
            borderRadius: 8,
            background: 'rgba(251,247,241,0.05)',
            border: '1px solid rgba(251,247,241,0.10)',
            textDecoration: 'none',
            transition: 'color 150ms, background 150ms, border-color 150ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#fbf7f1'
            e.currentTarget.style.background = 'rgba(251,247,241,0.10)'
            e.currentTarget.style.borderColor = 'rgba(251,247,241,0.20)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(251,247,241,0.65)'
            e.currentTarget.style.background = 'rgba(251,247,241,0.05)'
            e.currentTarget.style.borderColor = 'rgba(251,247,241,0.10)'
          }}
        >
          <InstagramIcon size={14} />
          @abqunplugged
        </a>
      </div>
    </div>
  )
}
