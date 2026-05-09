'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError("Passwords don't match."); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/profile'), 2500)
    }
  }

  if (done) {
    return (
      <main id="main" className="min-h-dvh bg-[--bg] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-up">
            <CheckCircle className="w-14 h-14 text-[#4f6249] mx-auto mb-4" />
            <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Password updated
            </h1>
            <p className="text-sm text-[#6b5d57]">Redirecting you to your profile…</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main id="main" className="min-h-dvh bg-[--bg] flex flex-col">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="text-center mb-8">
            {/* Use the same wordmark as /login for brand continuity (round-4 #15) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-terra.svg"
              alt="ABQ Unplugged"
              className="mx-auto mb-4"
              style={{ width: '140px', height: 'auto' }}
            />
            <h1 className="text-2xl font-black text-[#1a1614] mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Set new password
            </h1>
            <p className="text-sm text-[#6b5d57]">Choose a password for your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5d57]" aria-hidden="true" />
                <input
                  id="new-password"
                  type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters" required minLength={6}
                  autoComplete="new-password"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'reset-error' : undefined}
                  className="w-full pl-9 pr-10 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#6b5d57] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                />
                <button
                  type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5d57] hover:text-[#4a3f3a]"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b5d57]" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showPw ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Same password again" required
                  autoComplete="new-password"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'reset-error' : undefined}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#6b5d57] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                />
              </div>
            </div>

            {error && (
              <p id="reset-error" role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: 'var(--font-epilogue)' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>

          <p className="text-center mt-6">
            <Link href="/login" className="text-xs text-[#6b5d57] hover:text-[#9a442d] transition-colors">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-20 bg-[--bg]/90 backdrop-blur-md border-b border-[#ddc9a3]/60">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/login" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
          ABQ Unplugged
        </span>
      </div>
    </header>
  )
}
