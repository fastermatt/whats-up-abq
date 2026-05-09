'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
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
      router.push('/admin')
      router.refresh()
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main id="main" className="min-h-dvh bg-[#1a1614] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-[#9a442d]/20 flex items-center justify-center mb-6">
          <Lock className="w-5 h-5 text-[#9a442d]" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-epilogue)' }}>
          ABQ Unplugged
        </h1>
        <p className="text-white/65 text-sm mb-8">Admin portal</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-white/85 mb-1.5">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={!!error}
              aria-describedby={error ? 'admin-login-error' : undefined}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/45 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9a442d] focus:ring-2 focus:ring-[#9a442d]/30 transition-colors"
            />
          </div>
          {error && (
            <p id="admin-login-error" role="alert" className="text-red-400 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#9a442d] text-white font-semibold py-3 rounded-xl text-sm hover:bg-[#7d3725] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
