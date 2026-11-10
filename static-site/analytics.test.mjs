import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BEACON_SRC, analyticsSnippet, analyticsToken, contentSecurityPolicy, privacyCopy } from './analytics.mjs'

const token = '0123456789abcdef0123456789ABCDEF'

test('analytics stays off without a token', () => {
  assert.equal(analyticsToken(undefined), null)
  assert.equal(analyticsToken('  '), null)
  assert.equal(analyticsSnippet(null), '')
  assert.equal(contentSecurityPolicy(null), "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
  assert.match(privacyCopy(null), /does not use tracking scripts/)
  assert.doesNotMatch(privacyCopy(null), /Cloudflare/)
})

test('a malformed token fails the build instead of shipping bad HTML', () => {
  for (const bad of ['abc', token + '0', '"><script>alert(1)</script>', 'g'.repeat(32)]) {
    assert.throws(() => analyticsToken(bad), /32-character token/)
  }
})

test('a valid token adds the cookieless beacon and only the CSP hosts it needs', () => {
  const t = analyticsToken(token)
  assert.equal(t, token.toLowerCase())
  assert.equal(analyticsSnippet(t), `<script defer src="${BEACON_SRC}" data-cf-beacon='{"token":"${t}"}'></script>`)
  const csp = contentSecurityPolicy(t)
  assert.match(csp, /script-src 'self' https:\/\/static\.cloudflareinsights\.com/)
  assert.match(csp, /connect-src 'self' https:\/\/cloudflareinsights\.com/)
  assert.match(csp, /default-src 'self'.*object-src 'none'.*frame-ancestors 'none'/)
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|\*/)
  const copy = privacyCopy(t)
  assert.match(copy, /Cloudflare Web Analytics/)
  assert.match(copy, /does not use cookies/)
  assert.doesNotMatch(copy, /does not use tracking scripts/)
})
