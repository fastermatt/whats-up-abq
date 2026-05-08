import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Feedback is a utility form — noindex to avoid query-param duplicates in GSC,
// and canonical to collapse any URL variations (?category=&event_id=, etc.)
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://abqunplugged.com/feedback' },
}

export default function FeedbackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
