#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { chromium } from 'playwright'
import sharp from 'sharp'

export async function renderIG({
  baseUrl = 'http://localhost:3000',
  adminToken,
  templateId,
  ctx,
  format = '4:5',
  timeoutMs = 45000,
} = {}) {
  if (!adminToken) throw new Error('adminToken is required')
  if (!templateId) throw new Error('templateId is required')

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 })
    await context.addCookies([{ name: 'admin_token', value: adminToken, url: baseUrl }])
    const page = await context.newPage()

    await page.goto(`${baseUrl.replace(/\/$/, '')}/admin/ig/render`, { waitUntil: 'networkidle', timeout: timeoutMs })
    await page.waitForFunction(() => typeof window.__renderIG === 'function', undefined, { timeout: timeoutMs })

    const res = await page.evaluate(
      ([t, c, f]) => window.__renderIG(t, c, f),
      [templateId, ctx ?? {}, format],
    )
    if (!res?.ok) throw new Error(`render failed: ${res?.reason || 'unknown'}`)

    const base64 = res.dataUrl.split(',')[1]
    if (!base64) throw new Error('render failed: missing PNG data')

    const buffer = Buffer.from(base64, 'base64')
    const metadata = await sharp(buffer).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (width < 1000 || height < 1000) {
      throw new Error(`render failed: PNG too small (${width}x${height})`)
    }

    return { buffer, width, height }
  } finally {
    await browser.close()
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

function sampleContext() {
  return {
    postDate: '2026-06-20',
    cta: 'abqunplugged.com',
    events: [
      {
        title: 'Loverboy',
        date: '2026-06-19',
        time: '7:30 PM',
        venue: 'Isleta Amphitheater',
        category: 'Concerts',
      },
      {
        title: 'Sugar Land Space Cowboys at Albuquerque Isotopes',
        date: '2026-06-20',
        time: '6:35 PM',
        venue: 'Rio Grande Credit Union Field at Isotopes Park',
        category: 'Sports',
      },
      {
        title: 'Joe Machi',
        date: '2026-06-20',
        time: '7:00 PM',
        venue: "Hyena's Comedy Nightclub",
        category: 'Comedy',
      },
      {
        title: 'San Pacho',
        date: '2026-06-21',
        time: '9:00 PM',
        venue: 'Effex Nightclub',
        category: 'Nightlife',
      },
      {
        title: 'Company - The Musical',
        date: '2026-06-21',
        time: '2:00 PM',
        venue: 'Popejoy Hall',
        category: 'Arts & Theater',
      },
    ],
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const templateId = args.template
  const out = args.out
  const adminToken = args.token || process.env.ADMIN_SECRET

  if (!templateId || !out) {
    throw new Error('Usage: node scripts/ig-render.mjs --template weekend-digest --out /tmp/ig-render-test.png [--token XXX]')
  }

  const { buffer, width, height } = await renderIG({
    baseUrl: args.baseUrl || 'http://localhost:3000',
    adminToken,
    templateId,
    ctx: sampleContext(),
    format: args.format || '4:5',
  })

  await writeFile(out, buffer)
  console.log(JSON.stringify({ width, height, bytes: buffer.length }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
