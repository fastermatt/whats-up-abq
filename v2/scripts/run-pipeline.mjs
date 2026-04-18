#!/usr/bin/env node
/**
 * ABQ Unplugged — Full Data Pipeline
 *
 * Runs the complete import → enrich → tag → cleanup → validate pipeline
 * in a single command. Use this instead of relying on the weekly cron.
 *
 * Usage:
 *   node scripts/run-pipeline.mjs              # full run
 *   node scripts/run-pipeline.mjs --dry-run    # dry run (no DB writes)
 *   node scripts/run-pipeline.mjs --skip-import # enrichment + cleanup only
 *   node scripts/run-pipeline.mjs --step=tag   # run a single step
 *
 * Steps (in order):
 *   1. import-ticketmaster   — fetch TM events
 *   2. import-seatgeek       — fetch SG events
 *   3. import-eventbrite     — scrape EB events
 *   4. import-nhcc           — fetch NHCC events
 *   5. tag-neighborhoods     — assign neighborhood to events missing one
 *   6. enrich-moods-rules    — rule-based mood tagging (fast, no LLM)
 *   7. cleanup-events        — hide past events, dedup, fix bad data
 *   8. validate-events       — report data quality issues
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── CLI flags ─────────────────────────────────────────────────────────────────

const isDryRun    = process.argv.includes('--dry-run')
const skipImport  = process.argv.includes('--skip-import')
const singleStep  = (process.argv.find(a => a.startsWith('--step=')) || '').split('=')[1]

// ── ANSI colors ───────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  terra:  '\x1b[38;5;166m',  // closest to #9a442d
  blue:   '\x1b[34m',
}

function log(msg) { process.stdout.write(msg + '\n') }
function header(msg) { log(`\n${C.bold}${C.terra}${msg}${C.reset}`) }
function success(msg) { log(`${C.green}✅ ${msg}${C.reset}`) }
function warn(msg) { log(`${C.yellow}⚠️  ${msg}${C.reset}`) }
function err(msg) { log(`${C.red}❌ ${msg}${C.reset}`) }
function dim(msg) { log(`${C.dim}${msg}${C.reset}`) }

// ── Step runner ───────────────────────────────────────────────────────────────

/**
 * Run a script as a child process, streaming its output.
 * Returns { ok: boolean, exitCode: number, durationMs: number }
 */
function runScript(scriptName, extraArgs = []) {
  const scriptPath = path.join(__dirname, scriptName)
  if (!fs.existsSync(scriptPath)) {
    warn(`Script not found, skipping: ${scriptName}`)
    return Promise.resolve({ ok: true, skipped: true, durationMs: 0 })
  }

  const args = [...extraArgs]
  if (isDryRun) args.push('--dry-run')

  return new Promise((resolve) => {
    const start = Date.now()
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',   // stream stdout/stderr directly to terminal
      env: process.env,
    })

    child.on('close', (code) => {
      const durationMs = Date.now() - start
      resolve({ ok: code === 0, exitCode: code, durationMs })
    })

    child.on('error', (e) => {
      err(`Failed to start ${scriptName}: ${e.message}`)
      resolve({ ok: false, exitCode: -1, durationMs: Date.now() - start })
    })
  })
}

// ── Pipeline steps ────────────────────────────────────────────────────────────

const IMPORT_STEPS = [
  { key: 'tm',   name: 'Ticketmaster',  script: 'import-ticketmaster.mjs' },
  { key: 'sg',   name: 'SeatGeek',      script: 'import-seatgeek.mjs' },
  { key: 'eb',   name: 'Eventbrite',    script: 'import-eventbrite.mjs' },
  { key: 'nhcc', name: 'NHCC',          script: 'import-nhcc.mjs' },
]

