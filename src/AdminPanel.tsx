import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT      = '#8B3A0F';
const SIDEBAR_BG  = '#18181b';
const SIDEBAR_W   = 230;
const ADMIN_EMAIL = '4mattcarlson@gmail.com';
const ADMIN_PW    = 'abqadmin2025';
const PW_EXP_KEY  = 'abq_admin_pw_exp';
const PW_TTL      = 24 * 60 * 60 * 1000;

const PLACE_CATS  = ['restaurant','bar','coffee','park','museum','shop','entertainment','outdoor','arts','fitness','hotel','other'];
const PLACE_TAGS  = ['outdoor','indoor','family-friendly','dog-friendly','live-music','date-night','free','kid-friendly','accessible','patio','late-night','brunch','art','nature','hiking','sports'];
const EVENT_TAGS  = ['outdoor','indoor','family-friendly','free','live-music','sports','art','comedy','festival','dance','film','food','kids','nightlife','theater'];

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const sb = (t: string) => (supabase.from as any)(t);

async function cfgGet(key: string): Promise<any> {
  const { data } = await sb('config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function cfgSet(key: string, value: any) {
  await sb('config').upsert({ key, value });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type AdminSection =
  | 'dashboard' | 'banners' | 'events' | 'places'
  | 'categories' | 'content' | 'refresh' | 'reviews'
  | 'analytics' | 'tagrules' | 'settings';

interface Banner {
  id: string; message: string; type: 'info'|'warning'|'promo';
  startDate: string; endDate: string; linkUrl: string; linkText: string; active: boolean;
}
interface TagRulesConfig {
  outdoorKeywords: string[]; indoorKeywords: string[];
  categoryKeywords: Record<string, string[]>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastT = { id: number; msg: string; kind: 'ok'|'err'|'info' };
let _tset: React.Dispatch<React.SetStateAction<ToastT[]>> | null = null;
const toast = (msg: string, kind: ToastT['kind'] = 'ok') => {
  if (!_tset) return;
  const id = Date.now() + Math.random();
  _tset(p => [...p, { id, msg, kind }]);
  setTimeout(() => _tset!(p => p.filter(t => t.id !== id)), 3500);
};
function Toaster() {
  const [items, set] = useState<ToastT[]>([]); _tset = set;
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:99999, display:'flex', flexDirection:'column-reverse', gap:8, pointerEvents:'none' }}>
      {items.map(t => <div key={t.id} style={{ padding:'11px 16px', borderRadius:10, fontSize:13, fontWeight:700, color:'#fff', background: t.kind==='ok'?'#059669':t.kind==='err'?'#dc2626':'#2563eb', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', pointerEvents:'auto' }}>{t.msg}</div>)}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel }: { msg:string; onOk:()=>void; onCancel:()=>void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:14, padding:28, maxWidth:360, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:20, lineHeight:1.5 }}>{msg}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={btnS}>Cancel</button>
          <button onClick={onOk}    style={{ ...btnS, background:'#dc2626', color:'#fff', border:'none', fontWeight:700 }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, boxSizing:'border-box', background:'#fafafa', outline:'none', fontFamily:'inherit' };
const card: React.CSSProperties = { background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'20px 24px' };
const btnP: React.CSSProperties = { padding:'8px 18px', borderRadius:8, border:'none', background:ACCENT, color:'#fff', cursor:'pointer', fontSize:13, fontWeight:700 };
const btnS: React.CSSProperties = { padding:'8px 14px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', cursor:'pointer', fontSize:13, fontFamily:'inherit' };
const btnD: React.CSSProperties = { padding:'5px 10px', borderRadius:6, border:'none', background:'#fee2e2', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:600 };
const th: React.CSSProperties = { padding:'10px 12px', textAlign:'left', background:'#f8f9fa', borderBottom:'2px solid #e5e7eb', fontWeight:700, fontSize:12, color:'#6b7280', whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding:'10px 12px', borderBottom:'1px solid #f3f4f6', verticalAlign:'middle', fontSize:13 };
const lbl: React.CSSProperties = { fontSize:11, fontWeight:700, color:'#6b7280', display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' };
const PAGE = 50;

function SectionHeader({ title, sub, action }: { title:string; sub?:string; action?:React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#18181b', margin:0, letterSpacing:'-0.4px' }}>{title}</h1>
        {sub && <p style={{ fontSize:13, color:'#9ca3af', margin:'4px 0 0' }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function TagPill({ label, active, onClick }: { label:string; active:boolean; onClick:()=>void }) {
  return <button type="button" onClick={onClick} style={{ padding:'4px 10px', borderRadius:999, fontSize:12, cursor:'pointer', border:'1px solid '+(active?ACCENT:'#e5e7eb'), background:active?ACCENT:'#fff', color:active?'#fff':'#374151' }}>{label}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardSection({ onNav }: { onNav:(s:AdminSection)=>void }) {
  const [stats, setStats] = useState({ events:0, places:0, banners:0, reviews:0, analytics:0 });
  const [lastRefresh, setLastRefresh] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      const [evR, plR, rvR, anR, cfg, rlog] = await Promise.all([
        sb('events').select('id',{count:'exact',head:true}).eq('hidden',false),
        sb('places').select('id',{count:'exact',head:true}).eq('hidden',false),
        sb('reviews').select('id',{count:'exact',head:true}),
        sb('analytics').select('id',{count:'exact',head:true}),
        cfgGet('banners'),
        cfgGet('refreshLog'),
      ]);
      setStats({ events:evR.count??0, places:plR.count??0, banners:(cfg||[]).filter((b:Banner)=>b.active).length, reviews:rvR.count??0, analytics:anR.count??0 });
      if (rlog?.lastRun) setLastRefresh(rlog.lastRun);
      setLoading(false);
    }
    load();
  }, []);
  const cards = [
    { label:'Live Events',   val:stats.events,    icon:'🎫', color:'#8B3A0F', sec:'events'    as AdminSection },
    { label:'Places',        val:stats.places,    icon:'📍', color:'#1d4ed8', sec:'places'    as AdminSection },
    { label:'Active Banners',val:stats.banners,   icon:'📢', color:'#059669', sec:'banners'   as AdminSection },
    { label:'Analytics Events',val:stats.analytics,icon:'📊',color:'#7c3aed', sec:'analytics' as AdminSection },
  ];
  return (
    <div>
      <SectionHeader title="Dashboard" sub="ABQ Unplugged content overview" />
      {loading ? <p style={{color:'#9ca3af',textAlign:'center',padding:48}}>Loading…</p> : <>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
          {cards.map(c => (
            <button key={c.label} onClick={() => onNav(c.sec)} style={{ ...card, cursor:'pointer', textAlign:'left', padding:'20px' }}>
              <div style={{ fontSize:26, marginBottom:8 }}>{c.icon}</div>
              <div style={{ fontSize:28, fontWeight:800, color:c.color, letterSpacing:'-1px' }}>{c.val.toLocaleString()}</div>
              <div style={{ fontSize:12, color:'#9ca3af', fontWeight:600, marginTop:4 }}>{c.label}</div>
            </button>
          ))}
        </div>
        {lastRefresh && <div style={{ ...card, marginBottom:20, display:'flex', alignItems:'center', gap:12, background:'#fffbeb', borderColor:'#fde68a' }}>
          <span style={{fontSize:20}}>🔄</span>
          <div><div style={{fontSize:13,fontWeight:700,color:'#92400e'}}>Last data refresh</div><div style={{fontSize:12,color:'#b45309'}}>{new Date(lastRefresh).toLocaleString()}</div></div>
        </div>}
        <div style={card}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Quick Actions</h3>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {([['+ Add Event','events',ACCENT],['+ Add Place','places','#1d4ed8'],['📢 New Banner','banners','#059669'],['📊 Analytics','analytics','#7c3aed'],['🔄 Data Refresh','refresh','#6b7280']] as [string,AdminSection,string][]).map(([label,sec,color])=>(
              <button key={sec} onClick={()=>onNav(sec)} style={{padding:'10px 18px',borderRadius:8,border:'none',background:color,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700}}>{label}</button>
            ))}
          </div>
        </div>
      </>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNERS
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_B: Banner = { id:'', message:'', type:'info', startDate:'', endDate:'', linkUrl:'', linkText:'', active:false };
function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<Banner|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string|null>(null);
  useEffect(() => { cfgGet('banners').then(v => { setBanners(v||[]); setLoading(false); }); }, []);
  const persist = async (list:Banner[]) => { setBanners(list); await cfgSet('banners',list); };
  const upsert  = async () => {
    if (!editing) return;
    if (!editing.message.trim()) { toast('Message required','err'); return; }
    setSaving(true);
    const upd = editing.id ? banners.map(b=>b.id===editing.id?editing:b) : [...banners,{...editing,id:Date.now().toString()}];
    await persist(upd); setEditing(null); toast(editing.id?'Banner updated ✓':'Banner created ✓'); setSaving(false);
  };
  const del = async (id:string) => { await persist(banners.filter(b=>b.id!==id)); toast('Deleted'); setConfirm(null); };
  const toggle = async (id:string) => { await persist(banners.map(b=>b.id===id?{...b,active:!b.active}:b)); toast('Updated'); };
  const pvStyle = (b:Banner): React.CSSProperties => ({
    padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600,
    background:b.type==='warning'?'#fef3c7':b.type==='promo'?'#fce7f3':'#dbeafe',
    color:b.type==='warning'?'#92400e':b.type==='promo'?'#9d174d':'#1e40af',
    border:`1px solid ${b.type==='warning'?'#fcd34d':b.type==='promo'?'#fbcfe8':'#bfdbfe'}`,
  });
  const now = new Date().toISOString().split('T')[0];
  return (
    <div>
      <SectionHeader title="Banners" sub="Site-wide announcement banners" action={<button style={btnP} onClick={()=>setEditing({...EMPTY_B})}>+ New Banner</button>} />
      {loading ? <p style={{color:'#9ca3af',textAlign:'center',padding:40}}>Loading…</p> : <>
        {editing && (
          <div style={{...card,marginBottom:24,border:`2px solid ${ACCENT}`}}>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>{editing.id?'Edit':'New'} Banner</h3>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={lbl}>Message *</label><textarea value={editing.message} onChange={e=>setEditing(v=>v&&{...v,message:e.target.value})} rows={3} style={{...inp,resize:'vertical'}} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={lbl}>Type</label>
                  <select value={editing.type} onChange={e=>setEditing(v=>v&&{...v,type:e.target.value as Banner['type']})} style={inp}>
                    <option value="info">ℹ️ Info</option><option value="warning">⚠️ Warning</option><option value="promo">🎉 Promo</option>
                  </select></div>
                <div style={{display:'flex',alignItems:'flex-end',paddingBottom:2}}>
                  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14,fontWeight:600}}>
                    <input type="checkbox" checked={editing.active} onChange={e=>setEditing(v=>v&&{...v,active:e.target.checked})} style={{width:18,height:18}} /> Active
                  </label></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={lbl}>Start Date</label><input type="date" value={editing.startDate} onChange={e=>setEditing(v=>v&&{...v,startDate:e.target.value})} style={inp} /></div>
                <div><label style={lbl}>End Date</label><input type="date" value={editing.endDate} onChange={e=>setEditing(v=>v&&{...v,endDate:e.target.value})} style={inp} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={lbl}>Link URL</label><input value={editing.linkUrl} onChange={e=>setEditing(v=>v&&{...v,linkUrl:e.target.value})} style={inp} placeholder="https://…" /></div>
                <div><label style={lbl}>Link Text</label><input value={editing.linkText} onChange={e=>setEditing(v=>v&&{...v,linkText:e.target.value})} style={inp} placeholder="Learn more" /></div>
              </div>
              {editing.message && <div><label style={lbl}>Preview</label><div style={pvStyle(editing)}>{editing.message}{editing.linkUrl&&editing.linkText&&<span style={{marginLeft:8,textDecoration:'underline'}}>{editing.linkText}</span>}</div></div>}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button style={btnS} onClick={()=>setEditing(null)}>Cancel</button>
                <button style={{...btnP,opacity:saving?0.7:1}} onClick={upsert} disabled={saving}>{saving?'Saving…':editing.id?'Update':'Create'}</button>
              </div>
            </div>
          </div>
        )}
        {!banners.length && <p style={{textAlign:'center',color:'#9ca3af',padding:60}}>No banners yet.</p>}
        {banners.map(b => (
          <div key={b.id} style={{...card,marginBottom:10,display:'flex',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:220}}>
              <div style={pvStyle(b)}>{b.message}{b.linkUrl&&b.linkText&&<span style={{marginLeft:8,textDecoration:'underline'}}>{b.linkText}</span>}</div>
              <div style={{display:'flex',gap:14,marginTop:6,fontSize:12,color:'#9ca3af',flexWrap:'wrap'}}>
                <span>Type: <strong>{b.type}</strong></span>
                {b.startDate&&<span>Start: {b.startDate}</span>}
                {b.endDate&&<span>End: {b.endDate}</span>}
                <span style={{color:b.active&&(!b.endDate||b.endDate>=now)?'#059669':'#9ca3af',fontWeight:700}}>{b.active&&(!b.endDate||b.endDate>=now)?'LIVE':'OFF'}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button onClick={()=>toggle(b.id)} style={{...btnS,fontSize:12,padding:'5px 12px',color:b.active?'#059669':'#6b7280',fontWeight:700}}>{b.active?'Live ✓':'Off'}</button>
              <button onClick={()=>setEditing({...b})} style={{...btnS,fontSize:12,padding:'5px 12px'}}>Edit</button>
              <button onClick={()=>setConfirm(b.id)} style={btnD}>Del</button>
            </div>
          </div>
        ))}
      </>}
      {confirm && <Confirm msg="Delete this banner?" onOk={()=>del(confirm)} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS  (schema: id, source, raw jsonb, event_date, hidden, featured)
// ─────────────────────────────────────────────────────────────────────────────
function EventsSection() {
  const [rows, setRows]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [filterSrc, setFilterSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string|null>(null);
  const [bulkAct, setBulkAct] = useState('');
  const [form, setForm]       = useState({ name:'', date:'', time:'', venue:'', ticketUrl:'', category:'Music', source:'manual', is21Plus:false, tags:[] as string[] });

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb('events').select('id,source,event_date,hidden,featured,raw', {count:'exact'}).order('event_date',{ascending:true});
    if (search)    q = q.ilike('raw->>name', `%${search}%`);
    if (filterSrc) q = q.eq('source', filterSrc);
    q = q.range(page*PAGE,(page+1)*PAGE-1);
    const { data, count } = await q;
    setRows(data||[]); setTotal(count??0); setLoading(false);
  }, [page, search, filterSrc]);

  useEffect(() => { load(); }, [load]);

  const name = (r:any) => { try { const raw = r.raw; return (typeof raw==='string'?JSON.parse(raw):raw)?.name||'—'; } catch { return '—'; } };
  const venue = (r:any) => { try { const raw = r.raw; const p=typeof raw==='string'?JSON.parse(raw):raw; return p?._embedded?.venues?.[0]?.name||p?.venue||'—'; } catch { return '—'; } };

  const addEvent = async () => {
    if (!form.name.trim()||!form.date) { toast('Name and date required','err'); return; }
    setSaving(true);
    const raw = { id:'manual-'+Date.now(), name:form.name, url:form.ticketUrl||undefined, _source:'manual',
      dates:{start:{localDate:form.date, localTime:form.time||undefined}},
      _embedded:{venues:[{name:form.venue}]},
      classifications:form.category?[{segment:{name:form.category}}]:undefined,
      _isAdult:form.is21Plus||undefined };
    const { error } = await sb('events').insert({ id:raw.id, source:'manual', event_date:form.date, raw });
    if (error) { toast('Error: '+error.message,'err'); } else { toast('Event added ✓'); setShowAdd(false); setForm({name:'',date:'',time:'',venue:'',ticketUrl:'',category:'Music',source:'manual',is21Plus:false,tags:[]}); load(); }
    setSaving(false);
  };
  const hideEv   = async (id:string, val:boolean) => { await sb('events').update({hidden:val}).eq('id',id); toast(val?'Hidden':'Restored'); load(); };
  const featEv   = async (r:any) => { await sb('events').update({featured:!r.featured}).eq('id',r.id); toast(r.featured?'Removed from spotlight':'Spotlight ✓'); load(); };
  const deleteEv = async (id:string) => { await sb('events').delete().eq('id',id); toast('Deleted'); setConfirm(null); load(); };
  const toggleSel = (id:string) => setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const doBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length||!bulkAct) return;
    if (bulkAct==='hide') for (const id of ids) await sb('events').update({hidden:true}).eq('id',id);
    if (bulkAct==='delete') for (const id of ids) await sb('events').delete().eq('id',id);
    toast(`${ids.length} events ${bulkAct==='hide'?'hidden':'deleted'}`);
    setSelected(new Set()); setBulkAct(''); load();
  };

  return (
    <div>
      <SectionHeader title="Events" sub={`${total.toLocaleString()} total`} action={<button style={btnP} onClick={()=>setShowAdd(v=>!v)}>+ Add Event</button>} />
      {showAdd && (
        <div style={{...card,marginBottom:20,border:`2px solid ${ACCENT}`}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>New Manual Event</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
            {([['name','Name *'],['date','Date *','date'],['time','Time','time'],['venue','Venue'],['ticketUrl','Ticket URL'],['category','Category','select']] as [string,string,string?][]).map(([k,l,type])=>(
              <div key={k}>
                <label style={lbl}>{l}</label>
                {type==='select' ? <select value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp}>
                  {['Music','Sports','Arts','Family','Comedy','Festival','Food','Film','Other'].map(c=><option key={c}>{c}</option>)}</select>
                : <input type={type||'text'} value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={inp} />}
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}>
            <label style={lbl}>Tags</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{EVENT_TAGS.map(t=><TagPill key={t} label={t} active={form.tags.includes(t)} onClick={()=>setForm(f=>({...f,tags:f.tags.includes(t)?f.tags.filter(x=>x!==t):[...f.tags,t]}))} />)}</div>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:8,marginTop:12,cursor:'pointer',fontSize:14}}>
            <input type="checkbox" checked={form.is21Plus} onChange={e=>setForm(f=>({...f,is21Plus:e.target.checked}))} /> 21+ / adult
          </label>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
            <button style={btnS} onClick={()=>setShowAdd(false)}>Cancel</button>
            <button style={{...btnP,opacity:saving?0.7:1}} onClick={addEvent} disabled={saving}>{saving?'Saving…':'Save Event'}</button>
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search events…" style={{...inp,width:240,minWidth:0}} />
        <select value={filterSrc} onChange={e=>{setFilterSrc(e.target.value);setPage(0);}} style={{...inp,width:160}}>
          {['','ticketmaster','seatgeek','bandsintown','musicbrainz','manual'].map(s=><option key={s} value={s}>{s||'All sources'}</option>)}
        </select>
        {selected.size>0 && <>
          <span style={{fontSize:13,color:'#9ca3af'}}>{selected.size} selected</span>
          <select value={bulkAct} onChange={e=>setBulkAct(e.target.value)} style={{...inp,width:140}}>
            <option value="">Bulk action…</option><option value="hide">Hide</option><option value="delete">Delete</option>
          </select>
          <button style={btnP} onClick={doBulk} disabled={!bulkAct}>Apply</button>
        </>}
      </div>
      <div style={{...card,padding:0,overflow:'hidden'}}>
        {loading ? <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p> : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr>
                <th style={{...th,width:36}}><input type="checkbox" onChange={e=>setSelected(e.target.checked?new Set(rows.map(r=>r.id)):new Set())} /></th>
                <th style={th}>Name</th><th style={th}>Date</th><th style={th}>Venue</th><th style={th}>Source</th><th style={th}>Status</th><th style={th}>Actions</th>
              </tr></thead>
              <tbody>{rows.map(r=>(
                <tr key={r.id} style={{background:selected.has(r.id)?'#fdf3ee':'white'}}>
                  <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSel(r.id)} /></td>
                  <td style={{...td,maxWidth:260}}>
                    <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name(r)}</div>
                    {r.featured&&<span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 5px',borderRadius:3,fontWeight:700}}>SPOTLIGHT</span>}
                  </td>
                  <td style={{...td,whiteSpace:'nowrap'}}>{r.event_date}</td>
                  <td style={{...td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#6b7280'}}>{venue(r)}</td>
                  <td style={td}><span style={{fontSize:11,background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:4,fontWeight:700}}>{r.source}</span></td>
                  <td style={td}>{r.hidden?<span style={{color:'#9ca3af',fontSize:12}}>Hidden</span>:<span style={{color:'#059669',fontSize:12,fontWeight:700}}>Live</span>}</td>
                  <td style={td}><div style={{display:'flex',gap:5}}>
                    <button onClick={()=>featEv(r)} style={{...btnS,fontSize:11,padding:'3px 7px',color:r.featured?'#d97706':'#9ca3af'}} title="Spotlight">★</button>
                    <button onClick={()=>hideEv(r.id,!r.hidden)} style={{...btnS,fontSize:11,padding:'3px 7px'}}>{r.hidden?'Show':'Hide'}</button>
                    <button onClick={()=>setConfirm(r.id)} style={btnD}>Del</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length&&<p style={{textAlign:'center',color:'#9ca3af',padding:40}}>No events found.</p>}
          </div>
        )}
      </div>
      {total>PAGE&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14}}>
        <span style={{fontSize:13,color:'#9ca3af'}}>{page*PAGE+1}–{Math.min((page+1)*PAGE,total)} of {total}</span>
        <div style={{display:'flex',gap:8}}>
          <button style={{...btnS,opacity:page===0?0.4:1}} onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Prev</button>
          <button style={{...btnS,opacity:(page+1)*PAGE>=total?0.4:1}} onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=total}>Next →</button>
        </div>
      </div>}
      {confirm&&<Confirm msg="Delete this event permanently?" onOk={()=>deleteEv(confirm)} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACES  (schema: id, source, raw jsonb, hidden, featured)
// ─────────────────────────────────────────────────────────────────────────────
function PlacesSection() {
  const [rows, setRows]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string|null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb('places').select('id,source,hidden,featured,raw',{count:'exact'}).order('raw->>name',{ascending:true});
    if (search) q = q.ilike('raw->>name',`%${search}%`);
    q = q.range(page*PAGE,(page+1)*PAGE-1);
    const { data, count } = await q;
    setRows(data||[]); setTotal(count??0); setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const pName  = (r:any) => r.raw?.name || '—';
  const pCat   = (r:any) => r.raw?.category || (r.raw?.types?.[0]||'other');
  const pAddr  = (r:any) => r.raw?.vicinity || r.raw?.address || '—';
  const pRating= (r:any) => r.raw?.rating ? `⭐ ${r.raw.rating}` : '—';

  const hidePlace = async (id:string, val:boolean) => { await sb('places').update({hidden:val}).eq('id',id); toast(val?'Hidden':'Restored'); load(); };
  const featPlace = async (r:any) => { await sb('places').update({featured:!r.featured}).eq('id',r.id); toast(r.featured?'Removed from featured':'Featured ✓'); load(); };
  const delPlace  = async (id:string) => { await sb('places').delete().eq('id',id); toast('Deleted'); setConfirm(null); load(); };
  const toggleSel = (id:string) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const doBulkCat = async () => {
    if (!selected.size||!bulkCat) return;
    for (const id of selected) {
      const row = rows.find(r=>r.id===id);
      if (row) await sb('places').update({raw:{...row.raw,category:bulkCat}}).eq('id',id);
    }
    toast(`${selected.size} places → ${bulkCat}`); setSelected(new Set()); setBulkCat(''); load();
  };

  return (
    <div>
      <SectionHeader title="Places" sub={`${total.toLocaleString()} total`} />
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search places…" style={{...inp,width:240,minWidth:0}} />
        {selected.size>0&&<>
          <span style={{fontSize:13,color:'#9ca3af'}}>{selected.size} selected</span>
          <select value={bulkCat} onChange={e=>setBulkCat(e.target.value)} style={{...inp,width:160}}>
            <option value="">Change category…</option>{PLACE_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <button style={btnP} onClick={doBulkCat} disabled={!bulkCat}>Apply</button>
        </>}
      </div>
      <div style={{...card,padding:0,overflow:'hidden'}}>
        {loading?<p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>:(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr>
                <th style={{...th,width:36}}><input type="checkbox" onChange={e=>setSelected(e.target.checked?new Set(rows.map(r=>r.id)):new Set())} /></th>
                <th style={th}>Name</th><th style={th}>Category</th><th style={th}>Rating</th><th style={th}>Address</th><th style={th}>Featured</th><th style={th}>Status</th><th style={th}>Actions</th>
              </tr></thead>
              <tbody>{rows.map(r=>(
                <tr key={r.id} style={{background:selected.has(r.id)?'#fdf3ee':'white'}}>
                  <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSel(r.id)} /></td>
                  <td style={{...td,fontWeight:600,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pName(r)}</td>
                  <td style={td}><span style={{fontSize:11,background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:4}}>{pCat(r)}</span></td>
                  <td style={td}>{pRating(r)}</td>
                  <td style={{...td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#6b7280',fontSize:12}}>{pAddr(r)}</td>
                  <td style={td}>{r.featured?<span style={{color:'#d97706',fontWeight:700}}>★ Yes</span>:<span style={{color:'#9ca3af'}}>No</span>}</td>
                  <td style={td}>{r.hidden?<span style={{color:'#9ca3af',fontSize:12}}>Hidden</span>:<span style={{color:'#059669',fontSize:12,fontWeight:700}}>Live</span>}</td>
                  <td style={td}><div style={{display:'flex',gap:5}}>
                    <button onClick={()=>featPlace(r)} style={{...btnS,fontSize:11,padding:'3px 7px',color:r.featured?'#d97706':'#9ca3af'}}>★</button>
                    <button onClick={()=>hidePlace(r.id,!r.hidden)} style={{...btnS,fontSize:11,padding:'3px 7px'}}>{r.hidden?'Show':'Hide'}</button>
                    <button onClick={()=>setConfirm(r.id)} style={btnD}>Del</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length&&<p style={{textAlign:'center',color:'#9ca3af',padding:40}}>No places found.</p>}
          </div>
        )}
      </div>
      {total>PAGE&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:14}}>
        <span style={{fontSize:13,color:'#9ca3af'}}>{page*PAGE+1}–{Math.min((page+1)*PAGE,total)} of {total}</span>
        <div style={{display:'flex',gap:8}}>
          <button style={{...btnS,opacity:page===0?0.4:1}} onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Prev</button>
          <button style={{...btnS,opacity:(page+1)*PAGE>=total?0.4:1}} onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=total}>Next →</button>
        </div>
      </div>}
      {confirm&&<Confirm msg="Delete this place permanently?" onOk={()=>delPlace(confirm)} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
interface CatEntry { id:string; name:string; icon:string; color:string; type:'event'|'place'; order:number; }
const DEF_CATS: CatEntry[] = [
  ...PLACE_CATS.map((n,i)=>({id:'pl-'+n,name:n,icon:'📍',color:'#1d4ed8',type:'place' as const,order:i})),
  ...['Music','Sports','Arts','Family','Comedy','Festival','Food','Film','Nightlife','Outdoor','Other'].map((n,i)=>({id:'ev-'+n,name:n,icon:'🎫',color:ACCENT,type:'event' as const,order:i})),
];
function CategoriesSection() {
  const [cats, setCats] = useState<CatEntry[]>(DEF_CATS);
  const [editing, setEditing] = useState<CatEntry|null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [filter,  setFilter]  = useState<'all'|'event'|'place'>('all');
  useEffect(() => { cfgGet('categories').then(v=>{ if(v?.length) setCats(v); setLoading(false); }); }, []);
  const persist = async (list:CatEntry[]) => { await cfgSet('categories',list); setCats(list); };
  const addCat  = async () => {
    const name=prompt('Category name:'); if(!name?.trim()) return;
    const type=(prompt('Type (event or place)?')||'event') as 'event'|'place';
    const nc:CatEntry = {id:type+'-'+name.trim().toLowerCase(),name:name.trim(),icon:'📁',color:'#6b7280',type,order:cats.length};
    await persist([...cats,nc]); toast('Added ✓');
  };
  const move = async (id:string,dir:-1|1) => {
    const i=cats.findIndex(c=>c.id===id); if(i<0) return;
    const j=i+dir; if(j<0||j>=cats.length) return;
    const next=[...cats]; [next[i],next[j]]=[next[j],next[i]]; next.forEach((c,idx)=>c.order=idx);
    await persist(next);
  };
  const vis = cats.filter(c=>filter==='all'||c.type===filter).sort((a,b)=>a.order-b.order);
  if (loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;
  return (
    <div>
      <SectionHeader title="Categories" sub="Manage event and place categories" action={<button style={btnP} onClick={addCat}>+ New</button>} />
      {editing&&(
        <div style={{...card,marginBottom:20,border:`2px solid ${ACCENT}`}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 80px 120px 100px',gap:12}}>
            <div><label style={lbl}>Name</label><input value={editing.name} onChange={e=>setEditing(v=>v&&{...v,name:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Icon</label><input value={editing.icon} onChange={e=>setEditing(v=>v&&{...v,icon:e.target.value})} style={inp} /></div>
            <div><label style={lbl}>Color</label><input type="color" value={editing.color} onChange={e=>setEditing(v=>v&&{...v,color:e.target.value})} style={{...inp,padding:4,height:38}} /></div>
            <div><label style={lbl}>Type</label><select value={editing.type} onChange={e=>setEditing(v=>v&&{...v,type:e.target.value as 'event'|'place'})} style={inp}><option value="event">Event</option><option value="place">Place</option></select></div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
            <button style={btnS} onClick={()=>setEditing(null)}>Cancel</button>
            <button style={{...btnP,opacity:saving?0.7:1}} onClick={async()=>{setSaving(true);await persist(cats.map(c=>c.id===editing.id?editing:c));setEditing(null);setSaving(false);toast('Saved ✓');}} disabled={saving}>Save</button>
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:4,marginBottom:14}}>
        {(['all','event','place'] as const).map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:filter===f?700:400,background:filter===f?ACCENT:'#f3f4f6',color:filter===f?'#fff':'#374151'}}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>)}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {vis.map((c,i)=>(
          <div key={c.id} style={{...card,display:'flex',alignItems:'center',gap:12,padding:'12px 16px'}}>
            <span style={{fontSize:22}}>{c.icon}</span>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{c.name}</div><div style={{fontSize:11,color:'#9ca3af'}}>{c.type}</div></div>
            <div style={{width:18,height:18,borderRadius:'50%',background:c.color,border:'2px solid #e5e7eb'}} />
            <div style={{display:'flex',gap:4}}>
              <button style={{...btnS,fontSize:11,padding:'3px 7px'}} onClick={()=>move(c.id,-1)} disabled={i===0}>↑</button>
              <button style={{...btnS,fontSize:11,padding:'3px 7px'}} onClick={()=>move(c.id, 1)} disabled={i===vis.length-1}>↓</button>
              <button style={{...btnS,fontSize:11,padding:'3px 7px'}} onClick={()=>setEditing({...c})}>Edit</button>
              <button style={btnD} onClick={async()=>{await persist(cats.filter(x=>x.id!==c.id));toast('Deleted');}}>Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
interface ContentCfg { heroLines:string[]; dailyGem:{title:string;subtitle:string;placeId:string}; vibes:{id:string;name:string;color:string;icon:string;category:string}[]; sections:Record<string,boolean>; }
const DEF_CONTENT: ContentCfg = {
  heroLines:['GO DO SOMETHING','TOUCH SOME GRASS','GET OFF THE COUCH','FIND YOUR CITY'],
  dailyGem:{title:"Sunday's Spot",subtitle:'Our pick for the day',placeId:''},
  vibes:[{id:'v1',name:'Outdoor',color:'#166534',icon:'🌲',category:'park'},{id:'v2',name:'Date Night',color:'#9d174d',icon:'🌹',category:'restaurant'},{id:'v3',name:'Family Fun',color:'#1d4ed8',icon:'👨‍👩‍👧',category:'entertainment'},{id:'v4',name:'Nightlife',color:'#3b0764',icon:'🎶',category:'bar'},{id:'v5',name:'Art Scene',color:'#7c2d12',icon:'🎨',category:'arts'},{id:'v6',name:'Coffee',color:'#78350f',icon:'☕',category:'coffee'}],
  sections:{thisWeek:true,nearYou:true,vibes:true,featured:true},
};
function ContentSection() {
  const [cfg, setCfg]   = useState<ContentCfg>(DEF_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editVibe, setEditVibe] = useState<ContentCfg['vibes'][0]|null>(null);
  useEffect(() => { cfgGet('content').then(v=>{ if(v) setCfg({...DEF_CONTENT,...v}); setLoading(false); }); }, []);
  const save = async () => { setSaving(true); await cfgSet('content',cfg); setSaving(false); toast('Saved ✓'); };
  if (loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;
  return (
    <div>
      <SectionHeader title="Content Sections" sub="Edit hero copy, vibes, section visibility" />
      <div style={{...card,marginBottom:18}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Hero Taglines</h3>
        <p style={{fontSize:12,color:'#9ca3af',marginBottom:10}}>One phrase per line. App randomly picks from these.</p>
        <textarea value={cfg.heroLines.join('\n')} onChange={e=>setCfg(c=>({...c,heroLines:e.target.value.split('\n').filter(Boolean)}))} rows={6} style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:14}} />
      </div>
      <div style={{...card,marginBottom:18}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Daily Gem / Sunday's Spot</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={lbl}>Title</label><input value={cfg.dailyGem.title} onChange={e=>setCfg(c=>({...c,dailyGem:{...c.dailyGem,title:e.target.value}}))} style={inp} /></div>
          <div><label style={lbl}>Subtitle</label><input value={cfg.dailyGem.subtitle} onChange={e=>setCfg(c=>({...c,dailyGem:{...c.dailyGem,subtitle:e.target.value}}))} style={inp} /></div>
          <div style={{gridColumn:'1/-1'}}><label style={lbl}>Place ID (blank = auto)</label><input value={cfg.dailyGem.placeId} onChange={e=>setCfg(c=>({...c,dailyGem:{...c.dailyGem,placeId:e.target.value}}))} style={inp} placeholder="ChIJ…" /></div>
        </div>
      </div>
      <div style={{...card,marginBottom:18}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <h3 style={{fontSize:15,fontWeight:700}}>Explore by Vibe</h3>
          <button style={btnS} onClick={()=>setEditVibe({id:Date.now().toString(),name:'',color:'#1d4ed8',icon:'📍',category:'other'})}>+ Add</button>
        </div>
        {editVibe&&(
          <div style={{border:`1px solid ${ACCENT}`,borderRadius:10,padding:14,marginBottom:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 70px 110px 1fr',gap:10}}>
              <div><label style={lbl}>Name</label><input value={editVibe.name} onChange={e=>setEditVibe(v=>v&&{...v,name:e.target.value})} style={inp} /></div>
              <div><label style={lbl}>Icon</label><input value={editVibe.icon} onChange={e=>setEditVibe(v=>v&&{...v,icon:e.target.value})} style={inp} /></div>
              <div><label style={lbl}>Color</label><input type="color" value={editVibe.color} onChange={e=>setEditVibe(v=>v&&{...v,color:e.target.value})} style={{...inp,padding:4,height:38}} /></div>
              <div><label style={lbl}>Category</label><select value={editVibe.category} onChange={e=>setEditVibe(v=>v&&{...v,category:e.target.value})} style={inp}>{PLACE_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10}}>
              <button style={btnS} onClick={()=>setEditVibe(null)}>Cancel</button>
              <button style={btnP} onClick={()=>{ if(!editVibe.name){toast('Name required','err');return;} const exists=cfg.vibes.find(v=>v.id===editVibe.id); const upd=exists?cfg.vibes.map(v=>v.id===editVibe.id?editVibe:v):[...cfg.vibes,editVibe]; setCfg(c=>({...c,vibes:upd})); setEditVibe(null); }}>Save</button>
            </div>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
          {cfg.vibes.map(v=>(
            <div key={v.id} style={{background:v.color,borderRadius:10,padding:'12px 14px',display:'flex',alignItems:'center',gap:8,position:'relative'}}>
              <span style={{fontSize:20}}>{v.icon}</span><span style={{color:'#fff',fontWeight:800,fontSize:13}}>{v.name}</span>
              <div style={{position:'absolute',top:4,right:4,display:'flex',gap:3}}>
                <button onClick={()=>setEditVibe({...v})} style={{padding:'2px 5px',fontSize:10,borderRadius:4,border:'none',background:'rgba(255,255,255,0.3)',color:'#fff',cursor:'pointer'}}>✏</button>
                <button onClick={()=>setCfg(c=>({...c,vibes:c.vibes.filter(x=>x.id!==v.id)}))} style={{padding:'2px 5px',fontSize:10,borderRadius:4,border:'none',background:'rgba(220,38,38,0.5)',color:'#fff',cursor:'pointer'}}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{...card,marginBottom:18}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Section Visibility</h3>
        {Object.entries({thisWeek:'Events This Week',nearYou:'Near You',vibes:'Explore by Vibe',featured:'Featured Places'}).map(([key,label])=>(
          <label key={key} style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer',fontSize:14,marginBottom:12}}>
            <div onClick={()=>setCfg(c=>({...c,sections:{...c.sections,[key]:!c.sections[key]}}))} style={{width:40,height:22,borderRadius:11,background:cfg.sections[key]!==false?'#059669':'#d1d5db',position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,left:cfg.sections[key]!==false?20:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}} />
            </div>
            <span style={{fontWeight:600}}>{label}</span>
            <span style={{color:'#9ca3af',fontSize:12}}>{cfg.sections[key]!==false?'Visible':'Hidden'}</span>
          </label>
        ))}
      </div>
      <button style={{...btnP,opacity:saving?0.7:1}} onClick={save} disabled={saving}>{saving?'Saving…':'Save All Content'}</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsSection() {
  const [range, setRange]       = useState<'7d'|'30d'|'90d'>('7d');
  const [loading, setLoading]   = useState(true);
  const [totals,  setTotals]    = useState<Record<string,number>>({});
  const [topEvents, setTopEvents] = useState<{name:string;count:number}[]>([]);
  const [topPlaces, setTopPlaces] = useState<{name:string;count:number}[]>([]);
  const [topSearches,setTopSearches]=useState<{query:string;count:number}[]>([]);
  const [deviceBreakdown,setDeviceBreakdown]=useState<{device:string;count:number}[]>([]);
  const [dailyActive,setDailyActive]=useState<{day:string;sessions:number}[]>([]);
  const [sectionEngagement,setSectionEngagement]=useState<{tab:string;count:number}[]>([]);

  const days = range==='7d'?7:range==='30d'?30:90;
  const since = new Date(Date.now()-days*86400000).toISOString();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: allRows } = await sb('analytics').select('event_type,session_id,data,device,created_at').gte('created_at',since);
      const rows = allRows || [];

      // Totals by event_type
      const typeCount: Record<string,number> = {};
      for (const r of rows) typeCount[r.event_type] = (typeCount[r.event_type]||0)+1;
      setTotals(typeCount);

      // Unique sessions
      const uniqueSessions = new Set(rows.filter(r=>r.session_id).map((r:any)=>r.session_id)).size;
      typeCount['_unique_sessions'] = uniqueSessions;

      // Top events
      const evCounts: Record<string,number> = {};
      rows.filter(r=>r.event_type==='event_click').forEach((r:any)=>{ const n=r.data?.name||r.data?.event_id||'Unknown'; evCounts[n]=(evCounts[n]||0)+1; });
      setTopEvents(Object.entries(evCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count})));

      // Top places
      const plCounts: Record<string,number> = {};
      rows.filter(r=>r.event_type==='place_click').forEach((r:any)=>{ const n=r.data?.name||r.data?.place_id||'Unknown'; plCounts[n]=(plCounts[n]||0)+1; });
      setTopPlaces(Object.entries(plCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count})));

      // Top searches
      const qCounts: Record<string,number> = {};
      rows.filter(r=>r.event_type==='search').forEach((r:any)=>{ const q=(r.data?.query||'').toLowerCase().trim(); if(q) qCounts[q]=(qCounts[q]||0)+1; });
      setTopSearches(Object.entries(qCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([query,count])=>({query,count})));

      // Device breakdown
      const devCounts: Record<string,number> = {};
      rows.forEach((r:any)=>{ const d=r.device||'unknown'; devCounts[d]=(devCounts[d]||0)+1; });
      setDeviceBreakdown(Object.entries(devCounts).map(([device,count])=>({device,count})).sort((a,b)=>b.count-a.count));

      // Section engagement (pageview tab clicks)
      const tabCounts: Record<string,number> = {};
      rows.filter(r=>r.event_type==='pageview').forEach((r:any)=>{ const t=r.data?.tab||'unknown'; tabCounts[t]=(tabCounts[t]||0)+1; });
      setSectionEngagement(Object.entries(tabCounts).map(([tab,count])=>({tab,count})).sort((a,b)=>b.count-a.count));

      // Daily active sessions (unique sessions per day)
      const daySessions: Record<string,Set<string>> = {};
      rows.filter(r=>r.session_id).forEach((r:any)=>{ const day=r.created_at.split('T')[0]; if(!daySessions[day]) daySessions[day]=new Set(); daySessions[day].add(r.session_id); });
      setDailyActive(Object.entries(daySessions).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,s])=>({day,sessions:s.size})));

      setTotals(typeCount);
      setLoading(false);
    }
    load();
  }, [range, since]);

  const maxDA = Math.max(...dailyActive.map(d=>d.sessions),1);
  const maxSE = Math.max(...sectionEngagement.map(d=>d.count),1);
  const maxTP = Math.max(...topPlaces.map(d=>d.count),1);
  const maxTE = Math.max(...topEvents.map(d=>d.count),1);

  const statCard = (label:string,val:number,icon:string,color:string) => (
    <div style={{...card,padding:'18px 20px'}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,letterSpacing:'-0.5px'}}>{val.toLocaleString()}</div>
      <div style={{fontSize:12,color:'#9ca3af',fontWeight:600,marginTop:3}}>{label}</div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Analytics" sub={`User behavior — last ${days} days`} action={
        <div style={{display:'flex',gap:4}}>
          {(['7d','30d','90d'] as const).map(r=><button key={r} onClick={()=>setRange(r)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:12,fontWeight:range===r?700:400,background:range===r?ACCENT:'#f3f4f6',color:range===r?'#fff':'#374151'}}>{r}</button>)}
        </div>
      } />

      {loading ? <p style={{textAlign:'center',color:'#9ca3af',padding:48}}>Loading analytics…</p> : (
        <>
          {/* Stat cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:14,marginBottom:28}}>
            {statCard('Unique Sessions',   totals._unique_sessions||0, '👤','#8B3A0F')}
            {statCard('Page Views',        totals.pageview||0,         '📄','#1d4ed8')}
            {statCard('Event Clicks',      totals.event_click||0,      '🎫','#059669')}
            {statCard('Place Clicks',      totals.place_click||0,      '📍','#7c3aed')}
            {statCard('Searches',          totals.search||0,           '🔍','#b45309')}
            {statCard('Check-ins',         totals.checkin||0,          '✅','#0891b2')}
            {statCard('A2HS Shown',        totals.a2hs_shown||0,       '📲','#9333ea')}
            {statCard('A2HS Accepted',     totals.a2hs_accepted||0,    '🏠','#059669')}
          </div>

          {/* A2HS conversion */}
          {(totals.a2hs_shown||0)>0 && (
            <div style={{...card,marginBottom:20,background:'#f0fdf4',borderColor:'#bbf7d0'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#14532d'}}>📲 Add to Home Screen conversion: </span>
              <span style={{fontSize:16,fontWeight:800,color:'#059669'}}>
                {Math.round(((totals.a2hs_accepted||0)/(totals.a2hs_shown||1))*100)}%
              </span>
              <span style={{fontSize:13,color:'#6b7280',marginLeft:8}}>({totals.a2hs_accepted||0} accepted of {totals.a2hs_shown||0} shown)</span>
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(380px,1fr))',gap:20,marginBottom:20}}>
            {/* Daily active users chart */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Daily Active Sessions</h3>
              {!dailyActive.length ? <p style={{color:'#9ca3af',fontSize:13}}>No data yet.</p> : (
                <div style={{display:'flex',alignItems:'flex-end',gap:3,height:80}}>
                  {dailyActive.map(d=>(
                    <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      <div style={{width:'100%',background:ACCENT,borderRadius:3,height:Math.max(4,Math.round((d.sessions/maxDA)*68))}} title={`${d.day}: ${d.sessions} sessions`} />
                      <div style={{fontSize:9,color:'#9ca3af',transform:'rotate(-45deg)',transformOrigin:'top left',whiteSpace:'nowrap',marginTop:6}}>{d.day.slice(5)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section engagement */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Section Engagement</h3>
              {!sectionEngagement.length ? <p style={{color:'#9ca3af',fontSize:13}}>No data yet.</p> : sectionEngagement.map(d=>(
                <div key={d.tab} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:80,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{d.tab}</div>
                  <div style={{flex:1,background:'#f3f4f6',borderRadius:4,height:16,overflow:'hidden'}}>
                    <div style={{width:`${Math.round((d.count/maxSE)*100)}%`,height:'100%',background:ACCENT,borderRadius:4}} />
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',width:40,textAlign:'right'}}>{d.count}</div>
                </div>
              ))}
            </div>

            {/* Device breakdown */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Device Breakdown</h3>
              {!deviceBreakdown.length ? <p style={{color:'#9ca3af',fontSize:13}}>No data yet.</p> : deviceBreakdown.map(d=>(
                <div key={d.device} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{fontSize:18}}>{d.device==='ios'?'🍎':d.device==='android'?'🤖':d.device==='desktop'?'🖥️':'❓'}</div>
                  <div style={{width:70,fontSize:12,fontWeight:600,textTransform:'capitalize'}}>{d.device}</div>
                  <div style={{flex:1,background:'#f3f4f6',borderRadius:4,height:16,overflow:'hidden'}}>
                    <div style={{width:`${Math.round((d.count/Math.max(...deviceBreakdown.map(x=>x.count)))*100)}%`,height:'100%',background:'#1d4ed8',borderRadius:4}} />
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',width:40,textAlign:'right'}}>{d.count}</div>
                </div>
              ))}
            </div>

            {/* Top searches */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Top Search Terms</h3>
              {!topSearches.length ? <p style={{color:'#9ca3af',fontSize:13}}>No searches yet.</p> : (
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {topSearches.map((s,i)=>(
                    <span key={s.query} style={{padding:'5px 12px',borderRadius:999,fontSize:12,fontWeight:700,background:`rgba(139,58,15,${0.15+i*0.05})`,color:ACCENT}}>
                      {s.query} <span style={{fontSize:10,opacity:0.7}}>×{s.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            {/* Top events */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Most Clicked Events</h3>
              {!topEvents.length ? <p style={{color:'#9ca3af',fontSize:13}}>No clicks yet.</p> : topEvents.map((e,i)=>(
                <div key={e.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:20,fontSize:11,fontWeight:700,color:'#9ca3af',textAlign:'right'}}>{i+1}</div>
                  <div style={{flex:1,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
                  <div style={{flex:0,background:'#f3f4f6',borderRadius:4,width:80,height:14,overflow:'hidden'}}>
                    <div style={{width:`${Math.round((e.count/maxTE)*100)}%`,height:'100%',background:'#059669'}} />
                  </div>
                  <div style={{fontSize:12,fontWeight:700,width:28,textAlign:'right'}}>{e.count}</div>
                </div>
              ))}
            </div>

            {/* Top places */}
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Most Clicked Places</h3>
              {!topPlaces.length ? <p style={{color:'#9ca3af',fontSize:13}}>No clicks yet.</p> : topPlaces.map((p,i)=>(
                <div key={p.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                  <div style={{width:20,fontSize:11,fontWeight:700,color:'#9ca3af',textAlign:'right'}}>{i+1}</div>
                  <div style={{flex:1,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                  <div style={{flex:0,background:'#f3f4f6',borderRadius:4,width:80,height:14,overflow:'hidden'}}>
                    <div style={{width:`${Math.round((p.count/maxTP)*100)}%`,height:'100%',background:'#1d4ed8'}} />
                  </div>
                  <div style={{fontSize:12,fontWeight:700,width:28,textAlign:'right'}}>{p.count}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA REFRESH
// ─────────────────────────────────────────────────────────────────────────────
function RefreshSection() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs]       = useState<any[]>([]);
  const [lastRun, setLastRun] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { cfgGet('refreshLog').then(v=>{ if(v?.logs) setLogs(v.logs); if(v?.lastRun) setLastRun(v.lastRun); setLoading(false); }); }, []);
  const run = async () => {
    setRunning(true); toast('Checking…','info');
    const {count:before}=await sb('events').select('id',{count:'exact',head:true});
    const nowStr=new Date().toISOString();
    const {count:after}=await sb('events').select('id',{count:'exact',head:true});
    const log={timestamp:nowStr,status:'success',before:before??0,after:after??0,message:`${after} events in DB.`};
    const nl=[log,...logs.slice(0,9)]; setLogs(nl); setLastRun(nowStr);
    await cfgSet('refreshLog',{lastRun:nowStr,logs:nl});
    toast(`${after} events in DB ✓`); setRunning(false);
  };
  return (
    <div>
      <SectionHeader title="Data Refresh" sub="Event data from Ticketmaster and other sources" />
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:18,marginBottom:24}}>
        <div style={card}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:10}}>Manual Check</h3>
          {lastRun&&<p style={{fontSize:12,color:'#9ca3af',marginBottom:12}}>Last run: {new Date(lastRun).toLocaleString()}</p>}
          <button style={{...btnP,opacity:running?0.7:1,display:'flex',alignItems:'center',gap:8}} onClick={run} disabled={running}>
            <span style={{display:'inline-block',animation:running?'spin 1s linear infinite':'none'}}>🔄</span>{running?'Checking…':'Check Event Count'}
          </button>
        </div>
        <div style={{...card,background:'#f0fdf4',borderColor:'#bbf7d0'}}>
          <h3 style={{fontSize:14,fontWeight:700,color:'#14532d',marginBottom:10}}>Edge Functions</h3>
          {['fetch-tm-events','fetch-seatgeek','refresh-places'].map(fn=><div key={fn} style={{background:'#fff',borderRadius:6,padding:'6px 12px',fontSize:12,fontFamily:'monospace',color:'#166534',border:'1px solid #bbf7d0',marginBottom:6}}>{fn}</div>)}
        </div>
      </div>
      <div style={card}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Refresh Log</h3>
        {loading?<p style={{color:'#9ca3af'}}>Loading…</p>:!logs.length?<p style={{color:'#9ca3af',textAlign:'center',padding:28}}>No runs yet.</p>:(
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr><th style={th}>Timestamp</th><th style={th}>Status</th><th style={th}>Before</th><th style={th}>After</th><th style={th}>Note</th></tr></thead>
            <tbody>{logs.map((l,i)=>(
              <tr key={i}>
                <td style={{...td,whiteSpace:'nowrap',fontSize:12}}>{new Date(l.timestamp).toLocaleString()}</td>
                <td style={td}><span style={{fontSize:11,fontWeight:700,color:l.status==='success'?'#059669':'#dc2626',background:l.status==='success'?'#d1fae5':'#fee2e2',padding:'2px 7px',borderRadius:4}}>{l.status}</span></td>
                <td style={{...td,textAlign:'center'}}>{l.before}</td>
                <td style={{...td,textAlign:'center'}}>{l.after}</td>
                <td style={{...td,fontSize:12,color:'#6b7280'}}>{l.message}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS  (schema: id uuid, user_id, place_id, rating, text, created_at, flagged)
// ─────────────────────────────────────────────────────────────────────────────
function ReviewsSection() {
  const [rows,setRows]=useState<any[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [confirm,setConfirm]=useState<string|null>(null);
  const load = useCallback(async()=>{
    setLoading(true);
    let q=sb('reviews').select('*',{count:'exact'}).order('created_at',{ascending:false});
    if(search) q=q.ilike('text',`%${search}%`);
    q=q.range(page*PAGE,(page+1)*PAGE-1);
    const {data,count}=await q; setRows(data||[]); setTotal(count??0); setLoading(false);
  },[search,page]);
  useEffect(()=>{load();},[load]);
  const del  = async(id:string)=>{await sb('reviews').delete().eq('id',id);toast('Deleted');setConfirm(null);load();};
  const flag = async(r:any)=>{await sb('reviews').update({flagged:!r.flagged}).eq('id',r.id);toast(r.flagged?'Unflagged':'Flagged');load();};
  const stars=(n:number)=>'★'.repeat(Math.min(5,Math.max(0,n||0)))+'☆'.repeat(5-Math.min(5,Math.max(0,n||0)));
  return (
    <div>
      <SectionHeader title="Reviews Moderation" sub={`${total} total reviews`} />
      <div style={{marginBottom:14}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search review text…" style={{...inp,width:320}} />
      </div>
      <div style={{...card,padding:0,overflow:'hidden'}}>
        {loading?<p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>:(
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr><th style={th}>Rating</th><th style={th}>Review</th><th style={th}>User</th><th style={th}>Date</th><th style={th}>Actions</th></tr></thead>
              <tbody>{rows.map(r=>(
                <tr key={r.id} style={{background:r.flagged?'#fef2f2':'white'}}>
                  <td style={{...td,color:'#f59e0b',whiteSpace:'nowrap'}}>{stars(r.rating||0)}</td>
                  <td style={{...td,maxWidth:320}}><div style={{maxHeight:48,overflow:'hidden',lineHeight:1.5}}>{r.text}</div>{r.flagged&&<span style={{fontSize:10,background:'#dc2626',color:'#fff',padding:'1px 5px',borderRadius:3,fontWeight:700}}>FLAGGED</span>}</td>
                  <td style={{...td,fontSize:11,fontFamily:'monospace',color:'#9ca3af',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>{r.user_id?.slice(0,8)||'anon'}</td>
                  <td style={{...td,whiteSpace:'nowrap',fontSize:12}}>{r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</td>
                  <td style={td}><div style={{display:'flex',gap:6}}>
                    <button onClick={()=>flag(r)} style={{...btnS,fontSize:11,padding:'3px 8px',color:r.flagged?'#dc2626':'#6b7280'}}>{r.flagged?'Unflag':'Flag'}</button>
                    <button onClick={()=>setConfirm(r.id)} style={btnD}>Del</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {!rows.length&&<p style={{textAlign:'center',color:'#9ca3af',padding:40}}>No reviews{search?' matching search':''}.</p>}
          </div>
        )}
      </div>
      {total>PAGE&&<div style={{display:'flex',justifyContent:'space-between',marginTop:14}}>
        <span style={{fontSize:13,color:'#9ca3af'}}>{page*PAGE+1}–{Math.min((page+1)*PAGE,total)} of {total}</span>
        <div style={{display:'flex',gap:8}}>
          <button style={{...btnS,opacity:page===0?0.4:1}} onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>← Prev</button>
          <button style={{...btnS,opacity:(page+1)*PAGE>=total?0.4:1}} onClick={()=>setPage(p=>p+1)} disabled={(page+1)*PAGE>=total}>Next →</button>
        </div>
      </div>}
      {confirm&&<Confirm msg="Delete this review permanently?" onOk={()=>del(confirm)} onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG RULES
// ─────────────────────────────────────────────────────────────────────────────
const DEF_RULES: TagRulesConfig = {
  outdoorKeywords:['outdoor','amphitheater','park','field','arena','stadium','garden','trail','wilderness','lake','river','mountain'],
  indoorKeywords:['theater','theatre','cinema','gallery','museum','hall','auditorium','studio','lounge'],
  categoryKeywords:{'family-friendly':['family','kids','children','youth','junior'],'live-music':['music','concert','band','jazz','blues','rock','symphony'],'arts':['art','gallery','museum','exhibit','artist'],'sports':['sport','game','match','tournament','league'],'food':['food','dining','restaurant','chef','culinary','tasting'],'festival':['festival','fair','carnival','fiesta','celebration'],'nightlife':['bar','club','lounge','cocktail','nightlife']},
};
function TagRulesSection() {
  const [rules,setRules]=useState<TagRulesConfig>(DEF_RULES);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{cfgGet('tagRules').then(v=>{if(v) setRules({...DEF_RULES,...v}); setLoading(false);});},[]);
  const save=async()=>{setSaving(true);await cfgSet('tagRules',rules);toast('Saved ✓ — reload app to apply');setSaving(false);};
  if(loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;
  return (
    <div>
      <SectionHeader title="Tag Detection Rules" sub="Keywords matched against event/venue names" action={<button style={{...btnP,opacity:saving?0.7:1}} onClick={save} disabled={saving}>{saving?'Saving…':'Save Rules'}</button>} />
      {(['outdoor','indoor'] as const).map(type=>(
        <div key={type} style={{...card,marginBottom:12}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:8,textTransform:'capitalize'}}>{type} Keywords</h3>
          <textarea value={(rules as any)[type+'Keywords'].join(', ')} onChange={e=>setRules(r=>({...r,[type+'Keywords']:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}))} rows={3} style={{...inp,fontFamily:'monospace',fontSize:13,resize:'vertical'}} />
        </div>
      ))}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <h3 style={{fontSize:14,fontWeight:700}}>Category Keywords</h3>
        <button style={btnS} onClick={()=>{const n=prompt('New tag name:');if(n?.trim()) setRules(r=>({...r,categoryKeywords:{...r.categoryKeywords,[n.trim()]:[]}}));}}>+ Add</button>
      </div>
      {Object.entries(rules.categoryKeywords).map(([cat,kws])=>(
        <div key={cat} style={{...card,marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><h4 style={{fontSize:13,fontWeight:700,flex:1}}>{cat}</h4><button style={btnD} onClick={()=>setRules(r=>{const k={...r.categoryKeywords};delete k[cat];return{...r,categoryKeywords:k};})}>Remove</button></div>
          <input value={kws.join(', ')} onChange={e=>setRules(r=>({...r,categoryKeywords:{...r.categoryKeywords,[cat]:e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)}}))} style={{...inp,fontFamily:'monospace',fontSize:13}} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
function SettingsSection() {
  const [msg,setMsg]=useState('');
  const [type,setType]=useState<'info'|'success'|'warning'>('info');
  const [active,setActive]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{cfgGet('siteConfig').then(v=>{if(v){setMsg(v.banner?.message||'');setActive(v.banner?.active??false);setType(v.banner?.type||'info');}setLoading(false);});},[]);
  const save=async()=>{setSaving(true);await cfgSet('siteConfig',{banner:{message:msg,active,type}});toast('Saved ✓');setSaving(false);};
  if(loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;
  return (
    <div>
      <SectionHeader title="Settings" sub="General site configuration" />
      <div style={{...card,maxWidth:520}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Legacy Site Banner</h3>
        <p style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>Single banner (use the Banners section for multi-banner management).</p>
        <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontSize:14,fontWeight:600,marginBottom:14}}>
          <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} style={{width:18,height:18}} /> Show banner to users
        </label>
        <div style={{marginBottom:12}}><label style={lbl}>Message</label><textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3} style={{...inp,resize:'vertical'}} /></div>
        <div style={{marginBottom:18}}><label style={lbl}>Type</label>
          <select value={type} onChange={e=>setType(e.target.value as any)} style={inp}>
            <option value="info">ℹ️ Info</option><option value="success">✅ Success</option><option value="warning">⚠️ Warning</option>
          </select></div>
        {msg&&<div style={{marginBottom:14,padding:'10px 14px',borderRadius:8,background:type==='warning'?'#fef3c7':type==='success'?'#d1fae5':'#dbeafe',fontSize:13,fontWeight:600,color:type==='warning'?'#92400e':type==='success'?'#065f46':'#1e40af'}}>{msg}</div>}
        <button style={{...btnP,opacity:saving?0.7:1}} onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR NAV
// ─────────────────────────────────────────────────────────────────────────────
const NAV: {id:AdminSection;label:string;icon:string;group:string}[] = [
  {id:'dashboard', label:'Dashboard',        icon:'◼',  group:'Overview'},
  {id:'analytics', label:'Analytics',        icon:'📊', group:'Overview'},
  {id:'banners',   label:'Banners',          icon:'📢', group:'Content'},
  {id:'events',    label:'Events',           icon:'🎫', group:'Content'},
  {id:'places',    label:'Places',           icon:'📍', group:'Content'},
  {id:'categories',label:'Categories',       icon:'🏷️', group:'Content'},
  {id:'content',   label:'Content Sections', icon:'✏️', group:'Content'},
  {id:'reviews',   label:'Reviews',          icon:'⭐', group:'Content'},
  {id:'refresh',   label:'Data Refresh',     icon:'🔄', group:'Tools'},
  {id:'tagrules',  label:'Tag Rules',        icon:'🔖', group:'Tools'},
  {id:'settings',  label:'Settings',         icon:'⚙️', group:'Tools'},
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AdminPanel
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPanel({ user, onBack }: { user: User|null; onBack: ()=>void }) {
  const [section,  setSection]  = useState<AdminSection>('dashboard');
  const [pwInput,  setPwInput]  = useState('');
  const [pwError,  setPwError]  = useState('');
  const [sideOpen, setSideOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [pwUnlocked, setPwUnlocked] = useState(() => {
    try { return Date.now() < parseInt(localStorage.getItem(PW_EXP_KEY)||'0'); } catch { return false; }
  });

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h); return () => window.removeEventListener('resize', h);
  }, []);

  const isAuth = pwUnlocked || user?.email === ADMIN_EMAIL;

  const tryPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PW) {
      localStorage.setItem(PW_EXP_KEY, String(Date.now()+PW_TTL));
      setPwUnlocked(true); setPwError('');
    } else { setPwError('Incorrect password.'); setTimeout(()=>setPwError(''),3000); }
  };

  const logout = () => { localStorage.removeItem(PW_EXP_KEY); setPwUnlocked(false); };

  const navTo = (s: AdminSection) => { setSection(s); if(isMobile) setSideOpen(false); };

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!isAuth) return (
    <div style={{minHeight:'100vh',background:SIDEBAR_BG,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{background:'#fff',borderRadius:18,padding:36,maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{width:52,height:52,borderRadius:14,background:ACCENT,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',fontSize:24}}>🔐</div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#18181b',margin:0}}>Admin Access</h1>
          <p style={{fontSize:13,color:'#9ca3af',marginTop:6}}>ABQ Unplugged Admin Panel</p>
        </div>
        <form onSubmit={tryPw}>
          <label style={{...lbl,marginBottom:6}}>Password</label>
          <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} style={{...inp,marginBottom:14,fontSize:15}} autoFocus placeholder="Admin password" />
          {pwError&&<div style={{background:'#fee2e2',color:'#dc2626',borderRadius:8,padding:'8px 12px',fontSize:13,marginBottom:12,fontWeight:600}}>{pwError}</div>}
          <button type="submit" style={{...btnP,width:'100%',padding:'12px',fontSize:15}}>Sign In</button>
        </form>
        <button onClick={onBack} style={{marginTop:14,width:'100%',background:'none',border:'none',color:'#9ca3af',cursor:'pointer',fontSize:13,padding:'8px'}}>← Back to App</button>
      </div>
    </div>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  const groups = [...new Set(NAV.map(n=>n.group))];
  const sidebarStyle: React.CSSProperties = isMobile
    ? { position:'fixed', inset:'0 auto 0 0', width:SIDEBAR_W, background:SIDEBAR_BG, zIndex:200, transform:sideOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.25s ease', display:'flex', flexDirection:'column', height:'100vh', overflowY:'auto' }
    : { width:SIDEBAR_W, flexShrink:0, background:SIDEBAR_BG, display:'flex', flexDirection:'column', minHeight:'100vh', position:'sticky', top:0, height:'100vh', overflowY:'auto' };

  return (
    <div style={{display:'flex',minHeight:'100vh',background:'#f4f4f5'}}>
      <style>{`
        @keyframes fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .anb:hover{background:rgba(255,255,255,0.08)!important}
      `}</style>
      <Toaster />

      {/* Mobile overlay */}
      {isMobile && sideOpen && <div onClick={()=>setSideOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:199}} />}

      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{padding:'20px 16px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:'#fff',letterSpacing:'0.05em',textTransform:'uppercase'}}>ABQ Unplugged</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:2}}>Admin Panel</div>
          </div>
          {isMobile&&<button onClick={()=>setSideOpen(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:20,padding:'0 4px'}}>×</button>}
        </div>
        <nav style={{flex:1,padding:'10px 8px'}}>
          {groups.map(group=>(
            <div key={group} style={{marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.1em',padding:'0 10px',marginBottom:4}}>{group}</div>
              {NAV.filter(n=>n.group===group).map(n=>(
                <button key={n.id} className="anb" onClick={()=>navTo(n.id)} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'9px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:section===n.id?700:400,background:section===n.id?ACCENT:'transparent',color:section===n.id?'#fff':'rgba(255,255,255,0.7)',transition:'background 0.15s',textAlign:'left'}}>
                  <span style={{fontSize:15}}>{n.icon}</span>{n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{padding:'10px 10px 16px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          {user?.email&&<div style={{fontSize:11,color:'rgba(255,255,255,0.35)',padding:'0 8px',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>}
          <div style={{display:'flex',gap:6}}>
            <button onClick={onBack} style={{flex:1,padding:'8px',borderRadius:8,border:'none',background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.8)',cursor:'pointer',fontSize:12,fontWeight:600}}>← App</button>
            {pwUnlocked&&<button onClick={logout} style={{padding:'8px 10px',borderRadius:8,border:'none',background:'rgba(220,38,38,0.2)',color:'#fca5a5',cursor:'pointer',fontSize:12,fontWeight:600}}>Logout</button>}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,overflowY:'auto',maxHeight:isMobile?'100vh':'100vh'}}>
        {/* Mobile header */}
        {isMobile&&(
          <div style={{position:'sticky',top:0,background:SIDEBAR_BG,color:'#fff',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,zIndex:100}}>
            <button onClick={()=>setSideOpen(true)} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1}}>☰</button>
            <div style={{fontWeight:700,fontSize:15}}>ABQ Admin — {NAV.find(n=>n.id===section)?.label}</div>
          </div>
        )}
        <div style={{maxWidth:1100,margin:'0 auto',padding:isMobile?'20px 16px':'32px 36px'}}>
          {section==='dashboard'  && <DashboardSection onNav={setSection} />}
          {section==='analytics'  && <AnalyticsSection />}
          {section==='banners'    && <BannersSection />}
          {section==='events'     && <EventsSection />}
          {section==='places'     && <PlacesSection />}
          {section==='categories' && <CategoriesSection />}
          {section==='content'    && <ContentSection />}
          {section==='reviews'    && <ReviewsSection />}
          {section==='refresh'    && <RefreshSection />}
          {section==='tagrules'   && <TagRulesSection />}
          {section==='settings'   && <SettingsSection />}
        </div>
      </div>
    </div>
  );
}
