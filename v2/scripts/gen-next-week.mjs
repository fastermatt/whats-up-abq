#!/usr/bin/env node
/**
 * Local runner for the IG suggestion generation pipeline.
 * Mirrors the generate route exactly, runs with scripts/.env credentials.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const f of [path.join(__dirname,'.env'), path.join(__dirname,'..','..','scripts','.env')]) {
  if (fs.existsSync(f)) { fs.readFileSync(f,'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=]+)=(.*)$/);if(m)process.env[m[1].trim()]=m[2].trim()}); break }
}

const sb = createClient(
  process.env.SUPABASE_URL || 'https://bsmvfutebmbkjvlrhiyq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMDT(d) { return d.toLocaleDateString('en-CA',{timeZone:'America/Denver'}) }
function denverOffset(dateStr) {
  const p=new Date(dateStr+'T12:00:00Z')
  return Math.round((new Date(p.toLocaleString('en-US',{timeZone:'UTC'})).getTime()-new Date(p.toLocaleString('en-US',{timeZone:'America/Denver'})).getTime())/3600000)
}
function mdtToUTC(dateStr,h,m) {
  const [y,mo,d]=dateStr.split('-').map(Number)
  return new Date(Date.UTC(y,mo-1,d,h+denverOffset(dateStr),m,0))
}
function addDays(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r }
function nextMonday() {
  const now=new Date(); const today=toMDT(now); const d=new Date(today+'T12:00:00')
  const dow=d.getDay(); const days=dow===1?7:(8-dow)%7||7; d.setDate(d.getDate()+days); return d
}

// ── Schedule ─────────────────────────────────────────────────────────────────
const SLOTS = [
  {dow:1,type:'WeeklyFive',    tmpl:'weekly-five',    h:9,  m:0 },
  {dow:2,type:'SingleEvent',   tmpl:'poster',         h:17, m:30},
  {dow:3,type:'DeepDive',      tmpl:'split',          h:12, m:0 },
  {dow:4,type:'BreweryNights', tmpl:'tonight-list',   h:17, m:30},
  {dow:5,type:'WeekendDigest', tmpl:'weekend-digest', h:11, m:0,  variant:'headliners' },
  {dow:5,type:'WeekendDigest', tmpl:'weekend-digest', h:16, m:30, variant:'under-radar'},
  {dow:6,type:'SingleEvent',   tmpl:'poster',         h:10, m:30},
  {dow:0,type:'Tonight',       tmpl:'tonight-list',   h:16, m:0 },
]

// ── Event selection ───────────────────────────────────────────────────────────
const normT = t=>(t??'').toLowerCase().replace(/^[^:]{1,18}:\s*/,'').replace(/[^a-z0-9]+/g,'')
const isMarquee = e=>/^(ticketmaster_|seatgeek_)/.test(e.id)

// Exclude events with adult/explicit content from digest posts.
// These events may still appear on the public site — they're only excluded from
// family-general IG digest selection. Matt can also set hidden=true on events
// that should be removed from everything.
const ADULT_RE = /\b(burlesque|strip club|striptease|erotic|fetish|kink|nsfw|xxx|adult show|topless|pole dance)\b/i
const isAdultContent = e => ADULT_RE.test(e.title ?? '') || ADULT_RE.test(e.venue ?? '')

function pick(candidates, max, exclude) {
  const out=[],seen=new Set(),vc=new Map()
  for (const e of candidates) {
    if (exclude.has(e.id)) continue
    const v=(e.venue??'').toLowerCase(),t=normT(e.title),tm=(e.time??'').toLowerCase()
    const sk=tm?`@${e.date}|${v}|${tm}`:''
    if (t&&seen.has(t)) continue; if (sk&&seen.has(sk)) continue
    if (v){const c=vc.get(v)??0; if(c>=2)continue; vc.set(v,c+1)}
    if(t)seen.add(t); if(sk)seen.add(sk)
    out.push(e); if(out.length>=max)break
  }
  return out
}