const ENRICH_STEPS = [
  { key: 'tag',      name: 'Tag Neighborhoods', script: 'tag-neighborhoods.mjs', args: ['--force'] },
  { key: 'moods',    name: 'Enrich Moods',       script: 'enrich-moods-rules.mjs' },
  { key: 'cleanup',  name: 'Cleanup Events',     script: 'cleanup-events.mjs' },
  { key: 'validate', name: 'Validate Events',    script: 'validate-events.mjs' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pipelineStart = Date.now()

  log('')
  log(`${C.bold}${C.terra}╔═══════════════════════════════════════════════════╗${C.reset}`)
  log(`${C.bold}${C.terra}║   ABQ Unplugged — Data Pipeline                   ║${C.reset}`)
  log(`${C.bold}${C.terra}╚═══════════════════════════════════════════════════╝${C.reset}`)
  log('')
  dim(`  Started: ${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} MDT`)
  if (isDryRun)   log(`  ${C.yellow}Mode: DRY RUN — no DB writes${C.reset}`)
  if (skipImport) log(`  ${C.blue}Mode: Skipping imports (enrich/cleanup only)${C.reset}`)
  if (singleStep) log(`  ${C.blue}Mode: Single step — ${singleStep}${C.reset}`)
  log('')

  const results = []

  // ── Choose which steps to run ─────────────────────────────────────────────

  const allSteps = [
    ...(!skipImport ? IMPORT_STEPS : []),
    ...ENRICH_STEPS,
  ]

  const steps = singleStep
    ? allSteps.filter(s => s.key === singleStep || s.name.toLowerCase().includes(singleStep.toLowerCase()))
    : allSteps

  if (steps.length === 0) {
    err(`No steps matched --step=${singleStep}. Valid keys: ${allSteps.map(s => s.key).join(', ')}`)
    process.exit(1)
  }

  // ── Run each step ─────────────────────────────────────────────────────────

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const stepNum = `[${i + 1}/${steps.length}]`

    header(`${stepNum} ${step.name}`)
    dim(`  Script: ${step.script}`)
    log('')

    const result = await runScript(step.script, step.args ?? [])
    const dur = (result.durationMs / 1000).toFixed(1)

    log('')
    if (result.skipped) {
      warn(`${step.name} — skipped (script not found)`)
    } else if (result.ok) {
      success(`${step.name} completed in ${dur}s`)
    } else {
      err(`${step.name} failed (exit code ${result.exitCode}) after ${dur}s`)
    }

    results.push({ ...step, ...result })

    // Small pause between steps to avoid DB connection spikes
    if (i < steps.length - 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalDur = ((Date.now() - pipelineStart) / 1000).toFixed(1)
  const failed = results.filter(r => !r.ok && !r.skipped)
  const passed = results.filter(r => r.ok)
  const skipped = results.filter(r => r.skipped)

  log('')
  log(`${C.bold}${C.terra}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)
  log(`${C.bold}  Pipeline complete — ${totalDur}s total${C.reset}`)
  log(`${C.terra}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`)
  log('')

  for (const r of results) {
    const icon = r.skipped ? '⏭️ ' : r.ok ? '✅' : '❌'
    const dur  = r.skipped ? '' : ` (${(r.durationMs / 1000).toFixed(1)}s)`
    const color = r.skipped ? C.dim : r.ok ? C.green : C.red
    log(`  ${icon} ${color}${r.name}${dur}${C.reset}`)
  }

  log('')
  log(`  ${C.green}${passed.length} passed${C.reset}  ${skipped.length > 0 ? `${C.dim}${skipped.length} skipped  ${C.reset}` : ''}${failed.length > 0 ? `${C.red}${failed.length} failed${C.reset}` : ''}`)

  if (failed.length > 0) {
    log('')
    warn('Some steps failed. The site still serves existing data — these failures don\'t take it down.')
    warn('Check the output above for specific errors. Re-run a single step with --step=<key>.')
    log('')
    dim('  Step keys: ' + IMPORT_STEPS.concat(ENRICH_STEPS).map(s => s.key).join(', '))
    process.exit(1)
  }

  log('')
  success('All steps passed. Data is fresh. 🌵')
  log('')
}

main().catch(e => {
  err(`Pipeline crashed: ${e.message}`)
  console.error(e)
  process.exit(1)
})
