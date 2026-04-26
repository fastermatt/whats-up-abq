/**
 * Model-agnostic LLM client for OpenAI-compatible local servers
 * (LM Studio, Ollama, llama.cpp, vLLM, anything else).
 *
 * Why this exists:
 *   - Hardcoding `gemma-4-e4b-uncensored-hauhaucs-aggressive` everywhere meant
 *     the moment Matt unloaded that exact model in LM Studio, every script
 *     broke. This file auto-discovers what's loaded and picks the best fit.
 *   - The same logic also targets Ollama on :11434 and llama.cpp on :8080
 *     when LM Studio isn't running, so the hygiene cron can run with whatever
 *     local model server is up.
 *
 * Usage:
 *   import { chatJson } from './lib/llm.mjs'
 *   const result = await chatJson({ system, user, schemaHint: 'flags array of {code,severity}' })
 *
 * Configuration via env vars (all optional):
 *   LM_URL          full chat-completions URL (overrides everything)
 *   LM_MODEL        explicit model id (skip auto-pick)
 *   LM_MAX_TOKENS   default 600
 *   LM_TEMPERATURE  default 0.2
 *
 * Auto-discovery probes in order:
 *   1. http://localhost:1234   (LM Studio)
 *   2. http://localhost:11434  (Ollama; uses /api/tags + /v1/chat/completions)
 *   3. http://localhost:8080   (llama.cpp server, OpenAI-compat)
 */

const PROBES = [
  { label: 'lm-studio', base: 'http://localhost:1234', listPath: '/v1/models', chatPath: '/v1/chat/completions' },
  { label: 'ollama',    base: 'http://localhost:11434', listPath: '/v1/models', chatPath: '/v1/chat/completions' },
  { label: 'llama-cpp', base: 'http://localhost:8080',  listPath: '/v1/models', chatPath: '/v1/chat/completions' },
]

// Models we prefer in order — instruction-tuned, JSON-friendly, decent reasoning
// for short structured tasks. Score-based: a substring match scores by index
// (lower = better). The `_e4b`/`-2b`/`-4b` suffix is a soft tiebreaker so we
// avoid loading a 70B model for a quick classification when an 8B is loaded.
const MODEL_PREFERENCES = [
  // Strong, fast, small. Best for most enrichment tasks.
  'gemma-4',
  'gemma-3',
  'gemma-2',
  'qwen3.5',
  'qwen3',
  'qwen2.5',
  'phi-3.5',
  'phi-3',
  'llama-3.2',
  'llama-3.1',
  'llama-3',
  'mistral',
  'gpt-oss',
  // Last-resort match — anything with "instruct"/"chat" in the name
  'instruct',
  'chat',
]

let _cached = null

async function tryProbe(probe) {
  try {
    const r = await fetch(`${probe.base}${probe.listPath}`, { signal: AbortSignal.timeout(2500) })
    if (!r.ok) return null
    const j = await r.json()
    const models = (j.data ?? j.models ?? []).map(m => m.id ?? m.name).filter(Boolean)
    if (!models.length) return null
    return { ...probe, models, url: `${probe.base}${probe.chatPath}` }
  } catch { return null }
}

/** Pick the best model from a list of available IDs. */
function pickBestModel(models, hint = '') {
  // Prefer a hint substring if provided
  if (hint) {
    const m = models.find(m => m.toLowerCase().includes(hint.toLowerCase()))
    if (m) return m
  }
  // Walk preferences and find first match
  for (const pref of MODEL_PREFERENCES) {
    const m = models.find(id => id.toLowerCase().includes(pref))
    if (m) return m
  }
  // Otherwise: prefer the one with the smallest billions count (b-suffix)
  // because LLMs at this layer are usually cost-sensitive.
  const ranked = [...models].sort((a, b) => {
    const sizeA = parseFloat((a.match(/(\d+(?:\.\d+)?)\s*b/i) ?? [])[1] ?? '999')
    const sizeB = parseFloat((b.match(/(\d+(?:\.\d+)?)\s*b/i) ?? [])[1] ?? '999')
    return sizeA - sizeB
  })
  return ranked[0]
}

/** Discover an available LLM endpoint + chosen model. Cached per-process. */
export async function discoverLLM({ modelHint = '', forceRefresh = false } = {}) {
  if (_cached && !forceRefresh) return _cached
  // Manual override
  if (process.env.LM_URL && process.env.LM_MODEL) {
    _cached = { url: process.env.LM_URL, model: process.env.LM_MODEL, label: 'env-override' }
    return _cached
  }
  for (const probe of PROBES) {
    const r = await tryProbe(probe)
    if (!r) continue
    const model = process.env.LM_MODEL || pickBestModel(r.models, modelHint)
    _cached = { url: r.url, model, label: r.label, available: r.models }
    return _cached
  }
  throw new Error(
    'No local LLM server reachable. Tried LM Studio (:1234), Ollama (:11434), llama.cpp (:8080). ' +
    'Start one and load any instruct/chat model, or set LM_URL + LM_MODEL.'
  )
}

/** Chat completion that returns plain text. */
export async function chat({ system, user, modelHint = '', maxTokens, temperature, model } = {}) {
  const llm = await discoverLLM({ modelHint })
  const body = {
    model: model || llm.model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    temperature: temperature ?? parseFloat(process.env.LM_TEMPERATURE ?? '0.2'),
    max_tokens:  maxTokens  ?? parseInt(process.env.LM_MAX_TOKENS ?? '600', 10),
    stream: false,
  }
  const res = await fetch(llm.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`LLM HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  const j = await res.json()
  return j.choices?.[0]?.message?.content ?? ''
}

/** Chat completion that returns parsed JSON. Adds JSON-only nudges to the system
 * prompt, strips code fences, and falls back to first {…} match in the response.
 * If parsing fails, returns `{ _parseError: rawText }` (callers can decide). */
export async function chatJson({ system, user, schemaHint = '', modelHint = '', maxTokens, temperature, model } = {}) {
  const sysWithJson = [
    system,
    'Return ONLY a single JSON object. No prose, no code fences, no explanation.',
    schemaHint ? `Output schema: ${schemaHint}` : '',
  ].filter(Boolean).join('\n\n')
  const txt = await chat({ system: sysWithJson, user, modelHint, maxTokens, temperature, model })
  const clean = txt.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try { return JSON.parse(clean) }
  catch {
    const m = clean.match(/\{[\s\S]*\}/)
    if (m) { try { return JSON.parse(m[0]) } catch {} }
    return { _parseError: clean.slice(0, 200) }
  }
}

/** Print which LLM was chosen (for debug + script header logging). */
export async function printLLMHeader() {
  try {
    const llm = await discoverLLM()
    console.log(`[llm] using ${llm.label}: ${llm.model}`)
  } catch (e) {
    console.error(`[llm] ${e.message}`)
    process.exit(2)
  }
}
