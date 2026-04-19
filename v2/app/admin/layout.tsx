import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogoutButton } from './LogoutButton'

export const metadata = { title: 'Admin | ABQ Unplugged' }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Don't auth-check the public admin pages (login + verify flow)
  // The verify page completes 2FA on a fresh device BEFORE admin_token is set,
  // so it has to render without the cookie check.
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const ADMIN_PUBLIC_PAGES = ['/admin/login', '/admin/verify']
  if (ADMIN_PUBLIC_PAGES.includes(pathname)) {
    return <>{children}</>
  }

  // Verify admin token in Node.js runtime (process.env is reliable here)
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  if (!secret || token !== secret) {
    redirect('/admin/login')
  }
  return (
    <div className="min-h-dvh bg-[#1a1614] text-white">
      <nav className="border-b border-white/10 px-6 py-3 flex items-center gap-6 sticky top-0 bg-[#1a1614]/95 backdrop-blur z-10">
        <span className="font-black text-[#9a442d]" style={{ fontFamily: 'var(--font-epilogue)' }}>
          Admin
        </span>
        <Link href="/admin" className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</Link>
        <Link href="/admin/submissions" className="text-sm text-white/60 hover:text-white transition-colors">Submissions</Link>
        <Link href="/admin/feedback" className="text-sm text-white/60 hover:text-white transition-colors">Feedback</Link>
        <Link href="/admin/reports" className="text-sm text-white/60 hover:text-white transition-colors">Reports</Link>
        <Link href="/admin/events" className="text-sm text-white/60 hover:text-white transition-colors">Events</Link>
        <Link href="/admin/analytics" className="text-sm text-white/60 hover:text-white transition-colors">Analytics</Link>
        <Link href="/admin/ig" className="text-sm text-white/60 hover:text-white transition-colors">Instagram</Link>
        <div className="flex-1" />
        <Link href="/" className="text-xs text-white/40 hover:text-white/60 transition-colors">← Site</Link>
        <LogoutButton />
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
