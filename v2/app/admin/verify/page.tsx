'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AdminVerifyPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function verify() {
      // Read from BOTH query params (PKCE flow) AND hash fragment (implicit flow)
      const urlParams  = new URLSearchParams(window.location.search)
      const hashStr    = window.location.hash.replace(/^#/, '')
      const hashParams = new URLSearchParams(hashStr)

      // Supabase error (URL wasn't whitelisted, or token expired, etc.)
      const error     = urlParams.get('error')     || hashParams.get('error')
      const errorDesc = urlParams.get('error_description') || hashParams.get('error_description')
      if (error) {
        setStatus('error')
        setErrorMsg(errorDesc ?? error)
        return
      }

      const supabase = createClient()

      // ── PKCE flow: token_hash in query params ───────────────────────────────
      const token_hash = urlParams.get('token_hash')
      const type       = urlParams.get('type')
      if (token_hash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'email',
        })
        if (verifyError) {
          setStatus('error')
          setErrorMsg(verifyError.message)
          return
        }
        await grantAdminAccess()
        return
      }

      // ── Implicit flow: access_token in hash ────────────────────────────────
      const access_token  = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token') ?? ''
      if (access_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })
        if (sessionError) {
          setStatus('error')
          setErrorMsg(sessionError.message)
          return
        }
        await grantAdminAccess()
        return
      }

      // Nothing usable in URL — link was probably already used or is malformed
      setStatus('error')
      setErrorMsg('Verification link is invalid or has already been used. Request a new login link.')
    }

    async function grantAdminAccess() {
      // Tell the server there is now a valid Supabase session; it will set admin cookies
      const res = await fetch('/api/admin/verify-session', { method: 'POST' })
      if (res.ok) {
        setStatus('success')
        setTimeout(() => { router.push('/admin'); router.refresh() }, 1200)
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus('error')
        setErrorMsg(data.error ?? 'Failed to create admin session. Please try again.')
      }
    }

    verify()
  }, [router])

  return (
    <main id="main" className="min-h-dvh bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-terra mx-auto mb-4 animate-spin" />
            <p className="text-white font-semibold">Verifying your login link…</p>
            <p className="text-ink-light text-sm mt-1">This only takes a moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Verified!
            </p>
            <p className="text-ink-light text-sm mt-1">Taking you to the admin panel…</p>
            <p className="text-[#4a4040] text-[11px] mt-4">
              This device is now trusted for 90 days.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg" style={{ fontFamily: 'var(--font-epilogue)' }}>
              Verification failed
            </p>
            <p className="text-ink-light text-sm mt-1 leading-relaxed">{errorMsg}</p>
            <a
              href="/admin/login"
              className="inline-block mt-6 px-4 py-2 rounded-lg bg-terra/20 text-terra text-sm hover:bg-terra/30 transition-colors"
            >
              ← Back to login
            </a>
          </>
        )}
      </div>
    </main>
  )
}
