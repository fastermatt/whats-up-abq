'use client'

/**
 * Template preview harness — renders any single template with sample event
 * data so it can be visually verified (and screenshotted) with real content.
 *
 * Usage: /admin/ig/preview?t=poster   (or any template id)
 *        /admin/ig/preview?t=poster&title=...&venue=...  to override sample data
 *
 * This is the "test rendering with real data before shipping" infrastructure
 * the design audit recommended. Renders one canvas, full size, on a plain bg.
 */

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { TEMPLATES, TemplateContext } from '../lib/templates'
import { useEditor } from '../store'

const PostCanvas = dynamic(
  () => import('../components/PostCanvas').then(m => m.PostCanvas),
  { ssr: false }
)

// Sample single-event context (real-ish ABQ event with a photo)
const SAMPLE_EVENT: TemplateContext = {
  title:    'Lone Piñon CD Release Celebration',
  date:     '2026-06-12',
  time:     '8:00 PM',
  venue:    'Roy E. Disney Center for Performing Arts: Bank of America Theatre',
  category: 'Music',
  cta:      'abqunplugged.com',
  imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1080&q=80',
}

// Sample multi-event context (for digest templates)
const SAMPLE_EVENTS: TemplateContext['events'] = [
  { title: 'New Mexico United vs. Phoenix Rising FC', date: '2026-06-12', time: '7:25 PM', venue: 'Rio Grande Credit Union Field at Isotopes Park', category: 'Sports' },
  { title: 'Ryan Sickler', date: '2026-06-12', time: '7:00 PM', venue: "Hyena's Comedy Nightclub - Albuquerque", category: 'Comedy' },
  { title: 'Riot Ten', date: '2026-06-12', time: '9:00 PM', venue: 'Launchpad', category: 'Music' },
  { title: 'Film Documentary: Water for Life', date: '2026-06-13', time: '2:00 PM', venue: 'Roy E. Disney Center for Performing Arts: Bank of America Theatre', category: 'Film' },
  { title: 'The Little Gym of Albuquerque: A Night at the Theatre', date: '2026-06-13', time: '6:00 PM', venue: 'Roy E. Disney Center for Performing Arts: Albuquerque Journal Theatre', category: 'Family' },
]

export function PreviewClient() {
  const params = useSearchParams()
  const templateId = params.get('t') ?? 'poster'
  const loadDesign = useEditor(s => s.loadDesign)

  useEffect(() => {
    const tmpl = TEMPLATES.find(t => t.id === templateId)
    if (!tmpl) return
    const isDigest = ['weekend-digest', 'tonight-list', 'weekly-five'].includes(templateId)
    const ctx: TemplateContext = isDigest
      ? { events: SAMPLE_EVENTS, postDate: SAMPLE_EVENTS![0].date }
      : {
          ...SAMPLE_EVENT,
          title:    params.get('title')    ?? SAMPLE_EVENT.title,
          venue:    params.get('venue')    ?? SAMPLE_EVENT.venue,
          category: params.get('category') ?? SAMPLE_EVENT.category,
          imageUrl: params.get('noimg') === '1' ? undefined : SAMPLE_EVENT.imageUrl,
        }
    loadDesign(tmpl.build(ctx, '4:5'))
  }, [templateId, loadDesign, params])

  const exists = TEMPLATES.some(t => t.id === templateId)

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center p-6 gap-3">
      <p className="text-white/40 text-xs font-mono" data-preview-label={templateId}>
        {exists ? templateId : `unknown template: ${templateId}`}
      </p>
      <div className="w-[432px]" data-preview-canvas>
        <PostCanvas />
      </div>
    </div>
  )
}
