#!/usr/bin/env node
/**
 * Daily site hygiene runner — no Claude required.
 *
 * Runs every quality check we have:
 *   1. Regression test suite (data-shape invariants)
 *   2. LLM event audit (category mismatch, cancellation, online-only)
 *   3. LLM location/time audit (venue / time discrepancies vs description)
 *
 * Auto-discovers an LLM (LM Studio / Ollama / llama.cpp). If no LLM is
 * available, just runs the regression suite and skips the LLM steps.
 *
 * Designed to run via cron, GitHub Actions, or `npm run hygiene`.
 *
 * Usage:
 *   node scripts/daily-hygiene.mjs                # audit + report only
 *   node scripts/daily-hygiene.mjs --apply        # also auto-hide block
 *                                                 # severity events
 *   node scripts/daily-hygiene.mjs --limit=80     # bigger LLM sample
 *
 * Exit codes:
 *   0  all checks passed (or LLM skipped, regression suite passed)
 *   1  regression suite failed
 *   2  setup error (no DB, etc.)
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const envFile of [path.join(__dirname, '.env'), path.join(__dirname, '..', '..', 'scripts', '.env')]) {
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    })
    break
  }
}

const argv = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)
const APPLY = argv.apply === true
const LIMIT = argv.limit ?? '60'

function run(name, args) {
  return new Promise((resolve) => {
    const start = Date.now()
    // Guard: skip (don't crash) if the target script no longer exists.
    // e.g. gemma-event-audit.mjs was removed; this step now degrades gracefully.
    const scriptPath = path.join(__dirname, args[0])
    if (!fs.existsSync(scriptPath)) {
      console.log(`\n[skip] ${name} — ${args[0]} not found`)
      resolve(0)
      return
    }
    console.log(`\n━━━ ${name} ━━━`)
    const child = spawn('node', [scriptPath, ...args.slice(1)], {
      stdio: 'inherit',
      env: process.env,
    })
    child.on('exit', (code) => {
      const dur = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`━━━ ${name} → exit ${code} (${dur}s)`)
      resolve(code ?? 0)
    })
  })
}

// Probe LLM. If unreachable, skip LLM checks.
async function llmReachable() {
  for (const url of ['http://localhost:1234/v1/models', 'http://localhost:11434/v1/models', 'http://localhost:8080/v1/models']) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (r.ok) return true
    } catch {}
  }
  return false
}

console.log(`Daily hygiene starting at ${new Date().toISOString()}\n`)

// 1. Regression test suite — always run
const regressionExit = await run('Regression test suite', ['regression-tests.mjs'])

// 2. LLM audits — only if LLM is reachable
const llm = await llmReachable()
let auditExit = 0
let timeAuditExit = 0
if (llm) {
  const args = [`--limit=${LIMIT}`]
  if (APPLY) args.push('--apply')
  auditExit     = await run('LLM event audit',         ['gemma-event-audit.mjs',    ...args])
  timeAuditExit = await run('LLM location/time audit', ['audit-location-time.mjs',  ...args])
} else {
  console.log('\n[skip] No local LLM reachable (LM Studio / Ollama / llama.cpp). Skipping LLM audits.')
}

console.log('\n━━━ Summary ━━━')
console.log(`  regression: ${regressionExit === 0 ? 'PASS' : 'FAIL'}`)
if (llm) {
  console.log(`  llm event audit: ${auditExit === 0 ? 'OK' : 'WARN'}`)
  console.log(`  llm time audit:  ${timeAuditExit === 0 ? 'OK' : 'WARN'}`)
}

// Only the regression suite is fatal — LLM audits inform but don't block
process.exit(regressionExit === 0 ? 0 : 1)
