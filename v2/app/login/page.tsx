'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <main className="min-h-dvh bg-[--bg] flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            ABQ Unplugged
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="text-center animate-fade-up">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-14 h-14 text-[#4f6249]" />
              </div>
              <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Check your email
              </h1>
              <p className="text-sm text-[#8a7a74] mb-1">
                We sent a magic link to
              </p>
              <p className="text-sm font-semibold text-[#1a1614] mb-6">{email}</p>
              <p className="text-xs text-[#8a7a74]">
                Click the link in your email to sign in. No password needed.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-xs text-[#9a442d] hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="animate-fade-up">
              {/* Hero */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#9a442d] text-white text-2xl font-black mb-4" style={{ fontFamily: 'var(--font-epilogue)' }}>
                  A
                </div>
                <h1 className="text-2xl font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
                  Join ABQ Unplugged
                </h1>
                <p className="text-sm text-[#8a7a74]">
                  Save events, check in, earn badges, climb the leaderboard
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a74]" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#8a7a74] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ fontFamily: 'var(--font-epilogue)' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
              </form>

              {/* Social proof */}
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[
                  { n: '1,000+', label: 'Events' },
                  { n: 'Free',   label: 'Always' },
                  { n: 'ABQ',    label: 'Only' },
                ].map(({ n, label }) => (
                  <div key={label} className="bg-white rounded-xl p-3 border border-[#f0e4cc]">
                    <p className="text-sm font-black text-[#9a442d]" style={{ fontFamily: 'var(--font-epilogue)' }}>{n}</p>
                    <p className="text-[10px] text-[#8a7a74]">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-[10px] text-[#8a7a74] mt-6">
                No password. No spam. Just events.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
