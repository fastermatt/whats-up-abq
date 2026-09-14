import test from 'node:test'
import assert from 'node:assert/strict'
import { fallbackCaption, parseCaptionResponse } from './ig-autopost.mjs'

test('accepts the preferred plain-text caption format', () => {
  assert.equal(parseCaptionResponse('Burque has plans.\n\nFull details at the link in bio.'), 'Burque has plans.\n\nFull details at the link in bio.')
})

test('unwraps legacy JSON captions and decodes line breaks', () => {
  const value = '{"caption":"Three picks for Burque.\\n\\nWhich one is yours? 👇\\n\\n#ABQ #Burque"}'
  assert.equal(parseCaptionResponse(value), 'Three picks for Burque.\n\nWhich one is yours? 👇\n\n#ABQ #Burque')
})

test('extracts a JSON caption surrounded by model commentary', () => {
  const value = 'Here is the caption:\n{"caption":"One good weekend.\\n\\n#ABQ"}\nHope this helps.'
  assert.equal(parseCaptionResponse(value), 'One good weekend.\n\n#ABQ')
})

test('recovers the malformed wrapper that previously leaked to Instagram', () => {
  const value = '{"caption": "Riley Green and Lobo football.\\n\\nTwo big gatherings.\\n\\n#ABQ #Burque"}'
  assert.equal(parseCaptionResponse(value), 'Riley Green and Lobo football.\n\nTwo big gatherings.\n\n#ABQ #Burque')
})

test('digest fallback stays short and does not duplicate the event list', () => {
  const caption = fallbackCaption([
    { title: 'First Event' },
    { title: 'Second Event' },
  ], { kind: 'digest' })

  assert.equal(caption.includes('First Event'), false)
  assert.equal(caption.includes('Second Event'), false)
  assert.ok(caption.split(/\s+/).length < 60)
  assert.equal((caption.match(/#[\w]+/g) ?? []).length, 6)
})
