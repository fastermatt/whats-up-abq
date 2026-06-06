'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star } from 'lucide-react'

interface Review {
  id: string
  rating: number
  body: string | null
  created_at: string
  profile?: { display_name: string | null; handle: string | null }
}

interface Props {
  eventId: string
}

export function ReviewSection({ eventId }: Props) {
  const supabase = createClient()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [myReview, setMyReview] = useState<Review | null>(null)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [selectedRating, setSelectedRating] = useState(0)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      // Fetch reviews (join profiles for display name)
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, body, created_at, user_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(20)

      const reviewList = (data ?? []) as (Review & { user_id: string })[]
      setReviews(reviewList)

      if (u) {
        const mine = reviewList.find((r) => r.user_id === u.id) ?? null
        setMyReview(mine)
        if (mine) {
          setSelectedRating(mine.rating)
          setBody(mine.body ?? '')
        }
      }
      setLoaded(true)
    }
    load()
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  async function handleSubmit() {
    if (!user || selectedRating === 0) return
    setSubmitting(true)

    const payload = {
      user_id: user.id,
      event_id: eventId,
      rating: selectedRating,
      body: body.trim() || null,
    }

    if (myReview) {
      await supabase.from('reviews').update(payload).eq('id', myReview.id)
    } else {
      await supabase.from('reviews').insert(payload)
    }

    // Refresh
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, body, created_at, user_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(20)

    const reviewList = (data ?? []) as (Review & { user_id: string })[]
    setReviews(reviewList)
    const mine = reviewList.find((r) => r.user_id === user.id) ?? null
    setMyReview(mine)
    setShowForm(false)
    setSubmitting(false)
  }

  if (!loaded) return null
  if (reviews.length === 0 && !user) return null

  return (
    <section className="mt-6 pt-6 border-t border-sand-light">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2
            className="text-base font-black text-ink"
            style={{ fontFamily: 'var(--font-epilogue)' }}
          >
            Reviews
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarDisplay rating={avgRating} size="sm" />
              <span className="text-xs text-ink-light">
                {avgRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-terra hover:underline"
          >
            {myReview ? 'Edit review' : 'Write a review'}
          </button>
        )}
        {!user && (
          <a href="/login" className="text-xs text-ink-light hover:text-terra">
            Sign in to review
          </a>
        )}
      </div>

      {/* Review form */}
      {showForm && user && (
        <div className="bg-white rounded-xl border border-sand-mid p-4 mb-4 shadow-sm">
          <p className="text-xs font-semibold text-ink-mid mb-2">
            {myReview ? 'Update your review' : 'Rate this event'}
          </p>

          {/* Star picker */}
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setSelectedRating(star)}
                className="p-0.5"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= (hoveredStar || selectedRating)
                      ? 'fill-[#f59e0b] text-[#f59e0b]'
                      : 'text-sand-mid'
                  }`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts (optional)…"
            rows={3}
            maxLength={500}
            className="w-full text-sm text-ink bg-[#fafaf8] border border-sand-light rounded-lg px-3 py-2 resize-none focus-visible:outline-none focus:border-terra transition-colors mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedRating === 0}
              className="px-4 py-2 rounded-xl bg-terra text-white text-xs font-semibold hover:bg-terra-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving…' : myReview ? 'Update' : 'Submit'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-sand-mid text-xs font-semibold text-ink-mid hover:border-terra transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.slice(0, 5).map((review) => (
            <div key={review.id} className="bg-white rounded-xl border border-sand-light p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <StarDisplay rating={review.rating} size="sm" />
                <span className="text-[10px] text-ink-light">
                  {new Date(review.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {review.body && (
                <p className="text-sm text-ink-mid leading-relaxed">{review.body}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-light">
          {user ? 'Be the first to review this event.' : 'No reviews yet.'}
        </p>
      )}
    </section>
  )
}

function StarDisplay({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${
            star <= Math.round(rating)
              ? 'fill-[#f59e0b] text-[#f59e0b]'
              : 'text-sand-mid'
          }`}
        />
      ))}
    </div>
  )
}
