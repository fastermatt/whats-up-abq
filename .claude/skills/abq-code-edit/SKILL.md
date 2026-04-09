# ABQ Unplugged Code Edit Skill

This skill guides editing, committing, and deploying changes to the ABQ Unplugged app.

## Project Overview
- **Stack**: React + TypeScript, Tailwind CSS, Supabase, Netlify, Vite
- **Main file**: `/Users/matt/Documents/Claude/Projects/whats-up-abq/src/App.tsx` (~8000+ lines)
- **Live site**: https://abqunplugged.com | **GitHub**: fastermatt/whats-up-abq
- **Deploy**: Netlify auto-deploys on push to `main` (~60s)

## Critical Notes
- The VM sandbox (Bash tool) CANNOT make outbound network requests — no curl, fetch, npm run
- ALL file edits, git operations, and shell commands must go through **Desktop Commander**
- The git repo folder is `whats-up-abq` (NOT "ABQ Unplugged")
- Chrome `javascript_tool` CANNOT read raw.githubusercontent.com (blocked)

---

## Step 1: Find the File

```
mcp__Desktop_Commander__start_process:
  command: mdfind -name "App.tsx" | grep whats-up-abq
  timeout_ms: 10000
```
Expected result: `/Users/matt/Documents/Claude/Projects/whats-up-abq/src/App.tsx`

---

## Step 2: Read Source Code

Use a sub-agent (Agent tool, general-purpose) with WebFetch:
```
Fetch https://raw.githubusercontent.com/fastermatt/whats-up-abq/main/src/App.tsx
Return VERBATIM the lines containing [TARGET_STRING] and surrounding context (~20 lines)
```
Do NOT use javascript_tool for GitHub raw URLs — blocked by extension.

---

## Step 3: Write a Python Edit Script

Write to `/tmp/fix_something.py` via `mcp__Desktop_Commander__write_file`:

```python
filepath = '/Users/matt/Documents/Claude/Projects/whats-up-abq/src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Safety check — confirm target string exists before editing
assert 'UNIQUE_STRING_FROM_ORIGINAL' in content, "Target not found — check string"

OLD = """[exact original code block]"""
NEW = """[replacement code block]"""

content = content.replace(OLD, NEW, 1)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
```

Key rules:
- Always include `assert` to verify target exists before replacing
- Use `replace(OLD, NEW, 1)` — the `1` prevents accidental multi-replaces
- Preserve exact indentation from original (tabs vs spaces matter in JSX)

---

## Step 4: Run the Script

```
mcp__Desktop_Commander__start_process:
  command: python3 /tmp/fix_something.py
  timeout_ms: 15000
```

---

## Step 5: Commit and Push

```
mcp__Desktop_Commander__start_process:
  command: cd /Users/matt/Documents/Claude/Projects/whats-up-abq && git add src/App.tsx && git commit -m "feat: description of change" && git push origin main
  timeout_ms: 30000
```

---

## Step 6: Verify on Live Site

After ~60s, check https://abqunplugged.com via Chrome MCP or computer-use screenshot.

---

## App Architecture Quick Reference

**Theme** (CSS vars in `terracotta.css`):
- `--ink`: dark text (~#1C1814)
- `--brand`: terracotta accent (~#C0552A)
- `--bg`: warm cream (~#F9F5F2)
- `--muted`: muted text

**Font**: Public Sans — loaded via `<link>` in index.html (NOT @import — Safari ITP)

**FlatIcon component** (custom inline SVG system):
- `viewBox="0 0 16 16"`, wrapped in `React.memo`
- Stroke style: `S = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }`
- Fill style: `F = { fill: color, stroke: 'none' }`
- Add new icons by inserting into the `map` object inside the FlatIcon component

**Browse by Category** (compact horizontal pill row, as of Apr 2026):
- Flex row with `overflowX: 'auto'`, `scrollbarWidth: 'none'`
- Each pill: `background: color + '18'` (10% tint), `border: 1.5px solid color + '40'`
- FlatIcon at 15px + bold 12px label in `--ink` color
- Categories: Music, Comedy, Arts, Sports, Family, Outdoor, Free, Volunteer

**Key Constants**:
- `EVENT_TYPE_META`: genre → `{ icon, bg }` for event type badges
- `PLACE_CATEGORIES`: `{ label, icon, value }[]` for place filter chips
- `CATEGORY_COLORS`: `Record<string, {bg, text}>` for place category pills
- `EVENT_GENRES`: flat string array for event filter tabs
