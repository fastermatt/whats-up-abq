import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
  classifyImageQuality,
  eventObjectName,
  prepareEventImage,
  storageObjectPath,
} from './event-image-pipeline.mjs'

test('quality tiers keep weak sources out of oversized presentation', () => {
  assert.equal(classifyImageQuality(319, 500), 'rejected')
  assert.equal(classifyImageQuality(500, 250), 'compact')
  assert.equal(classifyImageQuality(800, 450), 'standard')
  assert.equal(classifyImageQuality(1200, 675), 'high')
})

test('optimized output never enlarges the source and has a stable content hash', async () => {
  const source = await sharp({
    create: { width: 500, height: 280, channels: 3, background: '#9a442d' },
  }).png().toBuffer()
  const first = await prepareEventImage(source)
  const second = await prepareEventImage(source)

  assert.equal(first.ok, true)
  assert.equal(first.outW, 500)
  assert.equal(first.outH, 280)
  assert.equal(first.quality, 'compact')
  assert.equal(first.hash, second.hash)
  assert.equal(eventObjectName('local:one', first.hash), `local_one-${first.hash}.webp`)
})

test('sources below the usable floor are rejected', async () => {
  const source = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#006a62' },
  }).png().toBuffer()
  const result = await prepareEventImage(source)
  assert.equal(result.ok, false)
  assert.equal(result.quality, 'rejected')
})

test('managed public URLs resolve to exact storage object paths', () => {
  const base = 'https://example.supabase.co'
  const url = `${base}/storage/v1/object/public/event-photos/folder/event%20photo.webp`
  assert.equal(storageObjectPath(url, base), 'folder/event photo.webp')
  assert.equal(storageObjectPath('https://elsewhere.test/photo.webp', base), null)
})