// ── Caption ───────────────────────────────────────────────────────────────────
const SYSTEM = `You write Instagram captions for ABQ Unplugged — Albuquerque NM's local events guide.

VOICE: You are a Burqueño who has been to these shows, knows these venues, and is texting a friend about what's worth their Friday night. Confident, specific, never corporate. Write complete sentences like a real person — NOT advertising fragments.

CRITICAL: Write the caption directly. Do NOT say "Here's a caption", "Okay here's one", "Sure!", or any other preamble. Do NOT include a separator line (---). The very first word of your response is the first word of the caption.

BANNED PATTERNS (instantly sound AI-generated — never use):
- Three-word fragment sentences: "Cold beer. Live music." / "Four bands. One room."
- Invented crowd sizes or stadium imagery
- Generic hype: "amazing", "epic", "wild", "iconic", "zero filler", "summer formula"
- Marketing hooks: "Discover", "Unleash", "Don't miss"
- Em dashes, stacked bullet lists for every event

GOOD: Lead with the ONE detail that makes this interesting. Write like you know the venue and the artist. Pick 1-2 highlights and write about them naturally. Save/tag prompt should feel conversational.

NO time-relative phrases ("tonight", "this week", "this weekend") — scheduled ahead.
When prompt gives venue @handles, weave 1-2 naturally. Never invent a handle.
End with: abqunplugged.com 🌵
Final line: exactly 8 hashtags — #ABQ #Albuquerque #505 #BurqueLife #ThingsToDo505 plus 3 specific.
Body: 150-350 characters.`

const PROMPTS = {
  WeeklyFive: (e) => `Instagram caption for an Albuquerque "five shows worth knowing about" post.
Events: ${e.map(ev=>`${ev.title} at ${ev.venue||'ABQ'} on ${ev.date}${ev.time?' at '+ev.time:''}`).join(' / ')}
Lead with the most impressive name. Write like telling a friend which nights are worth planning around.`,
  SingleEvent: (e) => `Caption spotlighting one Albuquerque event.
Event: ${e[0]?.title} at ${e[0]?.venue} on ${e[0]?.date}${e[0]?.time?' at '+e[0].time:''}.
2-3 sentences. Reference something real about the artist or venue. Sound like a local who cares, not a ticket seller.`,
  DeepDive: (e) => `Caption for a "one you'd have missed" spotlight on a LOCAL Albuquerque event.
Event: ${e[0]?.title} at ${e[0]?.venue} on ${e[0]?.date}${e[0]?.time?' at '+e[0].time:''} (${e[0]?.category}).
3-4 sentences making the case for it. Who it's for, what makes it worth the trip. Earnest, specific. Sound like a local sharing a tip, not promoting.`,
  BreweryNights: (e) => `Instagram caption for an ABQ brewery live music roundup.
Events: ${e.map(ev=>`${ev.title} at ${ev.venue||'ABQ'} on ${ev.date}${ev.time?' at '+ev.time:''}`).join(' / ')}
Highlight 1-2 most interesting. Sound like someone who goes to these spots. Include a tag prompt.`,
  WeekendDigest: (e,variant) => `Caption for an Albuquerque weekend events roundup.
Events: ${e.map(ev=>`${ev.title} at ${ev.venue||'ABQ'} on ${ev.date}${ev.time?' at '+ev.time:''}`).join(' / ')}
${variant==='under-radar'?'Frame these as the under-the-radar picks — free, local, smaller-venue. The locals\' alternative to the big shows.':'Pick the angle that makes this weekend interesting. Don\'t list every event.'}
Include a save/tag prompt.`,
  Tonight: (e) => `Caption for an Albuquerque live events roundup.
Events: ${e.map(ev=>`${ev.title} at ${ev.venue||'ABQ'}${ev.time?' at '+ev.time:''}`).join(' / ')}
Lead with the most interesting name or pairing. Natural tone. Include a tag prompt.`,
}

const FALLBACKS = {
  WeeklyFive:'This week in Burque:', BreweryNights:'Taproom nights in ABQ:',
  WeekendDigest:'Your Albuquerque weekend, sorted:', SingleEvent:'On our radar:',
  Tonight:'Tonight in Burque:', DeepDive:'One you might have missed:',
}

