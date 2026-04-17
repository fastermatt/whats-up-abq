'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = '4mattcarlson@gmail.com'
const SITE_URL    = 'https://abqunplugged.com'

export default function AdminLoginPage() {
  const [password, setPassword]     = useState('')
  const [error,    setError]         = useState('')
  const [loading,  setLoading]       = useState(false)
  const [state,    setState]         = useState<'login' | 'check_email'>('login')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Incorrect password')
        return
      }
      if (data.action === 'verify_required') {
        // Initiate OTP from the CLIENT (browser) so PKCE code verifier is stored locally
        const supabase = createClient()
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: ADMIN_EMAIL,
          options: {
            emailRedirectTo: `${SITE_URL}/admin/verify`,
            shouldCreateUser: true,
          },
        })
        if (otpError) {
          // Most common case: rate limited (429 from Supabase after repeated tries)
          const msg = /rate|429|security|For security/i.test(otpError.message)
            ? 'Too many login attempts. Wait a minute and try again.'
            : otpError.message
          setError(msg)
          return
        }
        setState('check_email')
        return
      }
      // Trusted device — straight in
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (state === 'check_email') {
    return (
      <main className="min-h-dvh bg-[#1a1614] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-[#9a442d]/20 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-[#9a442d]" />
          </div>
          <h1 className="text-xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-epilogue)' }}>
            Check your email
          </h1>
          <p className="text-[#8a7a74] text-sm leading-relaxed mb-4">
            A login link was sent to <span className="text-white font-medium">4mattcarlson@gmail.com</span>.
            Click it to complete sign-in.
          </p>
          <p className="text-[#8a7a74] text-xs">
            This link expires in 10 minutes. Check your spam folder if you don&apos;t see it.
          </p>
          <button
            onClick={() => { setState('login'); setPassword(''); setError('') }}
            className="mt-6 text-[#9a442d] text-xs hover:text-[#c4603f] transition-colors"
          >
            ← Try a different password
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[#1a1614] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-[#9a442d]/20 flex items-center justify-center mb-6">
          <Lock className="w-5 h-5 text-[#9a442d]" />
        </div>
        <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
          ABQ Unplugged
        </h1>
        <p className="text-[#8a7a74] text-sm mb-8">Admin portal</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9a442d] transition-colors"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#9a442d] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#7d3725] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-[#4a4040] text-[10px] text-center mt-6">
          New devices require email verification
        </p>
      </div>
    </main>
  )
}
