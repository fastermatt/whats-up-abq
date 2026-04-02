#!/usr/bin/env node
/**
 * ABQ Unplugged — Site Functionality & Image Audit
 *
 * Runs headless Chromium against abqunplugged.com to verify:
 *   1. App loads and renders (no crash / blank screen)
 *   2. Places tab loads with cards
 *   3. Events tab loads with cards
 *   4. Place detail modal opens with enriched data
 *   5. Event detail modal opens with ticket links
 *   6. Every visible place card image loads (not broken)
 *   7. Every visible event card image loads (not broken)
 *   8. Console errors are captured
 *
 * Output: /tmp/abq-site-audit.json  (machine-readable)
 *         /tmp/abq-site-audit.txt   (human-readable summary)
 *
 * Usage:
 *   npx playwright install chromium   # first time only
 *   node scripts/test-site.cjs
 *   node scripts/test-site.cjs --url http://localhost:5173   # test local dev
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://abqunplugged.com';

const TIMEOUT = 60000;

const results = {
  url: BASE_URL,
  timestamp: new Date().toISOString(),
  tests: [],
  brokenImages: { places: [], events: [] },
  consoleErrors: [],
  summary: {},
};

function log(msg) { console.log(`  ${msg}`); }
function pass(name, detail) { results.tests.push({ name, status: 'PASS', detail }); log(`✓ ${name}`); }
function fail(name, detail) { results.tests.push({ name, status: 'FAIL', detail }); log(`✗ ${name}: ${detail}`); }
function warn(name, detail) { results.tests.push({ name, status: 'WARN', detail }); log(`⚠ ${name}: ${detail}`); }

async function main() {
  console.log(`\n🧪  ABQ Unplugged — Site Audit`);
  console.log(`   URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },  // iPhone-ish
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text().slice(0, 200));
    }
  });

  // ── TEST 1: App loads ─────────────────────────────────────────────────────
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    const title = await page.title();
    if (title) pass('App loads', `Title: "${title}"`);
    else fail('App loads', 'No page title');
  } catch (e) {
    fail('App loads', e.message.slice(0, 150));
    await browser.close();
    writeResults();
    return;
  }

  // ── TEST 2: Places tab renders ────────────────────────────────────────────
  try {
    // Click "Home" or "Discover" tab if needed — the app might start there
    // Wait for place cards to appear
    await page.waitForSelector('[class*="place"], [class*="Place"], [data-testid="place-card"]', { timeout: 15000 }).catch(() => null);

    // Count visible place-like elements (cards with images)
    const placeCards = await page.$$('img');
    const visibleImages = [];
    for (const img of placeCards) {
      const visible = await img.isVisible().catch(() => false);
      if (visible) visibleImages.push(img);
    }

    if (visibleImages.length > 0) {
      pass('Home screen images', `${visibleImages.length} images visible on load`);
    } else {
      warn('Home screen images', 'No visible images on initial load');
    }
  } catch (e) {
    fail('Home screen images', e.message.slice(0, 150));
  }

  // ── TEST 3: Check all images on Home/Places view ──────────────────────────
  try {
    // Scroll down to load more content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);

    const homeImages = await auditImages(page, 'places');
    pass('Home image audit', `${homeImages.loaded} loaded, ${homeImages.broken} broken, ${homeImages.empty} empty src out of ${homeImages.total}`);
  } catch (e) {
    fail('Home image audit', e.message.slice(0, 150));
  }

  // ── TEST 4: Click a place card and check detail modal ─────────────────────
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Find a clickable card/element that opens a place detail
    const placeCard = await page.$('article, [class*="card"], [class*="Card"]');
    if (placeCard) {
      await placeCard.click();
      await page.waitForTimeout(2000);

      // Check for modal content
      const modalVisible = await page.$('div[class*="fixed"]');
      if (modalVisible) {
        // Check for enriched data sections
        const hasInsiderTip = await page.$('text=Local Tip').catch(() => null);
        const hasHours = await page.$('text=schedule').catch(() => null);
        const hasDescription = await page.$$eval('p', els => els.some(el => el.textContent.length > 50));

        const enrichedParts = [];
        if (hasInsiderTip) enrichedParts.push('insider tip');
        if (hasHours) enrichedParts.push('hours');
        if (hasDescription) enrichedParts.push('description');

        if (enrichedParts.length > 0) {
          pass('Place detail modal', `Opens with: ${enrichedParts.join(', ')}`);
        } else {
          warn('Place detail modal', 'Modal opens but no enriched data visible yet');
        }

        // Check hero image in modal
        const modalImg = await page.$('div[class*="fixed"] img');
        if (modalImg) {
          const src = await modalImg.getAttribute('src');
          const naturalWidth = await modalImg.evaluate(el => el.naturalWidth);
          if (naturalWidth > 0) pass('Place modal image', `Loads OK (${src?.slice(0, 60)}…)`);
          else fail('Place modal image', `Broken: ${src?.slice(0, 100)}`);
        }

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        warn('Place detail modal', 'Clicked card but no modal appeared');
      }
    } else {
      warn('Place detail modal', 'No clickable place card found');
    }
  } catch (e) {
    fail('Place detail modal', e.message.slice(0, 150));
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }

  // ── TEST 5: Navigate to Events tab ────────────────────────────────────────
  try {
    // Look for Events tab button
    const eventsTab = await page.$('text=Events') || await page.$('button:has-text("Events")') || await page.$('[class*="events" i]');
    if (eventsTab) {
      await eventsTab.click();
      await page.waitForTimeout(3000);

      // Check for event cards
      const eventImages = await page.$$('img');
      const visibleEventImgs = [];
      for (const img of eventImages) {
        const vis = await img.isVisible().catch(() => false);
        if (vis) visibleEventImgs.push(img);
      }

      if (visibleEventImgs.length > 0) {
        pass('Events tab loads', `${visibleEventImgs.length} images visible`);
      } else {
        warn('Events tab loads', 'Tab opened but no event images visible');
      }
    } else {
      fail('Events tab loads', 'Could not find Events tab button');
    }
  } catch (e) {
    fail('Events tab loads', e.message.slice(0, 150));
  }

  // ── TEST 6: Audit all event images ────────────────────────────────────────
  try {
    // Scroll to load more events
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(2000);

    const eventImgAudit = await auditImages(page, 'events');
    pass('Event image audit', `${eventImgAudit.loaded} loaded, ${eventImgAudit.broken} broken, ${eventImgAudit.empty} empty src out of ${eventImgAudit.total}`);
  } catch (e) {
    fail('Event image audit', e.message.slice(0, 150));
  }

  // ── TEST 7: Click an event and check detail modal + ticket link ───────────
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Find an event card
    const eventCard = await page.$('article, [class*="card"], [class*="Card"]');
    if (eventCard) {
      await eventCard.click();
      await page.waitForTimeout(2000);

      const modal = await page.$('div[class*="fixed"]');
      if (modal) {
        // Check for ticket link
        const ticketLink = await page.$('a:has-text("GET TICKETS")') || await page.$('a:has-text("MORE INFO")');
        if (ticketLink) {
          const href = await ticketLink.getAttribute('href');
          const isGenericSearch = href && (href.includes('seatgeek.com/search?q=') || href.includes('eventbrite.com/d/'));
          if (isGenericSearch) {
            fail('Event ticket link', `Generic search URL: ${href.slice(0, 100)}`);
          } else {
            pass('Event ticket link', `Specific URL: ${href?.slice(0, 100)}`);
          }
        } else {
          const directionsLink = await page.$('a:has-text("GET DIRECTIONS")');
          if (directionsLink) {
            warn('Event ticket link', 'No ticket link — only directions available');
          } else {
            warn('Event ticket link', 'No ticket or directions link found');
          }
        }

        // Check for event description
        const aboutSection = await page.$('text=About This Event');
        if (aboutSection) pass('Event description', 'Has "About This Event" section');
        else warn('Event description', 'No description section visible');

        // Check event modal image
        const eventModalImg = await page.$('div[class*="fixed"] img');
        if (eventModalImg) {
          const nw = await eventModalImg.evaluate(el => el.naturalWidth);
          if (nw > 0) pass('Event modal image', 'Loads OK');
          else fail('Event modal image', 'Broken image in event modal');
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  } catch (e) {
    fail('Event detail modal', e.message.slice(0, 150));
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ── TEST 8: Deep scroll Places to find ALL broken images ──────────────────
  console.log('\n  📸 Deep image scan (scrolling all places)...');
  try {
    // Go back to Home/Places
    const homeTab = await page.$('text=Home') || await page.$('text=Discover') || await page.$('button:has-text("Home")');
    if (homeTab) {
      await homeTab.click();
      await page.waitForTimeout(2000);
    }

    const placeBroken = await deepScrollImageAudit(page, 'places', 30);
    results.brokenImages.places = placeBroken;
    if (placeBroken.length === 0) pass('Deep place image scan', 'All place images load correctly');
    else fail('Deep place image scan', `${placeBroken.length} broken place images found`);
  } catch (e) {
    fail('Deep place image scan', e.message.slice(0, 150));
  }

  // ── TEST 9: Deep scroll Events to find ALL broken images ──────────────────
  console.log('  📸 Deep image scan (scrolling all events)...');
  try {
    const evTab = await page.$('text=Events') || await page.$('button:has-text("Events")');
    if (evTab) {
      await evTab.click();
      await page.waitForTimeout(2000);
    }

    const eventBroken = await deepScrollImageAudit(page, 'events', 30);
    results.brokenImages.events = eventBroken;
    if (eventBroken.length === 0) pass('Deep event image scan', 'All event images load correctly');
    else fail('Deep event image scan', `${eventBroken.length} broken event images found`);
  } catch (e) {
    fail('Deep event image scan', e.message.slice(0, 150));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const failed = results.tests.filter(t => t.status === 'FAIL').length;
  const warned = results.tests.filter(t => t.status === 'WARN').length;
  results.summary = {
    passed, failed, warned,
    totalTests: results.tests.length,
    totalBrokenPlaceImages: results.brokenImages.places.length,
    totalBrokenEventImages: results.brokenImages.events.length,
    consoleErrors: results.consoleErrors.length,
  };

  await browser.close();
  writeResults();
}

/** Audit all visible <img> elements on the current page */
async function auditImages(page, section) {
  const audit = { total: 0, loaded: 0, broken: 0, empty: 0 };

  const images = await page.$$('img');
  for (const img of images) {
    const visible = await img.isVisible().catch(() => false);
    if (!visible) continue;

    audit.total++;
    const src = await img.getAttribute('src');

    if (!src || src === '') {
      audit.empty++;
      continue;
    }

    const naturalWidth = await img.evaluate(el => el.naturalWidth).catch(() => 0);
    if (naturalWidth > 0) {
      audit.loaded++;
    } else {
      audit.broken++;
      results.brokenImages[section].push({
        src: src.slice(0, 200),
        alt: await img.getAttribute('alt') || '',
      });
    }
  }

  return audit;
}