async function caption(type, events, variant='') {
  if (!DEEPSEEK_KEY || !events.length) return ''
  const prompt = type==='WeekendDigest' ? PROMPTS.WeekendDigest(events,variant) : PROMPTS[type]?.(events) ?? ''
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+DEEPSEEK_KEY},
      body:JSON.stringify({model:'deepseek-v4-flash',messages:[{role:'system',content:SYSTEM},{role:'user',content:prompt}],temperature:0.8,max_tokens:400})
    })
    if (!res.ok) return ''
    return (await res.json()).choices?.[0]?.message?.content?.trim() ?? ''
  } catch { return '' }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const monday = nextMonday()
const dateStrs = Array.from({length:7},(_,i)=>toMDT(addDays(monday,i)))
const weekStart=dateStrs[0], weekEnd=dateStrs[6]

console.log(`\nGenerating: ${weekStart} → ${weekEnd}\n`)

// Build slot → date mapping (multimap: Fri gets 2 slots)
const slotsByDow = new Map()
for (const s of SLOTS) { const l=slotsByDow.get(s.dow)??[]; l.push(s); slotsByDow.set(s.dow,l) }

const slots = dateStrs.flatMap(dateStr => {
  const dow = new Date(dateStr+'T12:00:00').getDay()
  return (slotsByDow.get(dow)??[]).map(s=>({...s,dateStr,scheduledFor:mdtToUTC(dateStr,s.h,s.m)}))
}).sort((a,b)=>a.scheduledFor-b.scheduledFor)

// Fetch events
const {data:rows} = await sb.schema('public').from('events')
  .select('id,raw,event_date,venue_name,category,cached_photo_url,popularity_score,source')
  .eq('hidden',false).gte('event_date',weekStart).lte('event_date',weekEnd+'T23:59:59')
  .order('popularity_score',{ascending:false,nullsFirst:false}).limit(300)

const snaps = (rows??[]).map(row=>{
  const raw=row.raw??{}
  const d=raw.dates?.start; const lTime=d?.localTime??raw.time??null
  let time=lTime
  if (time&&/^\d{2}:\d{2}/.test(time)){const[hh,mm]=time.split(':').map(Number);time=`${hh%12||12}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`}
  return {id:row.id,title:String(raw.name??raw.title??'').trim()||row.venue_name,date:String(row.event_date).slice(0,10),time,venue:row.venue_name,category:row.category,imageUrl:row.cached_photo_url,popularityScore:Math.round((row.popularity_score??5)*10)/10}
})

const eventsOn = d => snaps.filter(e=>e.date===d)
const brewerySnaps = snaps.filter(e=>/brew|taproom|distill/i.test(e.venue??''))

const usedByType = {}
const seen = t => (usedByType[t]??=new Set())

const insertions = []

