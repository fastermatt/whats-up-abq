#!/usr/bin/env node
// scripts/bump-sw-version.cjs
// Stamps a build-time timestamp into public/sw.js CACHE_VERSION before each Vite build.
// Ensures every Netlify deploy gets a fresh service worker cache.

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');

const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12); // e.g. 202603290145
const newVersion = `abq-${ts}`;

sw = sw.replace(/const CACHE_VERSION = 'abq-[^']+';/, `const CACHE_VERSION = '${newVersion}';`);
fs.writeFileSync(swPath, sw, 'utf8');

console.log(`[bump-sw] CACHE_VERSION set to '${newVersion}'`);