/** Scroll through the page collecting broken images */
async function deepScrollImageAudit(page, section, maxScrolls) {
  const broken = [];
  const seenSrcs = new Set();
  let lastHeight = 0;

  for (let i = 0; i < maxScrolls; i++) {
    // Check all images currently in view
    const images = await page.$$('img');
    for (const img of images) {
      const visible = await img.isVisible().catch(() => false);
      if (!visible) continue;

      const src = await img.getAttribute('src');
      if (!src || seenSrcs.has(src)) continue;
      seenSrcs.add(src);

      const naturalWidth = await img.evaluate(el => el.naturalWidth).catch(() => 0);
      if (naturalWidth === 0) {
        // Get nearby text for identification
        const nearText = await img.evaluate(el => {
          const parent = el.closest('article, [class*="card"], [class*="Card"], div');
          const nameEl = parent?.querySelector('h2, h3, h4, p, span');
          return nameEl?.textContent?.trim()?.slice(0, 60) || '';
        }).catch(() => '');

        broken.push({
          src: src.slice(0, 200),
          alt: await img.getAttribute('alt').catch(() => '') || '',
          nearbyText: nearText,
        });
      }
    }

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(600);

    // Check if we've reached the bottom
    const newHeight = await page.evaluate(() => window.scrollY);
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;

    if (i % 10 === 0 && i > 0) process.stdout.write(`    ...scrolled ${i}/${maxScrolls}, ${seenSrcs.size} images checked\n`);
  }

  log(`  ${section}: ${seenSrcs.size} unique images checked, ${broken.length} broken`);
  return broken;
}

