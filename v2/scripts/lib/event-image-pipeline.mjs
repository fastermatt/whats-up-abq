import { createHash } from 'crypto'
import sharp from 'sharp'

export const EVENT_IMAGE_POLICY = Object.freeze({
  targetWidth: 1080,
  minWidth: 320,
  minHeight: 180,
  webpQuality: 78,
})

export function sanitizeEventId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)
}

export function classifyImageQuality(width, height) {
  if (width < EVENT_IMAGE_POLICY.minWidth || height < EVENT_IMAGE_POLICY.minHeight) return 'rejected'
  if (width >= 1000 && height >= 560) return 'high'
  if (width >= 640 && height >= 360) return 'standard'
  return 'compact'
}

export function storageObjectPath(publicUrl, supabaseUrl, bucket = 'event-photos') {
  if (!publicUrl) return null
  try {
    const url = new URL(publicUrl)
    if (url.host !== new URL(supabaseUrl).host) return null
    const marker = `/storage/v1/object/public/${bucket}/`
    const index = url.pathname.indexOf(marker)
    return index === -1 ? null : decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

export function eventObjectName(eventId, hash) {
  return `${sanitizeEventId(eventId)}-${hash}.webp`
}

export async function prepareEventImage(buffer) {
  try {
    const source = sharp(buffer, { failOn: 'none' }).rotate()
    const metadata = await source.metadata()
    if (!metadata.width || !metadata.height) return { ok: false, reason: 'no-dimensions' }

    const quality = classifyImageQuality(metadata.width, metadata.height)
    if (quality === 'rejected') {
      return {
        ok: false,
        reason: `too-low-res: ${metadata.width}x${metadata.height}`,
        width: metadata.width,
        height: metadata.height,
        quality,
      }
    }

    const result = await source
      .resize({ width: EVENT_IMAGE_POLICY.targetWidth, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: EVENT_IMAGE_POLICY.webpQuality, effort: 4 })
      .toBuffer({ resolveWithObject: true })
    const hash = createHash('sha256').update(result.data).digest('hex').slice(0, 16)

    return {
      ok: true,
      buffer: result.data,
      contentType: 'image/webp',
      ext: 'webp',
      hash,
      quality,
      srcW: metadata.width,
      srcH: metadata.height,
      outW: result.info.width,
      outH: result.info.height,
      outSize: result.data.length,
    }
  } catch (error) {
    return { ok: false, reason: `sharp: ${error.message.slice(0, 100)}` }
  }
}

export async function uploadPreparedImage(supabase, eventId, prepared, bucket = 'event-photos') {
  const key = eventObjectName(eventId, prepared.hash)
  const { error } = await supabase.storage.from(bucket).upload(key, prepared.buffer, {
    contentType: prepared.contentType,
    cacheControl: '31536000',
    upsert: false,
  })
  const duplicate = error && (error.statusCode === '409' || /already exists|duplicate/i.test(error.message))
  if (error && !duplicate) return { ok: false, reason: error.message }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key)
  return { ok: true, key, url: data.publicUrl, reused: Boolean(duplicate) }
}

export function imageMetadata(prepared) {
  return {
    image_width: prepared.srcW,
    image_height: prepared.srcH,
    image_bytes: prepared.outSize,
    image_hash: prepared.hash,
    image_quality: prepared.quality,
  }
}

export async function removeSupersededImage({ supabase, previousUrl, nextUrl, supabaseUrl, bucket = 'event-photos' }) {
  if (!previousUrl || previousUrl === nextUrl) return { removed: false, reason: 'unchanged' }
  const previousKey = storageObjectPath(previousUrl, supabaseUrl, bucket)
  if (!previousKey) return { removed: false, reason: 'not-managed' }

  const { count: photoCount, error: photoError } = await supabase
    .schema('public')
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('cached_photo_url', previousUrl)
  if (photoError) return { removed: false, reason: `reference-check: ${photoError.message}` }

  const { count: thumbCount, error: thumbError } = await supabase
    .schema('public')
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('cached_thumbnail_url', previousUrl)
  if (thumbError) return { removed: false, reason: `reference-check: ${thumbError.message}` }
  if ((photoCount ?? 0) + (thumbCount ?? 0) > 0) return { removed: false, reason: 'still-referenced' }

  const { error } = await supabase.storage.from(bucket).remove([previousKey])
  return error
    ? { removed: false, reason: error.message }
    : { removed: true, key: previousKey }
}
