/**
 * /admin/ig/preview?t=<templateId> — single-template render harness.
 * Admin-only. Used to visually verify any template with sample event data.
 */
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { PreviewClient } from './PreviewClient'

export const metadata = { title: 'Template Preview | ABQ Unplugged Admin' }

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const token  = cookieStore.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET
  return !!secret && token === secret
}

export default async function PreviewPage() {
  if (!(await isAdmin())) redirect('/admin/login?next=/admin/ig/preview')
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0a0a0a]" />}>
      <PreviewClient />
    </Suspense>
  )
}
