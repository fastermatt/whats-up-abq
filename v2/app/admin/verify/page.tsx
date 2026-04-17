'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AdminVerifyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type')
    const error      = searchParams.get('error')
    const errorDesc  = searchParams.get('error_description')

    if (error) {
      setStatus('error')
      setErrorMsg(errorDesc ?? error)
      return
    }

    if (!token_hash || type !== 'email') {
      setStatus('error')
      setErrorMsg('Invalid verification link.')
      return
    }

    // POST to verify API which sets the admin cookies
    fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_hash, type }),
    })
      .then(async res => {
        if (res.ok) {
          setStatus('success')
          // Brief pause so the user sees the success state, then navigate in
          setTimeout(() => {
            router.push('/admin')
            router.refresh()
          }, 1200)
        } else {
          const data = await res.json().catch(() => ({}))
          setStatus('error')
          setErrorMsg(data.error ?? 'Verification failed.')
        }
      })
      .catch(() => {
        setStatus('error')
        setErrorMsg('Network error. Please try again.')
      })
  }, [searchParams, router])

  return (
    <main className="min-h-dvh bg-[#1a1614] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-[#9a442d] mx-auto mb-4 animate-spin" />
            <p className="text-white font-semibold">Verifying your login link…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg">Verified!</p>
            <p className="text-[#8a7a74] text-sm mt-1">Redirecting to admin…</p>
            <p className="text-[#4a4040] text-xs mt-4">
              This device is now trusted for 90 days.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-semibold text-lg">Verification failed</p>
            <p className="text-[#8a7a74] text-sm mt-1">{errorMsg}</p>
            <a
              href="/admin/login"
              className="inline-block mt-6 text-[#9a442d] text-sm hover:text-[#c4603f] transition-colors"
            >
              ← Back to login
            </a>
          </>
        )}
      </div>
    </main>
  )
}
