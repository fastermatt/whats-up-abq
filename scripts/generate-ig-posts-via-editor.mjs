#!/usr/bin/env node
/**
 * Drive the real /ig-editor.html headlessly via Playwright to generate
 * polished launch posts that look exactly like what Matt will produce
 * manually going forward. Output: 1080×1350 portrait PNGs using the
 * actual editor's typography, templates, html2canvas rendering.
 *
 * Requires:
 *   npx playwright install chromium   (one-time)
 *
 * Outputs to ~/Desktop/ABQ Unplugged/Launch Posts/
 */

import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const SITE = process.env.IG_SITE || 'https://abqunplugged.com'
const OUT  = path.join(os.homedir(), 'Desktop', 'ABQ Unplugged', 'Launch Posts')

// Template + format chosen per post for best visual fit.
// Templates: poster | ticket | mesa | editorial | marquee | polaroid
const POSTS = [
  // event_id                              , template   , label                                  , slug
  { id: 'ticketmaster_Z7r9jZ1A74U7e'       , tmpl: 'poster'    , slug: '01-popejoy-mrs-doubtfire'       , note: 'Launch / Arts & Theater' },
  { id: 'seatgeek_17870147'                , tmpl: 'marquee'   , slug: '02-sunshine-health-carpenter'   , note: 'Music — Tonight' },
  { id: 'ticketmaster_Z7r9jZ1A7OxCA'       , tmpl: 'marquee'   , slug: '03-revel-david-lee-roth'        , note: 'Music — big name' },
  { id: 'seatgeek_18035690'                , tmpl: 'editorial' , slug: '04-sunshine-crane-wives'        , note: 'Music — editorial' },
  { id: 'seatgeek_18163305'                , tmpl: 'poster'    , slug: '05-revel-letdown'               , note: 'Music — hidden gem' },
  { id: 'ticketmaster_Z7r9jZ1A7OF0w'       , tmpl: 'ticket'    , slug: '06-nm-united-avalta'            , note: 'Sports — NM United' },
  { id: 'abqtodo-10172793'                 , tmpl: 'polaroid'  , slug: '07-snapdragon-fairy-tea'        , note: 'Food & Drink' },
  { id: 'abqtodo-10123661'                 , tmpl: 'editorial' , slug: '08-old-town-walking-tour'       , note: 'Old Town Tour' },
  { id: 'abqtodo-10150941'                 , tmpl: 'mesa'      , slug: '09-north-valley-storytime'      , note: 'Family — storytime' },
  { id: 'abqtodo-515562'                   , tmpl: 'polaroid'  , slug: '10-dia-de-los-ninos'            , note: 'Family — Día del Niño' },
]

async function generateOne(browser, post) {
  const url = `${SITE}/ig-editor.html?url=/events/${post.id}&tmpl=${post.tmpl}&fmt=portrait`
  // Fresh context per post — no cache / localStorage / cookies from previous runs
  const context = await browser.newContext({ viewport: { width: 1400, height: 1700 } })
  const page = await context.newPage()
  console.log(`→ ${post.slug} (${post.tmpl})`)

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for hook to be exposed
    await page.waitForFunction(
      () => typeof window.__igEditorCapturePNG === 'function',
      { timeout: 15000 }
    )

    // Wait for the REAL event image to be loaded (state.imageUrl changes
    // from the bundled Mrs. Doubtfire default AND the <img> has natural
    // dimensions > 0, meaning the browser actually fetched + decoded it).
    await page.waitForFunction(
      () => {
        const s = window.__igEditorState
        if (!s || !s.imageUrl) return false
        if (/45d2e7c3-da25-4194-b07f-9fa4eaad991c/.test(s.imageUrl)) return false
        return true
      },
      { timeout: 20000, polling: 500 }
    ).catch(() => {})

    // Let the new image preload in the DOM so html2canvas can capture it
    await page.evaluate(async () => {
      const s = window.__igEditorState
      if (!s?.imageUrl) return
      await new Promise(resolve => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve()
        img.onerror = () => resolve()
        img.src = s.imageUrl
        // Timeout safety
        setTimeout(resolve, 5000)
      })
    })

    // One more paint to let fonts + backgrounds settle
    await page.waitForTimeout(800)

    // Trigger capture
    const dataUrl = await page.evaluate(async () => {
      const blob = await window.__igEditorCapturePNG()
      return await new Promise(r => {
        const fr = new FileReader()
        fr.onloadend = () => r(fr.result)
        fr.readAsDataURL(blob)
      })
    })

    const base64 = dataUrl.split(',')[1]
    const buf = Buffer.from(base64, 'base64')
    const outPath = path.join(OUT, `${post.slug}.png`)
    await fs.writeFile(outPath, buf)
    const sizeKB = (buf.length / 1024).toFixed(0)
    console.log(`  ✓ wrote ${outPath.replace(os.homedir(), '~')}  (${sizeKB} KB)`)
  } catch (err) {
    console.error(`  ✗ ${post.slug} failed:`, err.message)
  } finally {
    await page.close()
    await context.close()
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  console.log(`Driving ${SITE}/ig-editor.html for ${POSTS.length} posts …`)
  console.log(`Output → ${OUT}\n`)

  const browser = await chromium.launch({ headless: true })

  // Serial — each editor instance is heavy, parallel risks rendering artifacts
  for (const post of POSTS) {
    await generateOne(browser, post)
  }

  await browser.close()
  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