function writeResults() {
  const jsonPath = '/tmp/abq-site-audit.json';
  const txtPath = '/tmp/abq-site-audit.txt';

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  // Human-readable report
  let report = `ABQ Unplugged — Site Audit Report\n`;
  report += `${'═'.repeat(50)}\n`;
  report += `URL: ${results.url}\n`;
  report += `Date: ${results.timestamp}\n\n`;

  report += `SUMMARY\n${'─'.repeat(30)}\n`;
  report += `  Passed: ${results.summary.passed}\n`;
  report += `  Failed: ${results.summary.failed}\n`;
  report += `  Warnings: ${results.summary.warned}\n`;
  report += `  Broken place images: ${results.summary.totalBrokenPlaceImages}\n`;
  report += `  Broken event images: ${results.summary.totalBrokenEventImages}\n`;
  report += `  Console errors: ${results.summary.consoleErrors}\n\n`;

  report += `TEST RESULTS\n${'─'.repeat(30)}\n`;
  for (const t of results.tests) {
    const icon = t.status === 'PASS' ? '✓' : t.status === 'FAIL' ? '✗' : '⚠';
    report += `  ${icon} [${t.status}] ${t.name}\n`;
    if (t.detail) report += `    ${t.detail}\n`;
  }

  if (results.brokenImages.places.length > 0) {
    report += `\nBROKEN PLACE IMAGES (${results.brokenImages.places.length})\n${'─'.repeat(30)}\n`;
    for (const img of results.brokenImages.places) {
      report += `  • ${img.nearbyText || img.alt || '(unknown)'}\n`;
      report += `    src: ${img.src}\n`;
    }
  }

  if (results.brokenImages.events.length > 0) {
    report += `\nBROKEN EVENT IMAGES (${results.brokenImages.events.length})\n${'─'.repeat(30)}\n`;
    for (const img of results.brokenImages.events) {
      report += `  • ${img.nearbyText || img.alt || '(unknown)'}\n`;
      report += `    src: ${img.src}\n`;
    }
  }

  if (results.consoleErrors.length > 0) {
    report += `\nCONSOLE ERRORS (${results.consoleErrors.length})\n${'─'.repeat(30)}\n`;
    for (const err of results.consoleErrors.slice(0, 20)) {
      report += `  • ${err}\n`;
    }
    if (results.consoleErrors.length > 20) report += `  ... and ${results.consoleErrors.length - 20} more\n`;
  }

  report += `\n${'═'.repeat(50)}\n`;
  report += `Full JSON: ${jsonPath}\n`;

  fs.writeFileSync(txtPath, report);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Passed: ${results.summary.passed}  |  Failed: ${results.summary.failed}  |  Warnings: ${results.summary.warned}`);
  console.log(`  Broken images — Places: ${results.summary.totalBrokenPlaceImages}  Events: ${results.summary.totalBrokenEventImages}`);
  console.log(`  Console errors: ${results.summary.consoleErrors}`);
  console.log(`\n  📄 Report: ${txtPath}`);
  console.log(`  📊 JSON:   ${jsonPath}`);
  console.log(`${'═'.repeat(50)}\n`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
