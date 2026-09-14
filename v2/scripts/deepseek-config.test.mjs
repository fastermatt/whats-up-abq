import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const DEEPSEEK_CALLERS = [
  'scripts/audit-accuracy.mjs',
  'scripts/enrich-about-deepseek.mjs',
  'scripts/enrich-about.mjs',
  'scripts/enrich-deepseek.mjs',
  'scripts/gen-next-week.mjs',
  'scripts/ig-autopost.mjs',
  'scripts/score-popularity.mjs',
  'scripts/scrape-abqtodo.mjs',
  'scripts/scrape-babydolls.mjs',
  'scripts/scrape-local-venues.mjs',
  'scripts/scrape-lovenm.mjs',
  'app/api/admin/ai/caption/route.ts',
  'app/api/admin/generate-caption/route.ts',
  'app/api/admin/ig/suggestions/generate/route.ts',
]

test('every DeepSeek caller uses V4.1 Flash without hidden reasoning', async () => {
  for (const file of DEEPSEEK_CALLERS) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.match(source, /deepseek-flash/, `${file} must use deepseek-flash`)
    assert.doesNotMatch(source, /deepseek-(?:chat|reasoner|v4-flash)/, `${file} still uses a legacy model`)
    assert.match(source, /thinking\s*:\s*\{\s*type\s*:\s*['"]disabled['"]\s*\}/, `${file} must disable thinking`)
  }
})
