'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw, ExternalLink, Image } from 'lucide-react'
import Link from 'next/link'

interface PostLog {
  id: string
  created_at: string
  posted_at: string | null
  post_id: string
  media_type: 'FEED' | 'STORIES' | 'CAROUSEL'
  image_url: string
  caption: string | null
  event_id: string | null
  slide_count: number
}

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver',
    })
  } catch { return iso }
}

function mediaTypeBadge(type: string) {
  if (type === 'CAROUSEL') return 'text-purple-300 bg-purple-400/10 border-purple-400/20'
  if (type === 'STORIES') return 'text-blue-300 bg-blue-400/10 border-blue-400/20'
  return 'text-white/60 bg-white/[0.06] border-white/10'
}

export default function HistoryPage() {
  const [posts, setPosts] = useState<PostLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PER_PAGE = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/ig/history?offset=${page * PER_PAGE}&limit=${PER_PAGE}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load history')
      if (page === 0) {
        setPosts(data)
      } else {
        setPosts(prev => [...prev, ...data])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin/ig" className="text-[11px] text-white/40 hover:text-white/70 uppercase tracking-widest mb-1 block">← Back to Editor</Link>
            <h1 className="text-xl font-bold">Post History</h1>
            <p className="text-sm text-white/40 mt-0.5">All posts published via the IG Editor</p>
          </div>
          <button onClick={() => { setPage(0); load() }} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40">
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

        {/* Post list */}
        {posts.length > 0 && (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="bg-[#111] border border-white/[0.07] rounded-xl p-4 flex gap-4">
                {/* Thumbnail */}
                <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center">
                  {post.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Image size={20} className="text-white/20" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${mediaTypeBadge(post.media_type)}`}>
                      {post.media_type}
                    </span>
                    {post.slide_count > 1 && (
                      <span className="text-[11px] text-white/40">{post.slide_count} slides</span>
                    )}
                  </div>

                  <p className="text-[11px] text-white/50 mb-1">
                    {formatDt(post.posted_at ?? post.created_at)}
                  </p>

                  {post.caption && (
                    <p className="text-[11px] text-white/40 line-clamp-2">{post.caption}</p>
                  )}
                </div>

                {/* Link */}
                {post.media_type !== 'STORIES' && (
                  <a href={`https://www.instagram.com/p/${post.post_id}/`} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 p-2 text-white/30 hover:text-white transition-colors" title="View on Instagram">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {posts.length >= PER_PAGE && (
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
            className="w-full mt-4 py-3 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/30 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Load more'}
          </button>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center py-16 text-white/30">
            <Image size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No posts yet.</p>
            <Link href="/admin/ig" className="text-[#9a442d] hover:underline text-sm mt-1 inline-block">Open the editor →</Link>
          </div>
        )}
      </div>
    </div>
  )
}
