import type { ReactNode } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminNav } from './AdminNav'

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
    <div className="min-h-dvh bg-ink text-white">
      <AdminNav />
      <main id="main" className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {children}
      </main>
    </div>
  )
}
