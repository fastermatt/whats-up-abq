#!/usr/bin/env node
/**
 * Conservative Supabase Storage retention.
 *
 * Default is a report-only dry run. --apply removes a bounded number of
 * objects that are older than the grace period and absent from every known DB
 * image field and the checked-in source tree. Deletions always use the Storage
 * API; deleting storage.objects rows with SQL would orphan the real files.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { dirname, extname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import { storageObjectPath } from './lib/event-image-pipeline.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectDir = join(scriptDir, '..')

for (const envFile of [join(scriptDir, '.env'), join(projectDir, '.env.local')]) {
  if (!existsSync(envFile)) continue
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim()
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('❌ SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const args = process.argv.slice(2)
const value = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const apply = args.includes('--apply')
const limit = Math.max(1, Math.min(1000, Number(value('limit', '250'))))
const graceDays = Math.max(7, Number(value('grace-days', '30')))
const requestedBucket = value('bucket', 'all')
const buckets = requestedBucket === 'all' ? ['event-photos', 'place-photos'] : [requestedBucket]
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.txt'])
const SKIP_DIRECTORIES = new Set(['.git', '.next', 'node_modules', '.netlify'])
const PROTECTED_EVENT_PREFIXES = ['holiday-images/', 'ig-posts/']

function collectSourceText(dir = projectDir) {
  let text = ''
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      text += collectSourceText(fullPath)
    } else if (TEXT_EXTENSIONS.has(extname(entry.name)) && statSync(fullPath).size < 5_000_000) {
      text += `\n${relative(projectDir, fullPath)}\n${readFileSync(fullPath, 'utf8')}`
    }
  }
  return text
}

function addUrlReference(references, value, bucket) {
  if (typeof value !== 'string') return
  const objectPath = storageObjectPath(value, supabaseUrl, bucket)
  if (objectPath) references.add(objectPath)
}

function addNestedReferences(references, value, bucket) {
  if (typeof value === 'string') return addUrlReference(references, value, bucket)
  if (Array.isArray(value)) return value.forEach(item => addNestedReferences(references, item, bucket))
  if (!value || typeof value !== 'object') return
  Object.values(value).forEach(item => addNestedReferences(references, item, bucket))
}

async function fetchAll(table, columns) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.schema('public').from(table)
      .select(columns).range(offset, offset + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function collectDatabaseReferences(bucket) {
  const references = new Set()
  const sources = await Promise.all([
    fetchAll('events', 'cached_photo_url,cached_thumbnail_url'),
    fetchAll('event_submissions', 'photo_url'),
    fetchAll('ig_scheduled_posts', 'image_urls'),
    fetchAll('ig_post_log', 'image_url'),
    fetchAll('ig_post_suggestions', 'image_data_url,event_data'),
  ])
  for (const rows of sources) {
    for (const row of rows) addNestedReferences(references, row, bucket)
  }
  return references
}

async function listFolder(bucket, prefix = '') {
  const objects = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`)
    for (const item of data ?? []) {
      const name = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id == null && item.metadata == null) objects.push(...await listFolder(bucket, name))
      else objects.push({ ...item, name })
    }
    if (!data || data.length < 1000) break
  }
  return objects
}

function isProtected(bucket, objectName) {
  if (bucket !== 'event-photos') return false
  return PROTECTED_EVENT_PREFIXES.some(prefix => objectName.startsWith(prefix))
}

function selectCandidates({ bucket, objects, dbReferences, sourceText }) {
  const cutoff = Date.now() - graceDays * 86_400_000
  return objects.filter(object => {
    if (isProtected(bucket, object.name) || dbReferences.has(object.name)) return false
    if (sourceText.includes(object.name)) return false
    const createdAt = Date.parse(object.created_at ?? '')
    return Number.isFinite(createdAt) && createdAt < cutoff
  })
}

async function removeCandidates(bucket, candidates) {
  let removed = 0
  for (let index = 0; index < candidates.length; index += 100) {
    const names = candidates.slice(index, index + 100).map(object => object.name)
    const { error } = await supabase.storage.from(bucket).remove(names)
    if (error) throw new Error(`${bucket} delete: ${error.message}`)
    removed += names.length
  }
  return removed
}

async function main() {
  const sourceText = collectSourceText()
  console.log(`🧹 Storage retention — ${apply ? 'APPLY' : 'DRY RUN'} · grace=${graceDays}d · limit=${limit}`)

  for (const bucket of buckets) {
    const [objects, dbReferences] = await Promise.all([
      listFolder(bucket),
      collectDatabaseReferences(bucket),
    ])
    const allCandidates = selectCandidates({ bucket, objects, dbReferences, sourceText })
    const candidates = allCandidates.slice(0, limit)
    const bytes = candidates.reduce((sum, object) => sum + Number(object.metadata?.size ?? 0), 0)
    console.log(`  [${bucket}] ${objects.length} objects · ${allCandidates.length} eligible · ${candidates.length} this run · ${(bytes / 1_048_576).toFixed(1)} MiB`)
    for (const object of candidates.slice(0, 12)) console.log(`    ${apply ? 'DELETE' : 'would delete'} ${object.name}`)
    if (allCandidates.length > 12) console.log(`    …and ${Math.max(0, candidates.length - 12)} more in this bounded run`)
    if (apply && candidates.length > 0) {
      const removed = await removeCandidates(bucket, candidates)
      console.log(`    ✓ removed ${removed} object(s) through the Storage API`)
    }
  }
}

main().catch(error => {
  console.error('❌ Storage retention failed:', error.message)
  process.exit(1)
})
