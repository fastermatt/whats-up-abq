'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'

type Tab = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab]           = useState<Tab>('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState<'signup-confirm' | 'magic-sent' | 'reset-sent' | null>(null)
  const [error, setError]       = useState('')
  const [showMagic, setShowMagic] = useState(false)

  function reset() {
    setError('')
    setDone(null)
  }

  // ── Sign in with password ───────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true); reset()

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)
    if (err) {
      setError(err.message === 'Invalid login credentials'
        ? 'Wrong email or password. Try again, or use "Forgot password".'
        : err.message)
    } else {
      router.push('/profile')
      router.refresh()
    }
  }

  // ── Sign up with password ───────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    if (password !== confirm) { setError('Passwords don\'t match.'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return }
    setLoading(true); reset()

    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else if (data.session) {
      // Email confirmations disabled — user is instantly logged in
      router.push('/profile')
      router.refresh()
    } else {
      // Email confirmation required
      setDone('signup-confirm')
    }
  }

  // ── Send magic link ─────────────────────────────────────────────────────────
  async function handleMagic(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); reset()

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    })

    setLoading(false)
    if (err) setError(err.message)
    else setDone('magic-sent')
  }

  // ── Forgot password ─────────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address first.'); return }
    setLoading(true); reset()

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/auth/reset-password`,
    })

    setLoading(false)
    if (err) setError(err.message)
    else setDone('reset-sent')
  }

  // ── Success screens ─────────────────────────────────────────────────────────
  if (done) {
    const messages = {
      'signup-confirm': {
        icon: <CheckCircle className="w-14 h-14 text-[#4f6249]" />,
        heading: 'Check your email',
        body: `We sent a confirmation link to ${email}. Click it to activate your account.`,
        sub: 'Can\'t find it? Check your spam folder.',
      },
      'magic-sent': {
        icon: <CheckCircle className="w-14 h-14 text-[#4f6249]" />,
        heading: 'Magic link sent',
        body: `Click the link in the email we sent to ${email} to sign in instantly.`,
        sub: 'The link expires in 1 hour.',
      },
      'reset-sent': {
        icon: <CheckCircle className="w-14 h-14 text-[#4f6249]" />,
        heading: 'Check your email',
        body: `We sent a password reset link to ${email}.`,
        sub: 'The link expires in 1 hour.',
      },
    }[done]

    return (
      <main className="min-h-dvh bg-[--bg] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center animate-fade-up">
            <div className="flex justify-center mb-4">{messages.icon}</div>
            <h1 className="text-2xl font-black text-[#1a1614] mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
              {messages.heading}
            </h1>
            <p className="text-sm text-[#4a3f3a] mb-2">{messages.body}</p>
            <p className="text-xs text-[#8a7a74] mb-6">{messages.sub}</p>
            <button onClick={() => { setDone(null); setShowMagic(false) }} className="text-xs text-[#9a442d] hover:underline">
              ← Back to sign in
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh bg-[--bg] flex flex-col">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-fade-up">

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#9a442d] text-white text-2xl font-black mb-3" style={{ fontFamily: 'var(--font-epilogue)' }}>
              A
            </div>
            <p className="text-sm text-[#8a7a74]">Save events · Check in · Earn badges</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-[#f0e4cc] p-1 mb-6">
            {(['signin', 'signup'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); reset() }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-white text-[#1a1614] shadow-sm'
                    : 'text-[#8a7a74] hover:text-[#4a3f3a]'
                }`}
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {t === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Password form */}
          {!showMagic && (
            <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a74]" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#8a7a74] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a74]" />
                  <input
                    type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={tab === 'signup' ? 'At least 6 characters' : '••••••••'}
                    required minLength={6}
                    autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    className="w-full pl-9 pr-10 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#8a7a74] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                  />
                  <button
                    type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a7a74] hover:text-[#4a3f3a]"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password (signup only) */}
              {tab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a74]" />
                    <input
                      type={showPw ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Same password again"
                      required autoComplete="new-password"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#8a7a74] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Forgot password (signin only) */}
              {tab === 'signin' && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button" onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-xs text-[#9a442d] hover:underline disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading || !email.trim() || !password}
                className="w-full py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Please wait…' : tab === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          )}

          {/* Magic link form */}
          {showMagic && (
            <form onSubmit={handleMagic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4a3f3a] mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7a74]" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#ddc9a3] bg-white text-sm text-[#1a1614] placeholder:text-[#8a7a74] focus:outline-none focus:ring-2 focus:ring-[#9a442d]/30 focus:border-[#9a442d] transition-all"
                  />
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
              )}
              <button
                type="submit" disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl bg-[#9a442d] text-white font-semibold text-sm hover:bg-[#7d3725] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: 'var(--font-epilogue)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* Toggle between password and magic link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => { setShowMagic(v => !v); reset() }}
              className="text-xs text-[#8a7a74] hover:text-[#9a442d] transition-colors"
            >
              {showMagic ? '← Sign in with password instead' : 'Or sign in without a password →'}
            </button>
          </div>

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

          <p className="text-center text-[10px] text-[#8a7a74] mt-4">
            No spam. Just Albuquerque.
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
        <Link href="/" className="flex items-center gap-1.5 text-sm text-[#4a3f3a] hover:text-[#9a442d] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <span className="font-black text-lg text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
          ABQ Unplugged
        </span>
      </div>
    </header>
  )
}
