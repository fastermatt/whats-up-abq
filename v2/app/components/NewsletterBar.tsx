'use client'

import { useState } from 'react'

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
        <p className="text-sm font-semibold">You&apos;re in ✦ We&apos;ll let you know when it launches.</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#1a1210', borderTop: '1px solid rgba(240,228,204,0.07)', padding: '20px 16px' }}>
      {/* Placeholder and focus pseudo-styles */}
      <style>{`
        .nl-waitlist-input::placeholder { color: rgba(251,247,241,0.30); }
        .nl-waitlist-input:focus { border-color: rgba(154,68,45,0.60) !important; outline: none; }
      `}</style>
      <div className="max-w-lg mx-auto text-center">
        <p style={{ color: 'rgba(251,247,241,0.80)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          ABQ&apos;s weekend picks — arriving soon.
        </p>
        <p style={{ color: 'rgba(251,247,241,0.35)', fontSize: 11, marginBottom: 14 }}>
          Drop your email. You&apos;ll be first when we launch.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, maxWidth: 380, margin: '0 auto' }}>
          <input
            type="email"
            value={email}
            onChange={e => setValue(e.target.value)}
            placeholder="your@email.com"
            required
            className="nl-waitlist-input"
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
            {status === 'loading' ? '…' : "I'm in"}
          </button>
        </form>
        {status === 'error' && (
          <p style={{ color: '#f87171', fontSize: 11, marginTop: 8 }}>Something went wrong — try again.</p>
        )}
      </div>
    </div>
  )
}
