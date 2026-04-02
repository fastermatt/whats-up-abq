#!/usr/bin/env node
/**
 * ABQ Unplugged — Event Enrichment via LM Studio
 *
 * Fills in missing event descriptions (info field) using the local LM Studio.
 * Also updates Supabase so the enriched data persists across refreshes.
 *
 * Usage:
 *   node scripts/enrich-events-lm.cjs
 *   node scripts/enrich-events-lm.cjs --limit 50
 *   node scripts/enrich-events-lm.cjs --dry-run
 *   node scripts/enrich-events-lm.cjs --force   # re-enrich even if info exists
 */
'use strict';

const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');

// ── LM Studio config ────────────────────────────────────────────────────────
const LM_HOST  = '10.0.0.53';
const LM_PORT  = 1234;
const LM_MODEL = 'qwen/qwen2.5-coder-14b';

// ── Supabase config ─────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbXZmdXRlYm1ia2p2bHJoaXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgwMzIsImV4cCI6MjA4OTgxNDAzMn0.3rvMRErlF-HnKfbJ6rCNSeCJc39n4K48xjAeSGqf_rc';

const args       = process.argv.slice(2);
const getArg     = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const limitCount = parseInt(getArg('--limit') || '9999', 10);
const dryRun     = args.includes('--dry-run');
const forceRedo  = args.includes('--force');

const DELAY_MS    = 50;
const MAX_RETRIES = 2;
const BATCH_SAVE  = 10;

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseJSON(text) {
  const clean = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json?\s*/im, '').replace(/```\s*$/m, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error(`No JSON: ${text.slice(0, 120)}`);
  return JSON.parse(clean.slice(s, e + 1));
}

function callLMStudio(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: LM_MODEL, temperature: 0.3, max_tokens: 1024, stream: false,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = http.request({
      hostname: LM_HOST, port: LM_PORT, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parseJSON(parsed.choices?.[0]?.message?.content || ''));
        } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('LM Studio timeout')); });
    req.write(body); req.end();
  });
}

function buildPrompt(ev) {
  const venue = ev._embedded?.venues?.[0];
  const genre = ev.classifications?.[0];
  return `You are a local Albuquerque event expert writing for "ABQ Unplugged" — a local discovery app.

Event: ${ev.name}
Venue: ${venue?.name || 'Unknown'} | ${venue?.address?.line1 || ''}, ${venue?.city?.name || 'Albuquerque'}
Date: ${ev.dates?.start?.localDate || 'TBD'}
Category: ${genre?.segment?.name || 'Event'} / ${genre?.genre?.name || ''}
Price: ${ev.priceRanges?.[0] ? '$' + ev.priceRanges[0].min + '-$' + ev.priceRanges[0].max : 'Unknown'}

Write an engaging 2-4 sentence description for this event. Include what attendees can expect, the vibe/atmosphere, and any ABQ/NM context if relevant.

Output ONLY a raw JSON object. No markdown fences, no extra text.

{"info":"2-4 sentence event description","pleaseNote":"any important notes for attendees (age restrictions, bag policy, parking tips) or empty string"}`;
}

/** Update the event's raw JSONB in Supabase with enriched fields */
function syncToSupabase(eventId, enrichedFields) {
  if (!eventId) return Promise.resolve(false);
  // The events table stores raw as JSONB — we need to merge our fields into it
  // Use Supabase REST API to patch the raw column
  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/merge_event_info`);
  // Fallback: just update the raw column directly by fetching + patching
  return new Promise((resolve) => {
    // First fetch the current raw
    const fetchUrl = new URL(`${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=raw`);
    const fetchReq = https.request(fetchUrl, {
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (!rows || rows.length === 0) { resolve(false); return; }
          const raw = { ...rows[0].raw, ...enrichedFields };
          const patchBody = JSON.stringify({ raw });
          const patchUrl = new URL(`${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}`);
          const patchReq = https.request(patchUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json', 'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal',
            },
          }, (pRes) => {
            let pd = '';
            pRes.on('data', c => pd += c);
            pRes.on('end', () => resolve(pRes.statusCode < 300));
          });
          patchReq.on('error', () => resolve(false));
          patchReq.setTimeout(10000, () => { patchReq.destroy(); resolve(false); });
          patchReq.write(patchBody); patchReq.end();
        } catch { resolve(false); }
      });
    });
    fetchReq.on('error', () => resolve(false));
    fetchReq.setTimeout(10000, () => { fetchReq.destroy(); resolve(false); });
    fetchReq.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch all events from Supabase ──────────────────────────────────────────

async function fetchAllEvents() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/events?select=id,source,raw,event_date&event_date=gte.${new Date().toISOString().split('T')[0]}&order=event_date.asc&limit=5000`);
    const req = https.request(url, {
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Fetch timeout')); });
    req.end();
  });
}

async function main() {
  console.log('\n🎪  ABQ Unplugged — Event Enrichment (LM Studio)');
  console.log(`   Backend: ${LM_MODEL} @ ${LM_HOST}:${LM_PORT}`);
  if (dryRun) console.log('   *** DRY RUN ***');

  // Fetch events from Supabase
  console.log('\n   Fetching events from Supabase...');
  const allEvents = await fetchAllEvents();
  console.log(`   ${allEvents.length} future events found`);

  // Filter to events missing info/description
  const targets = allEvents.filter(row => {
    const raw = row.raw || {};
    if (!forceRedo && raw.info) return false;  // already has description
    if (!raw.name) return false;               // skip unnamed events
    return true;
  }).slice(0, limitCount);

  console.log(`   ${targets.length} events need enrichment\n`);
  if (dryRun || targets.length === 0) return;

  let done = 0, errors = 0;

  for (const row of targets) {
    const ev = row.raw;
    const label = `[${(ev.name || '').slice(0, 45)}]`;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        const prompt = buildPrompt(ev);
        const result = await callLMStudio(prompt);

        if (result.info) {
          // Sync to Supabase
          const enrichedFields = {};
          if (result.info) enrichedFields.info = result.info;
          if (result.pleaseNote) enrichedFields.pleaseNote = result.pleaseNote;
          await syncToSupabase(row.id, enrichedFields);

          done++;
          console.log(`✓ [${done}/${targets.length}] ${label} — ${(result.info || '').slice(0, 60)}…`);
        }
        break;
      } catch (err) {
        if (attempt <= MAX_RETRIES) {
          process.stdout.write(`  (retry ${attempt}) `);
          await sleep(DELAY_MS * attempt * 3);
        } else {
          console.error(`✗ ${label}: ${err.message.slice(0, 100)}`);
          errors++;
        }
      }
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅  ${done} enriched    ❌  ${errors} errors`);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
