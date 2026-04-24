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
        <p className="text-sm font-semibold">You&apos;re in ✦ Check your inbox to confirm.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111] border-t border-white/10 py-6 px-4">
      <div className="max-w-xl mx-auto text-center">
        <p className="text-white font-bold text-sm mb-1">
          ABQ&apos;s best weekend picks — every Thursday.
        </p>
        <p className="text-white/50 text-xs mb-3">Free. Local. No spam ever.</p>
        <form onSubmit={submit} className="flex gap-2 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={e => setValue(e.target.value)}
            placeholder="your@email.com"
            required
            className="flex-1 rounded-lg px-3 py-2 text-sm bg-white/10 text-white placeholder:text-white/40 border border-white/20 focus:outline-none focus:border-[#9a442d] transition-colors"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-lg px-4 py-2 text-sm font-bold bg-[#9a442d] text-white hover:bg-[#7d3525] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {status === 'loading' ? '…' : 'Get the list'}
          </button>
        </form>
        {status === 'error' && (
          <p className="text-red-400 text-xs mt-2">Something went wrong — try again.</p>
        )}
      </div>
    </div>
  )
}
