'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'

const REPORT_TYPES = [
  { value: 'wrong_info',      label: 'Wrong date, time, or price' },
  { value: 'wrong_category',  label: 'Wrong category' },
  { value: 'event_cancelled', label: 'Event is cancelled' },
  { value: 'duplicate',       label: 'Duplicate event' },
  { value: 'suggest_update',  label: 'Suggest an update' },
  { value: 'other',           label: 'Other' },
]

interface Props {
  eventId: string
  eventTitle: string
}

export function ReportForm({ eventId, eventTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setOpen(false)
    setReportType('')
    setMessage('')
    setEmail('')
    setError('')
    setTimeout(() => setSubmitted(false), 300)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportType) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          event_title: eventTitle,
          report_type: reportType,
          message: message || null,
          user_email: email || null,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
        setTimeout(reset, 2500)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-[#6b5d57] hover:text-[#1a1614] transition-colors py-1"
      >
        <Flag className="w-3 h-3" />
        Report an issue
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) reset() }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4cc]">
              <h3 className="font-bold text-[#1a1614] text-sm" style={{ fontFamily: 'var(--font-epilogue)' }}>
                Report an issue
              </h3>
              <button onClick={reset} className="text-[#6b5d57] hover:text-[#1a1614] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitted ? (
              <div className="px-5 py-10 text-center">
                <p className="text-2xl mb-2">✓</p>
                <p className="font-semibold text-[#1a1614] text-sm">Thanks for the report!</p>
                <p className="text-xs text-[#6b5d57] mt-1">We&apos;ll review it soon.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="px-5 py-4 space-y-4">
                {/* Event name preview */}
                <p className="text-xs text-[#6b5d57] line-clamp-1 italic">{eventTitle}</p>

                {/* Report type */}
                <div className="space-y-2">
                  {REPORT_TYPES.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="report_type"
                        value={value}
                        checked={reportType === value}
                        onChange={() => setReportType(value)}
                        className="accent-[#9a442d]"
                      />
                      <span className="text-sm text-[#1a1614] group-hover:text-[#9a442d] transition-colors">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="More details (optional)"
                  rows={2}
                  className="w-full border border-[#ddc9a3] rounded-xl px-3 py-2 text-sm text-[#1a1614] placeholder-[#6b5d57] focus:outline-none focus:border-[#9a442d] resize-none"
                />

                {/* Email */}
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your email (optional, for follow-up)"
                  className="w-full border border-[#ddc9a3] rounded-xl px-3 py-2 text-sm text-[#1a1614] placeholder-[#6b5d57] focus:outline-none focus:border-[#9a442d]"
                />

                {error && <p className="text-red-500 text-xs">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex-1 py-2.5 rounded-xl border border-[#ddc9a3] text-sm text-[#4a3f3a] hover:bg-[#f5f0e8] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!reportType || submitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#9a442d] text-white text-sm font-semibold hover:bg-[#7d3725] transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