for (const slot of slots) {
  let selected=[], tmpl=slot.tmpl, notes=''
  const ex = seen(slot.type + (slot.variant||''))  // variant-specific dedup for digests

  switch (slot.type) {
    case 'WeeklyFive': {
      const byDay=new Map()
      for (const e of snaps){if(!byDay.has(e.date))byDay.set(e.date,[]);byDay.get(e.date).push(e)}
      const ord=[]; for(const[,de]of byDay)if(de[0])ord.push(de[0]); ord.push(...snaps)
      selected=pick(ord,5,ex); notes='Weekly overview — Mon morning planning post'
      break
    }
    case 'BreweryNights':
      selected=pick(brewerySnaps,5,ex); notes='Taproom + live music roundup'
      break
    case 'WeekendDigest': {
      const base=new Date(slot.dateStr+'T12:00:00')
      const toSat=(6-base.getDay()+7)%7
      const satStr=toMDT(addDays(base,toSat)), sunStr=toMDT(addDays(base,toSat+1))
      // Filter adult content from digest posts — these go to a general audience.
      const wknd=snaps.filter(e=>(e.date===satStr||e.date===sunStr)&&!isAdultContent(e))
      if (slot.variant==='under-radar') {
        const local=wknd.filter(e=>!isMarquee(e)), rest=wknd.filter(e=>isMarquee(e))
        selected=pick([...local,...rest],5,ex); notes='Under the radar — free/local/overlooked, no overlap with headliners'
      } else {
        const sat=wknd.filter(e=>e.date===satStr), sun=wknd.filter(e=>e.date===sunStr)
        selected=pick([...sat.slice(0,3),...sun.slice(0,2),...sat.slice(3),...sun.slice(2)],5,ex)
        notes='Weekend headliners — biggest draws Sat+Sun'
      }
      break
    }
    case 'DeepDive': {
      const band=snaps.filter(e=>e.imageUrl&&!isMarquee(e)&&e.popularityScore>=4&&e.popularityScore<=7.5)
      selected=pick(band,1,ex)
      if(!selected.length) selected=pick(snaps.filter(e=>e.imageUrl&&!isMarquee(e)),1,ex)
      if(!selected.length){console.log('  ⏭  DeepDive — no suitable event, skipping');continue}
      tmpl=selected[0]?.imageUrl?'split':'broadside'
      notes='Deep dive — overlooked local event people would miss'
      break
    }
    case 'SingleEvent': {
      const day=eventsOn(slot.dateStr)
      const high=day.filter(e=>e.popularityScore>=8)
      const withPhoto=(high.length?high:day).filter(e=>e.imageUrl)
      selected=pick(withPhoto.length?withPhoto:(high.length?high:day),1,ex)
      if (!selected.length) {
        const end=toMDT(addDays(new Date(slot.dateStr+'T12:00:00'),3))
        const near=snaps.filter(e=>e.date>=slot.dateStr&&e.date<=end&&e.popularityScore>=7)
        selected=pick(near.filter(e=>e.imageUrl).length?near.filter(e=>e.imageUrl):near,1,ex)
      }
      if (!selected.length){console.log('  ⏭  SingleEvent — no suitable event, skipping');continue}
      const cat=selected[0]?.category??''
      tmpl=selected[0]?.imageUrl?(cat==='Music'||cat==='Festivals'?'poster':cat==='Food & Drink'||cat==='Community'?'golden-hour':'split'):'broadside'
      notes=`Spotlight — ${selected[0]?.imageUrl?`photo (${tmpl})`:'type-only'}`
      break
    }
    case 'Tonight':
      selected=pick(eventsOn(slot.dateStr),5,ex); notes='What\'s on tonight roundup'
      break
  }

  if (!selected.length) continue
  selected.forEach(e=>ex.add(e.id))

  process.stdout.write(`  ${slot.dateStr} ${String(slot.h).padStart(2)} : ${slot.type.padEnd(15)} ${slot.variant||''} — ${selected[0].title.slice(0,35)} … `)
  const cap = await caption(slot.type, selected, slot.variant||'')
  const finalCap = cap || `${FALLBACKS[slot.type]||'Happening in Albuquerque:'}\n${selected.map(e=>`• ${e.title} @ ${e.venue||'ABQ'}`).join('\n')}\n\nabqunplugged.com 🌵\n#ABQ #Albuquerque #505 #BurqueLife #ThingsToDo505 #ABQEvents #NewMexico #DukeCity`
  console.log(cap ? `✅ (${cap.length}ch)` : '⚠️ fallback')

  insertions.push({
    generation_id: crypto.randomUUID(),
    post_type: slot.type,
    template_id: tmpl,
    event_ids: selected.map(e=>e.id),
    event_data: selected,
    caption: finalCap,
    scheduled_for: slot.scheduledFor.toISOString(),
    status: 'pending',
    strategy_notes: notes,
  })
}

if (!insertions.length) { console.log('\nNothing to insert.'); process.exit(0) }

const {error} = await sb.schema('public').from('ig_post_suggestions').insert(insertions)
if (error) { console.error('\n❌ Insert error:', error.message); process.exit(1) }

console.log(`\n✅ Inserted ${insertions.length} suggestions for ${weekStart} → ${weekEnd}\n`)
for (const ins of insertions) {
  const d=new Date(ins.scheduled_for); const mdt=d.toLocaleString('en-US',{timeZone:'America/Denver',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
  console.log(`  ${mdt.padEnd(28)} ${ins.post_type.padEnd(15)} ${(ins.strategy_notes||'').slice(0,50)}`)
  console.log(`     Hook: ${ins.caption.split('\n')[0].slice(0,80)}`)
}
