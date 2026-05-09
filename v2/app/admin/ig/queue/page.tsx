'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Trash2, RefreshCw, Calendar, Clock, Image } from 'lucide-react'
import Link from 'next/link'

interface ScheduledPost {
  id: string
  created_at: string
  scheduled_for: string
  media_type: 'FEED' | 'STORIES' | 'CAROUSEL'
  image_urls: string[]
  caption: string | null
  event_id: string | null
  status: 'pending' | 'published' | 'failed' | 'cancelled'
  post_id: string | null
  error_msg: string | null
  published_at: string | null
}

function statusColor(status: string) {
  if (status === 'pending') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  if (status === 'published') return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (status === 'failed') return 'text-red-400 bg-red-400/10 border-red-400/20'
  return 'text-white/40 bg-white/[0.04] border-white/10'
}

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
    })
  } catch { return iso }
}

export default function QueuePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ig/schedule')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load')
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const cancel = async (id: string) => {
    if (!confirm('Cancel this scheduled post?')) return
    setCancelling(id)
    try {
      await fetch(`/api/admin/ig/schedule?id=${id}`, { method: 'DELETE' })
      await load()
    } finally {
      setCancelling(null)
    }
  }

  const pending = posts.filter(p => p.status === 'pending')
  const published = posts.filter(p => p.status === 'published')
  const failed = posts.filter(p => p.status === 'failed')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* IG admin sub-nav */}
        <nav className="flex items-center gap-1 text-[11px] text-white/40 mb-3">
          <Link href="/admin/ig"         className="px-2 py-1 rounded hover:bg-white/[0.05] hover:text-white/80 transition-colors">Editor</Link>
          <Link href="/admin/ig/week"    className="px-2 py-1 rounded hover:bg-white/[0.05] hover:text-white/80 transition-colors">Week Planner</Link>
          <span                            className="px-2 py-1 rounded bg-white/[0.07] text-white font-bold">Queue</span>
          <Link href="/admin/ig/history" className="px-2 py-1 rounded hover:bg-white/[0.05] hover:text-white/80 transition-colors">History</Link>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Post Queue</h1>
            <p className="text-sm text-white/40 mt-0.5">Scheduled Instagram posts — publishes every 15 min</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300 mb-4">{error}</div>
        )}

        {loading && posts.length === 0 && (
          <div className="flex items-center justify-center py-16 text-white/40">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Pending ({pending.length})
            </h2>
            <div className="space-y-3">
              {pending.map(post => (
                <PostCard key={post.id} post={post} onCancel={cancel} cancelling={cancelling === post.id} />
              ))}
            </div>
          </section>
        )}

        {/* Failed */}
        {failed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Failed ({failed.length})
            </h2>
            <div className="space-y-3">
              {failed.map(post => (
                <PostCard key={post.id} post={post} onCancel={cancel} cancelling={cancelling === post.id} />
              ))}
            </div>
          </section>
        )}

        {/* Published */}
        {published.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Published ({published.length})
            </h2>
            <div className="space-y-3">
              {published.map(post => (
                <PostCard key={post.id} post={post} onCancel={cancel} cancelling={false} />
              ))}
            </div>
          </section>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <Calendar size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No scheduled posts yet.</p>
            <Link href="/admin/ig" className="text-[#9a442d] hover:underline text-sm mt-1 inline-block">Open the editor →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function PostCard({ post, onCancel, cancelling }: { post: ScheduledPost; onCancel: (id: string) => void; cancelling: boolean }) {
  return (
    <div className="bg-[#111] border border-white/[0.07] rounded-xl p-4 flex gap-4">
      {/* Thumbnail */}
      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center">
        {post.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_urls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <Image size={20} className="text-white/20" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${statusColor(post.status)}`}>
            {post.status}
          </span>
          <span className="text-[11px] text-white/50">{post.media_type}</span>
          {post.image_urls.length > 1 && (
            <span className="text-[11px] text-white/40">{post.image_urls.length} slides</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-white/60 mb-1">
          <Clock size={11} />
          {post.status === 'published' && post.published_at
            ? `Published ${formatDt(post.published_at)}`
            : `Scheduled ${formatDt(post.scheduled_for)}`}
        </div>

        {post.caption && (
          <p className="text-[11px] text-white/40 truncate">{post.caption.slice(0, 100)}</p>
        )}
        {post.error_msg && (
          <p className="text-[11px] text-red-400 mt-1">{post.error_msg}</p>
        )}
        {post.post_id && (
          <a href={`https://www.instagram.com/p/${post.post_id}/`} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-[#9a442d] hover:underline mt-1 inline-block">View on IG →</a>
        )}
      </div>

      {/* Actions */}
      {post.status === 'pending' && (
        <button onClick={() => onCancel(post.id)} disabled={cancelling}
          className="shrink-0 p-2 text-white/30 hover:text-red-400 disabled:opacity-40 transition-colors" title="Cancel post">
          {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      )}
    </div>
  )
}
