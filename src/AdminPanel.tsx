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
  | 'analytics' | 'tagrules' | 'settings' | 'theme' | 'feedback' | 'bulkimport';

interface Banner {
  id: string; message: string; type: 'info'|'warning'|'promo';
  startDate: string; endDate: string; linkUrl: string; linkText: string; active: boolean;
  bgColor?: string; textColor?: string;
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

// ─── Admin Error Boundary ────────────────────────────────────────────────────
class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode; section?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error(`[Admin${this.props.section ? ` ${this.props.section}` : ''}] Error:`, e, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ ...card, background: '#fef2f2', borderColor: '#fecaca', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Something went wrong</h3>
          <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 16, lineHeight: 1.5 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ ...btnP, background: '#dc2626' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
      try {
        const [evR, plR, rvR, anR, cfg, rlog] = await Promise.all([
          sb('events').select('id',{count:'exact',head:true}).eq('hidden',false),
          sb('places').select('id',{count:'exact',head:true}).eq('hidden',false),
          sb('reviews').select('id',{count:'exact',head:true}),
          sb('analytics').select('id',{count:'exact',head:true}),
          cfgGet('banners'),
          cfgGet('refreshLog'),
        ]);
        const bannerList = Array.isArray(cfg) ? cfg : [];
        setStats({ events:evR.count??0, places:plR.count??0, banners:bannerList.filter((b:Banner)=>b.active).length, reviews:rvR.count??0, analytics:anR.count??0 });
        if (rlog?.lastRun) setLastRefresh(rlog.lastRun);
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
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
            {([['+ Add Event','events',ACCENT],['+ Add Place','places','#1d4ed8'],['📢 New Banner','banners','#059669'],['💬 Feedback','feedback','#0891b2'],['📊 Analytics','analytics','#7c3aed'],['🔄 Data Refresh','refresh','#6b7280']] as [string,AdminSection,string][]).map(([label,sec,color])=>(
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
const EMPTY_B: Banner = { id:'', message:'', type:'info', startDate:'', endDate:'', linkUrl:'', linkText:'', active:false, bgColor:'', textColor:'' };
function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<Banner|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string|null>(null);
  useEffect(() => { cfgGet('banners').then(v => { setBanners(Array.isArray(v)?v:[]); setLoading(false); }).catch(() => setLoading(false)); }, []);
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
  const pvStyle = (b:Banner): React.CSSProperties => {
    if (b.bgColor) return { padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600, background:b.bgColor, color:b.textColor||'#ffffff', border:`1px solid ${b.bgColor}` };
    return { padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600,
      background:b.type==='warning'?'#fef3c7':b.type==='promo'?'#fce7f3':'#dbeafe',
      color:b.type==='warning'?'#92400e':b.type==='promo'?'#9d174d':'#1e40af',
      border:`1px solid ${b.type==='warning'?'#fcd34d':b.type==='promo'?'#fbcfe8':'#bfdbfe'}`,
    };
  };
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
                <div>
                  <label style={lbl}>Background Color <span style={{color:'#9ca3af',fontWeight:400}}>(optional — overrides type)</span></label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="color" value={editing.bgColor||'#1ebaeb'} onChange={e=>setEditing(v=>v&&{...v,bgColor:e.target.value})}
                      style={{width:44,height:36,border:'1px solid #d1d5db',borderRadius:6,cursor:'pointer',padding:2}} />
                    <input value={editing.bgColor||''} onChange={e=>setEditing(v=>v&&{...v,bgColor:e.target.value})}
                      placeholder="#hex or empty for type default" style={{...inp,flex:1,marginBottom:0}} />
                    {editing.bgColor && <button onClick={()=>setEditing(v=>v&&{...v,bgColor:'',textColor:''})} style={{fontSize:11,color:'#9ca3af',cursor:'pointer',background:'none',border:'none',padding:'0 2px'}}>✕ clear</button>}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Text Color <span style={{color:'#9ca3af',fontWeight:400}}>(optional)</span></label>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="color" value={editing.textColor||'#1A1A1A'} onChange={e=>setEditing(v=>v&&{...v,textColor:e.target.value})}
                      style={{width:44,height:36,border:'1px solid #d1d5db',borderRadius:6,cursor:'pointer',padding:2}} />
                    <input value={editing.textColor||''} onChange={e=>setEditing(v=>v&&{...v,textColor:e.target.value})}
                      placeholder="#hex or empty" style={{...inp,flex:1,marginBottom:0}} />
                  </div>
                </div>
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
  const [editEvent, setEditEvent] = useState<any|null>(null);
  const [editForm, setEditForm]   = useState({ name:'', date:'', time:'', venue:'' });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = sb('events').select('id,source,event_date,hidden,featured,raw', {count:'exact'}).order('event_date',{ascending:true});
      if (search)    q = q.ilike('raw->>name', `%${search}%`);
      if (filterSrc) q = q.eq('source', filterSrc);
      q = q.range(page*PAGE,(page+1)*PAGE-1);
      const { data, count, error } = await q;
      if (error) toast('Load error: '+error.message, 'err');
      setRows(data||[]); setTotal(count??0);
    } catch (e: any) {
      toast('Load error: '+(e?.message||'unknown'), 'err');
    } finally {
      setLoading(false);
    }
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
  const hideEv   = async (id:string, val:boolean) => { const {error} = await sb('events').update({hidden:val}).eq('id',id); if(error) toast('Error: '+error.message,'err'); else toast(val?'Hidden':'Restored'); load(); };
  const featEv   = async (r:any) => { const {error} = await sb('events').update({featured:!r.featured}).eq('id',r.id); if(error) toast('Error: '+error.message,'err'); else toast(r.featured?'Removed from spotlight':'Spotlight ✓'); load(); };
  const deleteEv = async (id:string) => { const {error} = await sb('events').delete().eq('id',id); if(error) toast('Error: '+error.message,'err'); else toast('Deleted'); setConfirm(null); load(); };
  const toggleSel = (id:string) => setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const doBulk = async () => {
    const ids = Array.from(selected);
    if (!ids.length||!bulkAct) return;
    if (bulkAct==='hide') for (const id of ids) await sb('events').update({hidden:true}).eq('id',id);
    if (bulkAct==='delete') for (const id of ids) await sb('events').delete().eq('id',id);
    toast(`${ids.length} events ${bulkAct==='hide'?'hidden':'deleted'}`);
    setSelected(new Set()); setBulkAct(''); load();
  };

  const openEditEvent = (r: any) => {
    const raw = typeof r.raw === 'string' ? JSON.parse(r.raw) : r.raw;
    setEditEvent(r);
    setEditForm({
      name: raw?.name || '',
      date: raw?.dates?.start?.localDate || r.event_date || '',
      time: raw?.dates?.start?.localTime?.slice(0,5) || '',
      venue: raw?._embedded?.venues?.[0]?.name || raw?.venue || '',
    });
  };
  const saveEditEvent = async () => {
    if (!editEvent) return;
    if (!editForm.name.trim() || !editForm.date) { toast('Name and date required', 'err'); return; }
    setEditSaving(true);
    const raw = typeof editEvent.raw === 'string' ? JSON.parse(editEvent.raw) : { ...editEvent.raw };
    raw.name = editForm.name.trim();
    if (!raw.dates) raw.dates = {};
    if (!raw.dates.start) raw.dates.start = {};
    raw.dates.start.localDate = editForm.date;
    raw.dates.start.localTime = editForm.time ? editForm.time + ':00' : undefined;
    if (!raw._embedded) raw._embedded = {};
    if (!raw._embedded.venues) raw._embedded.venues = [{}];
    raw._embedded.venues[0].name = editForm.venue;
    const { error } = await sb('events').update({ raw, event_date: editForm.date }).eq('id', editEvent.id);
    setEditSaving(false);
    if (error) { toast('Error: '+error.message, 'err'); return; }
    toast('Event updated ✓');
    setEditEvent(null);
    load();
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
                    <button onClick={()=>openEditEvent(r)} style={{...btnS,fontSize:11,padding:'3px 7px'}}>Edit</button>
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
          <button style={{...btnS,opacity:page===0?0.4:1}} onClick={()=>{setPage(p=>Math.max(0,p-1));setSelected(new Set());}} disabled={page===0}>← Prev</button>
          <button style={{...btnS,opacity:(page+1)*PAGE>=total?0.4:1}} onClick={()=>{setPage(p=>p+1);setSelected(new Set());}} disabled={(page+1)*PAGE>=total}>Next →</button>
        </div>
      </div>}
      {confirm&&<Confirm msg="Delete this event permanently?" onOk={()=>deleteEv(confirm)} onCancel={()=>setConfirm(null)} />}

      {editEvent&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditEvent(null);}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,maxWidth:500,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:'#18181b',margin:0}}>Edit Event</h3>
              <button onClick={()=>setEditEvent(null)} style={{...btnS,padding:'4px 10px',fontSize:13}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={lbl}>Event Name *</label><input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} style={inp} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={lbl}>Date *</label><input type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} style={inp} /></div>
                <div>
                  <label style={lbl}>Start Time <span style={{fontWeight:400,color:'#9ca3af'}}>(correct it here)</span></label>
                  <input type="time" value={editForm.time} onChange={e=>setEditForm(f=>({...f,time:e.target.value}))} style={inp} />
                </div>
              </div>
              <div><label style={lbl}>Venue</label><input value={editForm.venue} onChange={e=>setEditForm(f=>({...f,venue:e.target.value}))} style={inp} /></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button style={btnS} onClick={()=>setEditEvent(null)}>Cancel</button>
                <button style={{...btnP,opacity:editSaving?0.7:1}} onClick={saveEditEvent} disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT (Events)
// ─────────────────────────────────────────────────────────────────────────────
function BulkImportSection() {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const parseInput = () => {
    const lines = input.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map((line, idx) => {
      const parts = line.split('|').map(p => p.trim());
      return {
        idx,
        name: parts[0] || '',
        date: parts[1] || '',
        time: parts[2] || '',
        venue: parts[3] || '',
        category: parts[4] || 'general',
        ticketUrl: parts[5] || '',
        error: !parts[0] || !parts[1] ? 'Missing event name or date' : null,
      };
    });
    setPreview(parsed);
  };

  const doImport = async () => {
    setImporting(true);
    let success = 0, failed = 0;
    for (const item of preview) {
      if (item.error) { failed++; continue; }
      try {
        await sb('events').insert({
          name: item.name,
          event_date: item.date,
          time: item.time || null,
          venue: item.venue || null,
          category: item.category,
          ticket_url: item.ticketUrl || null,
          source: 'manual',
          hidden: false,
          featured: false,
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    setImporting(false);
    toast(`Imported ${success} events${failed > 0 ? `, ${failed} failed` : ''}`, failed > 0 ? 'err' : 'ok');
    setInput('');
    setPreview([]);
  };

  return (
    <div>
      <SectionHeader title="Bulk Event Import" sub="Paste events in format: Name | YYYY-MM-DD | HH:MM | Venue | Category | Ticket URL" />

      <div style={{...card, marginBottom:20}}>
        <label style={{...lbl, marginBottom:8}}>Paste Events (one per line)</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Event Name | 2025-05-15 | 19:00 | Venue Name | music | https://tickets.url"
          style={{...inp, minHeight:140, fontFamily:'monospace', fontSize:12, resize:'vertical'}}
        />
        <button onClick={parseInput} style={{...btnS, marginTop:10}}>Parse Preview</button>
      </div>

      {preview.length > 0 && (
        <div style={{...card, marginBottom:20}}>
          <h3 style={{fontSize:14, fontWeight:700, marginBottom:12}}>Preview ({preview.length} events)</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
              <thead><tr>
                <th style={{...th}}>Name</th>
                <th style={{...th}}>Date</th>
                <th style={{...th}}>Time</th>
                <th style={{...th}}>Venue</th>
                <th style={{...th}}>Category</th>
                <th style={{...th}}>Status</th>
              </tr></thead>
              <tbody>{preview.map((p) => (
                <tr key={p.idx} style={{background: p.error ? '#fef2f2' : '#f9fafb'}}>
                  <td style={{...td, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.name}</td>
                  <td style={{...td, whiteSpace:'nowrap'}}>{p.date}</td>
                  <td style={{...td, whiteSpace:'nowrap'}}>{p.time || '—'}</td>
                  <td style={{...td, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.venue || '—'}</td>
                  <td style={{...td, fontSize:11}}>{p.category}</td>
                  <td style={{...td, color: p.error ? '#dc2626' : '#059669', fontWeight:600, fontSize:11}}>
                    {p.error ? '❌ ' + p.error : '✓ Ready'}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{display:'flex', gap:10, marginTop:14, justifyContent:'flex-end'}}>
            <button onClick={() => { setInput(''); setPreview([]); }} style={btnS}>Clear</button>
            <button
              onClick={doImport}
              disabled={importing || preview.some(p => p.error)}
              style={{...btnP, opacity: (importing || preview.some(p => p.error)) ? 0.6 : 1}}
            >
              {importing ? 'Importing…' : `Import All (${preview.filter(p => !p.error).length})`}
            </button>
          </div>
        </div>
      )}
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
  const [editPlace, setEditPlace] = useState<any|null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editInsiderTip, setEditInsiderTip] = useState('');
  const [editBestFor, setEditBestFor] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRating, setEditRating] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [enrichedEnabled, setEnrichedEnabled] = useState(true);
  const [enrichedLoading, setEnrichedLoading] = useState(false);
  const [filterEnriched, setFilterEnriched] = useState<'all'|'enriched'|'missing'>('all');
  const [addingPlace, setAddingPlace] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('restaurant');
  const [addAddress, setAddAddress] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addWebsite, setAddWebsite] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPhotoUrl, setAddPhotoUrl] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // Load global enriched data toggle from config
  useEffect(() => {
    cfgGet('enriched_data_enabled').then((v:any) => {
      if (v !== null && v !== undefined) setEnrichedEnabled(v !== false);
    });
  }, []);

  const toggleEnrichedEnabled = async (val: boolean) => {
    setEnrichedLoading(true);
    await cfgSet('enriched_data_enabled', val);
    setEnrichedEnabled(val);
    setEnrichedLoading(false);
    toast(val ? 'Enriched data enabled globally ✓' : 'Enriched data hidden globally');
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = sb('places').select('id,source,hidden,featured,hide_enriched,enriched,raw',{count:'exact'}).order('raw->>name',{ascending:true});
      if (search) q = q.ilike('raw->>name',`%${search}%`);
      if (filterEnriched === 'enriched') q = (q as any).not('enriched', 'is', null);
      if (filterEnriched === 'missing')  q = (q as any).is('enriched', null);
      q = q.range(page*PAGE,(page+1)*PAGE-1);
      const { data, count, error } = await q;
      if (error) toast('Load error: '+error.message, 'err');
      setRows(data||[]); setTotal(count??0);
    } catch (e: any) {
      toast('Load error: '+(e?.message||'unknown'), 'err');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterEnriched]);

  useEffect(() => { load(); }, [load]);

  const pName  = (r:any) => r.raw?.name || '—';
  const pCat   = (r:any) => r.raw?.category || (r.raw?.types?.[0]||'other');
  const pAddr  = (r:any) => r.raw?.vicinity || r.raw?.address || '—';
  const pRating= (r:any) => r.raw?.rating ? `⭐ ${r.raw.rating}` : '—';

  const hidePlace = async (id:string, val:boolean) => { const {error} = await sb('places').update({hidden:val}).eq('id',id); if(error) toast('Error: '+error.message,'err'); else toast(val?'Hidden':'Restored'); load(); };
  const featPlace = async (r:any) => { const {error} = await sb('places').update({featured:!r.featured}).eq('id',r.id); if(error) toast('Error: '+error.message,'err'); else toast(r.featured?'Removed from featured':'Featured ✓'); load(); };
  const toggleHideEnriched = async (id:string, val:boolean) => { const {error} = await sb('places').update({hide_enriched:val}).eq('id',id); if(error) toast('Error: '+error.message,'err'); else toast(val?'Enriched data hidden for this place':'Enriched data shown ✓'); load(); };
  const delPlace  = async (id:string) => { const {error} = await sb('places').delete().eq('id',id); if(error) toast('Error: '+error.message,'err'); else toast('Deleted'); setConfirm(null); load(); };
  const toggleSel = (id:string) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const doBulkCat = async () => {
    if (!selected.size||!bulkCat) return;
    for (const id of selected) {
      const row = rows.find(r=>r.id===id);
      if (row) await sb('places').update({raw:{...row.raw,category:bulkCat}}).eq('id',id);
    }
    toast(`${selected.size} places → ${bulkCat}`); setSelected(new Set()); setBulkCat(''); load();
  };

  const openEdit = (r: any) => {
    setEditPlace(r);
    setEditPhotoUrl(r.raw?.overridePhoto || '');
    setEditName(r.raw?.name || '');
    setEditCategory(r.raw?.category || (r.raw?.types?.[0] || 'other'));
    setEditAddress(r.raw?.vicinity || r.raw?.address || r.raw?.formattedAddress || '');
    setEditDescription(r.raw?.description || r.raw?.about || '');
    setEditInsiderTip(r.raw?.insiderTip || r.enriched?.tip || '');
    setEditBestFor(r.raw?.bestFor || '');
    setEditTags((r.raw?.tags || []).join(', '));
    setEditRating(r.raw?.rating?.toString() || '');
    setEditWebsite(r.enriched?.website || r.raw?.website || '');
    setEditPhone(r.enriched?.phone || r.raw?.phone || '');
  };
  const saveEdit = async () => {
    if (!editPlace) return;
    setEditSaving(true);
    const updatedRaw = { ...editPlace.raw };
    // Photo override
    if (editPhotoUrl.trim()) {
      updatedRaw.overridePhoto = editPhotoUrl.trim();
    } else {
      delete updatedRaw.overridePhoto;
    }
    // Core fields
    if (editName.trim()) updatedRaw.name = editName.trim();
    updatedRaw.category = editCategory || updatedRaw.category;
    if (editAddress.trim()) {
      updatedRaw.vicinity = editAddress.trim();
      updatedRaw.address = editAddress.trim();
      updatedRaw.formattedAddress = editAddress.trim();
    }
    // Description & tips
    if (editDescription.trim()) updatedRaw.description = editDescription.trim();
    else delete updatedRaw.description;
    if (editInsiderTip.trim()) updatedRaw.insiderTip = editInsiderTip.trim();
    else delete updatedRaw.insiderTip;
    if (editBestFor.trim()) updatedRaw.bestFor = editBestFor.trim();
    else delete updatedRaw.bestFor;
    // Tags
    const tagList = editTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    if (tagList.length > 0) updatedRaw.tags = tagList;
    else delete updatedRaw.tags;
    // Rating override
    const rVal = parseFloat(editRating);
    if (!isNaN(rVal) && rVal >= 0 && rVal <= 5) updatedRaw.rating = rVal;
    // Enriched data updates — sync all enriched fields to the enriched JSONB column
    const updatedEnriched = { ...(editPlace.enriched || {}) };
    if (editWebsite.trim()) updatedEnriched.website = editWebsite.trim();
    if (editPhone.trim()) updatedEnriched.phone = editPhone.trim();
    if (editInsiderTip.trim()) updatedEnriched.tip = editInsiderTip.trim();
    // Also sync fields from raw into enriched for display consistency
    if (updatedRaw.parkingInfo) updatedEnriched.parking = updatedRaw.parkingInfo;
    if (updatedRaw.about) updatedEnriched.editorial = updatedRaw.about;
    if (updatedRaw.historicNote) updatedEnriched.historicNote = updatedRaw.historicNote;
    if (updatedRaw.bestFor) updatedEnriched.bestFor = updatedRaw.bestFor;
    if (updatedRaw.priceNote) updatedEnriched.priceNote = updatedRaw.priceNote;

    const updatePayload: any = { raw: updatedRaw };
    if (Object.keys(updatedEnriched).length > 0) updatePayload.enriched = updatedEnriched;

    const { error } = await sb('places').update(updatePayload).eq('id', editPlace.id);
    setEditSaving(false);
    if (error) { toast('Error: '+error.message, 'err'); return; }
    toast('Place updated ✓');
    setEditPlace(null);
    load();
  };
  const saveHideEnrichedInEdit = async (val: boolean) => {
    if (!editPlace) return;
    const {error} = await sb('places').update({hide_enriched: val}).eq('id', editPlace.id);
    if (error) { toast('Error: '+error.message,'err'); return; }
    setEditPlace((prev: any) => ({...prev, hide_enriched: val}));
    toast(val ? 'Enriched data hidden for this place' : 'Enriched data restored ✓');
    load();
  };

  const saveAddPlace = async () => {
    if (!addName.trim() || !addCategory) { toast('Name and category required', 'err'); return; }
    setAddSaving(true);
    try {
      const raw = {
        name: addName.trim(),
        category: addCategory,
        vicinity: addAddress.trim(),
        address: addAddress.trim(),
        description: addDescription.trim(),
        types: [addCategory],
      };
      if (addPhotoUrl.trim()) raw.overridePhoto = addPhotoUrl.trim();

      const enriched: any = {};
      if (addWebsite.trim()) enriched.website = addWebsite.trim();
      if (addPhone.trim()) enriched.phone = addPhone.trim();

      const payload: any = { source: 'manual', raw, hidden: false, featured: false };
      if (Object.keys(enriched).length > 0) payload.enriched = enriched;

      const { error } = await sb('places').insert(payload);
      if (error) { toast('Error: '+error.message, 'err'); return; }
      toast('Place created ✓');
      setAddingPlace(false);
      setAddName(''); setAddCategory('restaurant'); setAddAddress(''); setAddDescription(''); setAddWebsite(''); setAddPhone(''); setAddPhotoUrl('');
      load();
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader title="Places" sub={`${total.toLocaleString()} total`} action={<button onClick={()=>setAddingPlace(true)} style={btnP}>+ Add Place</button>} />

      {/* Quick Feature / Place of the Day search */}
      <div style={{...card, marginBottom: 16, borderLeft: '3px solid #b95c43'}}>
        <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#b95c43'}}>Quick Feature a Place</h4>
        <p style={{fontSize: 12, color: '#9ca3af', marginBottom: 8}}>Search and toggle featured status without scrolling the full list.</p>
        <PlaceSearchPicker value="" onChange={async (id: string) => {
          if (!id) return;
          const { error } = await sb('places').update({ featured: true }).eq('id', id);
          if (error) { toast('Error: ' + error.message, 'err'); return; }
          toast('Place featured! ✓');
          load();
        }} />
      </div>

      {/* Global enriched data toggle */}
      <div style={{...card,marginBottom:16,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div>
          <p style={{fontSize:14,fontWeight:700,color:'#18181b',margin:0}}>Enriched Business Data</p>
          <p style={{fontSize:12,color:'#6b7280',margin:'2px 0 0'}}>Controls whether website, phone, hours, parking &amp; local tips show in place modals across the whole app</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {enrichedLoading && <span style={{fontSize:12,color:'#9ca3af'}}>Saving…</span>}
          <button
            onClick={()=>toggleEnrichedEnabled(!enrichedEnabled)}
            disabled={enrichedLoading}
            style={{
              padding:'7px 16px',fontSize:13,fontWeight:700,borderRadius:6,border:'none',cursor:'pointer',
              background: enrichedEnabled ? '#16a34a' : '#6b7280',
              color: 'white',
              opacity: enrichedLoading ? 0.6 : 1,
            }}
          >
            {enrichedEnabled ? '✓ Enabled Globally' : '✗ Disabled Globally'}
          </button>
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search places…" style={{...inp,width:240,minWidth:0}} />
        <select value={filterEnriched} onChange={e=>{setFilterEnriched(e.target.value as any);setPage(0);}} style={{...inp,width:160}}>
          <option value="all">All places</option>
          <option value="enriched">Has enriched data</option>
          <option value="missing">Missing data</option>
        </select>
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
                <th style={th}>Name</th><th style={th}>Category</th><th style={th}>Rating</th><th style={th}>Enriched</th><th style={th}>Featured</th><th style={th}>Status</th><th style={th}>Actions</th>
              </tr></thead>
              <tbody>{rows.map(r=>(
                <tr key={r.id} style={{background:selected.has(r.id)?'#fdf3ee':'white'}}>
                  <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleSel(r.id)} /></td>
                  <td style={{...td,fontWeight:600,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pName(r)}</td>
                  <td style={td}><span style={{fontSize:11,background:'#f3f4f6',color:'#6b7280',padding:'2px 7px',borderRadius:4}}>{pCat(r)}</span></td>
                  <td style={td}>{pRating(r)}</td>
                  <td style={td}>
                    {r.enriched
                      ? r.hide_enriched
                        ? <span title="Has data but hidden for this place" style={{fontSize:11,color:'#9ca3af',cursor:'pointer'}} onClick={()=>toggleHideEnriched(r.id,false)}>🌐 Hidden</span>
                        : <span title="Enriched data visible — click to hide" style={{fontSize:11,color:'#059669',fontWeight:700,cursor:'pointer'}} onClick={()=>toggleHideEnriched(r.id,true)}>🌐 Live</span>
                      : <span style={{fontSize:11,color:'#d1d5db'}}>—</span>
                    }
                  </td>
                  <td style={td}>{r.featured?<span style={{color:'#d97706',fontWeight:700}}>★ Yes</span>:<span style={{color:'#9ca3af'}}>No</span>}</td>
                  <td style={td}>{r.hidden?<span style={{color:'#9ca3af',fontSize:12}}>Hidden</span>:<span style={{color:'#059669',fontSize:12,fontWeight:700}}>Live</span>}</td>
                  <td style={td}><div style={{display:'flex',gap:5}}>
                    <button onClick={()=>featPlace(r)} style={{...btnS,fontSize:11,padding:'3px 7px',color:r.featured?'#d97706':'#9ca3af'}}>★</button>
                    <button onClick={()=>hidePlace(r.id,!r.hidden)} style={{...btnS,fontSize:11,padding:'3px 7px'}}>{r.hidden?'Show':'Hide'}</button>
                    <button onClick={()=>openEdit(r)} style={{...btnS,fontSize:11,padding:'3px 7px',color:r.raw?.overridePhoto?'#7c3aed':'inherit'}}>
                      {r.raw?.overridePhoto?'📷 Edit':'Edit'}
                    </button>
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
          <button style={{...btnS,opacity:page===0?0.4:1}} onClick={()=>{setPage(p=>Math.max(0,p-1));setSelected(new Set());}} disabled={page===0}>← Prev</button>
          <button style={{...btnS,opacity:(page+1)*PAGE>=total?0.4:1}} onClick={()=>{setPage(p=>p+1);setSelected(new Set());}} disabled={(page+1)*PAGE>=total}>Next →</button>
        </div>
      </div>}
      {confirm&&<Confirm msg="Delete this place permanently?" onOk={()=>delPlace(confirm)} onCancel={()=>setConfirm(null)} />}

      {editPlace&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditPlace(null);}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,maxWidth:520,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:'#18181b',margin:0}}>Edit Place</h3>
              <button onClick={()=>setEditPlace(null)} style={{...btnS,padding:'4px 10px',fontSize:13}}>✕</button>
            </div>
            <p style={{fontSize:14,fontWeight:700,color:'#374151',marginBottom:4}}>{editPlace.raw?.name}</p>
            <p style={{fontSize:11,color:'#9ca3af',marginBottom:16,fontFamily:'monospace'}}>{editPlace.id}</p>

            {/* Core fields */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Name</label>
                <input value={editName} onChange={e=>setEditName(e.target.value)} style={inp} placeholder="Place name" />
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select value={editCategory} onChange={e=>setEditCategory(e.target.value)} style={inp}>
                  {PLACE_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Address</label>
                <input value={editAddress} onChange={e=>setEditAddress(e.target.value)} style={inp} placeholder="Full address" />
              </div>
              <div>
                <label style={lbl}>Rating (0–5)</label>
                <input value={editRating} onChange={e=>setEditRating(e.target.value)} style={inp} placeholder="4.5" type="number" min="0" max="5" step="0.1" />
              </div>
              <div>
                <label style={lbl}>Tags <span style={{fontWeight:400,color:'#9ca3af'}}>(comma-separated)</span></label>
                <input value={editTags} onChange={e=>setEditTags(e.target.value)} style={inp} placeholder="outdoor patio, dog friendly, live music" />
              </div>
            </div>

            {/* Description & tips */}
            <div style={{marginBottom:16}}>
              <label style={lbl}>Description / About</label>
              <textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} style={{...inp,minHeight:60,resize:'vertical'}} placeholder="A short description of this place…" />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Insider Tip 💡</label>
                <textarea value={editInsiderTip} onChange={e=>setEditInsiderTip(e.target.value)} style={{...inp,minHeight:50,resize:'vertical'}} placeholder="Try the green chile burger…" />
              </div>
              <div>
                <label style={lbl}>Best For</label>
                <input value={editBestFor} onChange={e=>setEditBestFor(e.target.value)} style={inp} placeholder="Date night, brunch, families" />
              </div>
            </div>

            {/* Contact info */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div>
                <label style={lbl}>Website</label>
                <input value={editWebsite} onChange={e=>setEditWebsite(e.target.value)} style={inp} placeholder="https://…" />
              </div>
              <div>
                <label style={lbl}>Phone</label>
                <input value={editPhone} onChange={e=>setEditPhone(e.target.value)} style={inp} placeholder="(505) 555-1234" />
              </div>
            </div>

            {/* Enriched data section */}
            {editPlace.enriched ? (
              <div style={{marginBottom:20,background:'#f9fafb',borderRadius:8,padding:14,border:'1px solid #e5e7eb'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <p style={{fontSize:13,fontWeight:700,color:'#374151',margin:0}}>🌐 Enriched Business Data</p>
                  <button
                    onClick={()=>saveHideEnrichedInEdit(!editPlace.hide_enriched)}
                    style={{
                      padding:'5px 12px',fontSize:12,fontWeight:700,borderRadius:6,border:'none',cursor:'pointer',
                      background: editPlace.hide_enriched ? '#6b7280' : '#16a34a',
                      color: 'white',
                    }}
                  >
                    {editPlace.hide_enriched ? '✗ Hidden for this place' : '✓ Visible — click to hide'}
                  </button>
                </div>
                <div style={{display:'grid',gap:6,fontSize:13,color:'#374151'}}>
                  {editPlace.enriched.phone    && <div><span style={{fontWeight:600,color:'#6b7280'}}>📞 Phone: </span>{editPlace.enriched.phone}</div>}
                  {editPlace.enriched.website  && <div><span style={{fontWeight:600,color:'#6b7280'}}>🔗 Website: </span><a href={editPlace.enriched.website} target="_blank" rel="noopener noreferrer" style={{color:'#2563eb'}}>{editPlace.enriched.website.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}</a></div>}
                  {editPlace.enriched.hours    && <div><span style={{fontWeight:600,color:'#6b7280'}}>🕐 Hours: </span>{editPlace.enriched.hours.split(' | ').join(', ')}</div>}
                  {editPlace.enriched.parking  && <div><span style={{fontWeight:600,color:'#6b7280'}}>🅿️ Parking: </span>{editPlace.enriched.parking}</div>}
                  {editPlace.enriched.tip      && <div style={{marginTop:4,padding:'8px 10px',background:'#fffbeb',borderRadius:6,border:'1px solid #fde68a'}}><span style={{fontWeight:700,color:'#b45309'}}>💡 Tip: </span>{editPlace.enriched.tip}</div>}
                  {editPlace.enriched.editorial && <div style={{marginTop:4,color:'#6b7280',fontSize:12,fontStyle:'italic'}}>{editPlace.enriched.editorial}</div>}
                </div>
              </div>
            ) : (
              <div style={{marginBottom:20,background:'#f9fafb',borderRadius:8,padding:14,border:'1px solid #e5e7eb'}}>
                <p style={{fontSize:13,color:'#9ca3af',margin:0}}>No enriched data yet for this place. Run the enrichment script on your Windows PC to populate business details.</p>
              </div>
            )}
            {/* Current photo preview */}
            {editPlace.raw?.photos?.[0]?.photo_reference && (
              <div style={{marginBottom:16}}>
                <label style={lbl}>Current Google Photo</label>
                <img
                  src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${editPlace.raw.photos[0].photo_reference}&key=${import.meta.env.VITE_GOOGLE_PLACES_KEY}`}
                  style={{width:'100%',height:180,objectFit:'cover',borderRadius:8,border:'1px solid #e5e7eb'}}
                  alt="Current Google photo"
                />
              </div>
            )}
            {/* Override URL input */}
            <div style={{marginBottom:editPhotoUrl?12:16}}>
              <label style={lbl}>Override Photo URL <span style={{fontWeight:400,color:'#9ca3af'}}>(leave blank to use Google photo)</span></label>
              <input value={editPhotoUrl} onChange={e=>setEditPhotoUrl(e.target.value)} style={inp} placeholder="https://example.com/photo.jpg" />
              {editPlace.raw?.overridePhoto&&<p style={{fontSize:11,color:'#7c3aed',marginTop:4}}>✓ Override active on this place</p>}
            </div>
            {/* Override preview */}
            {editPhotoUrl&&(
              <div style={{marginBottom:16}}>
                <label style={lbl}>Override Preview</label>
                <img src={editPhotoUrl} style={{width:'100%',height:180,objectFit:'cover',borderRadius:8,border:'2px solid #7c3aed'}} alt="Override preview" onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />
              </div>
            )}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
              <button style={btnS} onClick={()=>setEditPlace(null)}>Cancel</button>
              {editPlace.raw?.overridePhoto&&<button style={{...btnS,color:'#dc2626',borderColor:'#fca5a5'}} onClick={()=>setEditPhotoUrl('')}>Clear Override</button>}
              <button style={{...btnP,opacity:editSaving?0.7:1}} onClick={saveEdit} disabled={editSaving}>{editSaving?'Saving…':'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {addingPlace&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setAddingPlace(false);}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,maxWidth:500,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{fontSize:16,fontWeight:800,color:'#18181b',margin:0}}>Add New Place</h3>
              <button onClick={()=>setAddingPlace(false)} style={{...btnS,padding:'4px 10px',fontSize:13}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div><label style={lbl}>Name *</label><input value={addName} onChange={e=>setAddName(e.target.value)} style={inp} placeholder="Place name" /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                <div><label style={lbl}>Category *</label><select value={addCategory} onChange={e=>setAddCategory(e.target.value)} style={inp}>{PLACE_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={lbl}>Phone</label><input value={addPhone} onChange={e=>setAddPhone(e.target.value)} style={inp} placeholder="(505) 123-4567" /></div>
              </div>
              <div><label style={lbl}>Address</label><input value={addAddress} onChange={e=>setAddAddress(e.target.value)} style={inp} placeholder="123 Main St, Albuquerque, NM" /></div>
              <div><label style={lbl}>Website</label><input value={addWebsite} onChange={e=>setAddWebsite(e.target.value)} style={inp} placeholder="https://example.com" /></div>
              <div><label style={lbl}>Description</label><textarea value={addDescription} onChange={e=>setAddDescription(e.target.value)} style={{...inp,minHeight:60,resize:'vertical'}} placeholder="A short description of this place…" /></div>
              <div><label style={lbl}>Photo URL (optional)</label><input value={addPhotoUrl} onChange={e=>setAddPhotoUrl(e.target.value)} style={inp} placeholder="https://example.com/photo.jpg" /></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button style={btnS} onClick={()=>setAddingPlace(false)}>Cancel</button>
                <button style={{...btnP,opacity:addSaving?0.7:1}} onClick={saveAddPlace} disabled={addSaving}>{addSaving?'Creating…':'Create Place'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const [addForm, setAddForm] = useState<{name:string;type:'event'|'place'}|null>(null);
  useEffect(() => { cfgGet('categories').then(v=>{ if(v?.length) setCats(v); setLoading(false); }).catch(()=>setLoading(false)); }, []);
  const persist = async (list:CatEntry[]) => { await cfgSet('categories',list); setCats(list); };
  const addCat  = async () => {
    if (!addForm?.name?.trim()) { toast('Name required','err'); return; }
    const nc:CatEntry = {id:addForm.type+'-'+addForm.name.trim().toLowerCase(),name:addForm.name.trim(),icon:'📁',color:'#6b7280',type:addForm.type,order:cats.length};
    await persist([...cats,nc]); toast('Added ✓'); setAddForm(null);
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
      <SectionHeader title="Categories" sub="Manage event and place categories" action={<button style={btnP} onClick={()=>setAddForm({name:'',type:'event'})}>+ New</button>} />
      {addForm&&(
        <div style={{...card,marginBottom:20,border:`2px solid ${ACCENT}`}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>New Category</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:12}}>
            <div><label style={lbl}>Name *</label><input value={addForm.name} onChange={e=>setAddForm(v=>v&&{...v,name:e.target.value})} style={inp} autoFocus placeholder="Category name" /></div>
            <div><label style={lbl}>Type</label><select value={addForm.type} onChange={e=>setAddForm(v=>v&&{...v,type:e.target.value as 'event'|'place'})} style={inp}><option value="event">Event</option><option value="place">Place</option></select></div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button style={btnS} onClick={()=>setAddForm(null)}>Cancel</button>
            <button style={btnP} onClick={addCat}>Add Category</button>
          </div>
        </div>
      )}
      {editing&&(
        <div style={{...card,marginBottom:20,border:`2px solid ${ACCENT}`}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:12}}>
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

// ─────────────────────────────────────────────────────────────────────────────
// PLACE SEARCH PICKER — search by name instead of knowing the Place ID
// ─────────────────────────────────────────────────────────────────────────────
function PlaceSearchPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Load the name for the current value on mount
  useEffect(() => {
    if (!value) { setSelectedName(''); return; }
    sb('places').select('raw').eq('id', value).single().then(({ data }) => {
      if (data?.raw?.name) setSelectedName(data.raw.name as string);
      else if (data?.raw?.displayName?.text) setSelectedName(data.raw.displayName.text as string);
    });
  }, [value]);

  const doSearch = (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    sb('places').select('id, raw').ilike('raw->>name', `%${q}%`).limit(15).then(({ data }) => {
      const items = (data || []).map((r: any) => ({
        id: r.id,
        name: (r.raw?.name || r.raw?.displayName?.text || 'Unknown') as string,
        address: (r.raw?.formattedAddress || r.raw?.vicinity || '') as string,
      }));
      setResults(items);
      setSearching(false);
    });
  };

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  return (
    <div style={{ position: 'relative' }}>
      {value && selectedName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>Selected:</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedName}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>({value.slice(0, 20)}…)</span>
          <button onClick={() => { onChange(''); setSelectedName(''); }} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
        </div>
      ) : null}
      <input
        value={query}
        onChange={e => handleInput(e.target.value)}
        style={{ ...inp, marginBottom: 0 }}
        placeholder="Type to search places by name…"
      />
      {searching && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Searching…</p>}
      {results.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto', marginTop: 4 }}>
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => { onChange(r.id); setSelectedName(r.name); setQuery(''); setResults([]); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f3f4f6', background: r.id === value ? '#f0fdf4' : '#fff', cursor: 'pointer', fontSize: 13 }}
            >
              <div style={{ fontWeight: 600, color: '#1f2937' }}>{r.name}</div>
              {r.address && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{r.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentSection() {
  const [cfg, setCfg]   = useState<ContentCfg>(DEF_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editVibe, setEditVibe] = useState<ContentCfg['vibes'][0]|null>(null);
  useEffect(() => { cfgGet('content').then(v=>{ if(v) setCfg({...DEF_CONTENT,...v}); setLoading(false); }).catch(()=>setLoading(false)); }, []);
  const save = async () => { setSaving(true); await cfgSet('content',cfg); setSaving(false); toast('Saved ✓'); };
  if (loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;
  return (
    <div>
      <SectionHeader title="Content Sections" sub="Edit hero copy, vibes, section visibility" />
      <div style={{...card,marginBottom:18}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Hero Taglines</h3>
        <p style={{fontSize:12,color:'#9ca3af',marginBottom:6}}>One phrase per line. The app randomly picks from these for the Discover page hero. Paste in bulk — one per line.</p>
        <p style={{fontSize:12,fontWeight:600,color:'#6366f1',marginBottom:10}}>{cfg.heroLines.length} phrase{cfg.heroLines.length !== 1 ? 's' : ''} loaded</p>
        <textarea value={cfg.heroLines.join('\n')} onChange={e=>setCfg(c=>({...c,heroLines:e.target.value.split('\n').filter(Boolean)}))} rows={20} style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:13,lineHeight:'1.6'}} placeholder="Go Do Something&#10;Touch Some Grass&#10;Stop Doomscrolling&#10;..." />
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button onClick={()=>{if(confirm('Sort all phrases alphabetically?')){setCfg(c=>({...c,heroLines:[...c.heroLines].sort((a,b)=>a.localeCompare(b))}));}}} style={{padding:'6px 12px',fontSize:12,fontWeight:600,border:'1px solid #e5e7eb',borderRadius:6,background:'white',cursor:'pointer'}}>Sort A→Z</button>
          <button onClick={()=>{const dupes=cfg.heroLines.filter((v,i,a)=>a.findIndex(x=>x.toLowerCase().trim()===v.toLowerCase().trim())!==i);if(dupes.length){setCfg(c=>({...c,heroLines:[...new Map(c.heroLines.map(h=>[h.toLowerCase().trim(),h])).values()]}));alert(`Removed ${dupes.length} duplicate(s)`);}else{alert('No duplicates found');}}} style={{padding:'6px 12px',fontSize:12,fontWeight:600,border:'1px solid #e5e7eb',borderRadius:6,background:'white',cursor:'pointer'}}>Remove Duplicates</button>
        </div>
      </div>
      <div style={{...card,marginBottom:18}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Daily Gem / Sunday's Spot</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><label style={lbl}>Title</label><input value={cfg.dailyGem.title} onChange={e=>setCfg(c=>({...c,dailyGem:{...c.dailyGem,title:e.target.value}}))} style={inp} /></div>
          <div><label style={lbl}>Subtitle</label><input value={cfg.dailyGem.subtitle} onChange={e=>setCfg(c=>({...c,dailyGem:{...c.dailyGem,subtitle:e.target.value}}))} style={inp} /></div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={lbl}>Place of the Day (search by name)</label>
            <PlaceSearchPicker
              value={cfg.dailyGem.placeId}
              onChange={(id: string) => setCfg(c=>({...c,dailyGem:{...c.dailyGem,placeId:id}}))}
            />
          </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsSection() {
  const [range, setRange]       = useState<'7d'|'30d'|'90d'>('7d');
  const [loading, setLoading]   = useState(true);
  const [totals,  setTotals]    = useState({} as Record<string,number>);
  const [topEvents, setTopEvents] = useState<{name:string;count:number}[]>([]);
  const [topPlaces, setTopPlaces] = useState<{name:string;count:number}[]>([]);
  const [topSearches,setTopSearches]=useState<{query:string;count:number}[]>([]);
  const [topDirections, setTopDirections] = useState<{name:string;count:number}[]>([]);
  const [deviceBreakdown,setDeviceBreakdown]=useState<{device:string;count:number}[]>([]);
  const [dailyActive,setDailyActive]=useState<{day:string;sessions:number}[]>([]);
  const [sectionEngagement,setSectionEngagement]=useState<{tab:string;count:number}[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [errorGrouped, setErrorGrouped] = useState({} as Record<string,{count:number;lastSeen:string;ids:string[]}>);
  const [topPages, setTopPages] = useState<{path:string;count:number}[]>([]);
  const [shareClicks, setShareClicks] = useState(0);
  const [getDirectionsClicks, setGetDirectionsClicks] = useState(0);

  const days = range==='7d'?7:range==='30d'?30:90;

  useEffect(() => {
    const since = new Date(Date.now()-days*86400000).toISOString();
    async function load() {
      setLoading(true);
      try {
      const { data: allRows } = await sb('analytics').select('event_type,session_id,data,device,created_at').gte('created_at',since);
      const rows = allRows || [];

      // Totals by event_type
      const typeCount: Record<string,number> = {};
      for (const r of rows) typeCount[r.event_type] = (typeCount[r.event_type]||0)+1;

      // Unique sessions
      const uniqueSessions = new Set(rows.filter(r=>r.session_id).map((r:any)=>r.session_id)).size;
      typeCount['_unique_sessions'] = uniqueSessions;

      // Bounce rate (sessions with only 1 event)
      const sessionEventCount: Record<string,number> = {};
      rows.forEach((r:any)=>{
        if(r.session_id) sessionEventCount[r.session_id] = (sessionEventCount[r.session_id]||0)+1;
      });
      const bounceCount = Object.values(sessionEventCount).filter(c=>c===1).length;
      typeCount['_bounce_rate'] = uniqueSessions > 0 ? Math.round((bounceCount/uniqueSessions)*100) : 0;

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

      // Get Directions clicks
      const dirCount = rows.filter(r=>r.event_type==='directions_click').length;
      setGetDirectionsClicks(dirCount);
      const topDirs: Record<string,number> = {};
      rows.filter(r=>r.event_type==='directions_click').forEach((r:any)=>{ const n=r.data?.name||'Unknown'; topDirs[n]=(topDirs[n]||0)+1; });
      setTopDirections(Object.entries(topDirs).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count})));

      // Share clicks
      const shareCount = rows.filter(r=>r.event_type==='share').length;
      setShareClicks(shareCount);

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

      // Top pages (most viewed paths from pageview events)
      const pageCounts: Record<string,number> = {};
      rows.filter(r=>r.event_type==='pageview').forEach((r:any)=>{
        const path = r.data?.path || r.data?.tab || 'unknown';
        pageCounts[path]=(pageCounts[path]||0)+1;
      });
      setTopPages(Object.entries(pageCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([path,count])=>({path,count})));

      // Recent errors - grouped by message
      const errors = rows.filter(r=>r.event_type==='client_error').sort((a:any,b:any)=>b.created_at.localeCompare(a.created_at)).slice(0,50);
      setRecentErrors(errors);
      
      const errorsByMsg: Record<string,{count:number;lastSeen:string;ids:string[]}> = {};
      errors.forEach((err:any,i:number)=>{
        const msg = err.data?.message?.slice(0,100) || 'Unknown error';
        if(!errorsByMsg[msg]) errorsByMsg[msg] = {count:0, lastSeen: err.created_at, ids:[]};
        errorsByMsg[msg].count++;
        if(i === 0) errorsByMsg[msg].lastSeen = err.created_at;
        if(errorsByMsg[msg].ids.length < 3) errorsByMsg[msg].ids.push(err.id);
      });
      setErrorGrouped(errorsByMsg);

      setTotals({...typeCount});
      } catch(e:any) {
        console.error('Analytics load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [range]);

  const maxDA = Math.max(...dailyActive.map(d=>d.sessions),1);
  const maxSE = Math.max(...sectionEngagement.map(d=>d.count),1);
  const maxTP = Math.max(...topPlaces.map(d=>d.count),1);
  const maxTE = Math.max(...topEvents.map(d=>d.count),1);

  const statCard = (label:string,val:number,icon:string,color:string,subtitle?:string) => (
    <div style={{...card,padding:'18px 20px'}}>
      <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:26,fontWeight:800,color,letterSpacing:'-0.5px'}}>{val.toLocaleString()}</div>
      <div style={{fontSize:12,color:'#9ca3af',fontWeight:600,marginTop:3}}>{label}</div>
      {subtitle && <div style={{fontSize:11,color:'#d1d5db',marginTop:2}}>{subtitle}</div>}
    </div>
  );

  const clearErrors = () => {
    if(!confirm('Delete all error logs for this period?')) return;
    // In a real app, this would call a backend endpoint to delete
    toast('Error logs would be cleared here (requires backend endpoint)','info');
  };

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
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,150px),1fr))',gap:12,marginBottom:24}}>
            {statCard('Unique Sessions',   totals._unique_sessions||0, '👤','#8B3A0F')}
            {statCard('Page Views',        totals.pageview||0,         '📄','#1d4ed8')}
            {statCard('Event Clicks',      totals.event_click||0,      '🎫','#059669')}
            {statCard('Place Clicks',      totals.place_click||0,      '📍','#7c3aed')}
            {statCard('Searches',          totals.search||0,           '🔍','#b45309')}
            {statCard('Get Directions',    getDirectionsClicks||0,     '🗺️','#0891b2')}
            {statCard('Share Clicks',      shareClicks||0,             '🔗','#9333ea')}
            {statCard('Check-ins',         totals.checkin||0,          '✅','#fb923c')}
            {statCard('Bounce Rate',       totals._bounce_rate||0,     '📊','#dc2626','% of sessions')}
            {statCard('Errors',            totals.client_error||0,     '⚠️','#ea580c')}
            {statCard('A2HS Shown',        totals.a2hs_shown||0,       '📲','#6366f1')}
            {statCard('A2HS Accepted',     totals.a2hs_accepted||0,    '🏠','#10b981')}
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

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,320px),1fr))',gap:20,marginBottom:20}}>
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

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,280px),1fr))',gap:20,marginBottom:20}}>
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

          {/* Get Directions tracker */}
          {getDirectionsClicks > 0 && (
            <div style={{...card,marginBottom:20}}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Get Directions Clicks</h3>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:14}}>
                <div style={{fontSize:28,fontWeight:800,color:'#0891b2'}}>{getDirectionsClicks}</div>
                <div style={{fontSize:12,color:'#9ca3af'}}>people used get directions</div>
              </div>
              {topDirections.length > 0 && (
                <>
                  <h4 style={{fontSize:12,fontWeight:700,color:'#6b7280',marginBottom:10}}>Most Popular Destinations</h4>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                    {topDirections.map((d,i)=>(
                      <div key={i} style={{padding:'10px',background:'#f9fafb',borderRadius:8}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#18181b',marginBottom:4}}>{d.name.slice(0,30)}</div>
                        <div style={{fontSize:11,fontWeight:700,color:'#0891b2'}}>{d.count} clicks</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Top pages */}
          <div style={{...card,marginBottom:20}}>
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:14,color:'#374151'}}>Top Viewed Pages</h3>
            {!topPages.length ? <p style={{color:'#9ca3af',fontSize:13}}>No pageview data yet.</p> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:8}}>
                {topPages.map((p,i)=>(
                  <div key={p.path} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 10px',background:i===0?'#fdf3ee':'#f9fafb',borderRadius:6}}>
                    <div style={{width:22,fontSize:12,fontWeight:800,color:i<3?ACCENT:'#9ca3af',textAlign:'right'}}>{i+1}</div>
                    <div style={{flex:1,fontSize:13,fontWeight:i<3?700:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'monospace'}}>{p.path}</div>
                    <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>{p.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error log - now grouped */}
          <div style={{...card, borderLeft: (recentErrors.length > 0) ? '3px solid #dc2626' : '3px solid #d1d5db'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
              <div>
                <h3 style={{fontSize:14,fontWeight:700,margin:0,color: recentErrors.length > 0 ? '#dc2626' : '#374151'}}>
                  Client Error Log {recentErrors.length > 0 && <span style={{fontSize:12,fontWeight:400,color:'#9ca3af',marginLeft:8}}>({recentErrors.length} errors)</span>}
                </h3>
                <p style={{fontSize:12,color:'#9ca3af',marginTop:6,marginBottom:0}}>JavaScript errors captured from user browsers</p>
              </div>
              {recentErrors.length > 0 && <button onClick={clearErrors} style={{...btnD}}>Clear Errors</button>}
            </div>
            {!recentErrors.length ? (
              <div style={{textAlign:'center',padding:28,color:'#9ca3af'}}>
                <div style={{fontSize:28,marginBottom:8}}>✓</div>
                <p style={{fontSize:13,fontWeight:600}}>No errors recorded</p>
              </div>
            ) : (
              <div style={{maxHeight:500,overflowY:'auto'}}>
                {recentErrors.map((err:any,i:number)=>(
                  <div key={i} style={{padding:'10px 12px',marginBottom:6,background:'#fef2f2',borderRadius:8,border:'1px solid #fecaca',fontSize:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontWeight:700,color:'#dc2626'}}>{err.data?.message?.slice(0,100) || 'Unknown error'}</span>
                      <span style={{color:'#9ca3af',fontSize:11,flexShrink:0,marginLeft:8}}>{new Date(err.created_at).toLocaleString()}</span>
                    </div>
                    {err.data?.source && <div style={{color:'#6b7280',fontFamily:'monospace',fontSize:11}}>@ {err.data.source.replace(/^https?:\/\/[^/]+/,'')}:{err.data.line}</div>}
                    {err.data?.stack && <details style={{marginTop:4}}><summary style={{cursor:'pointer',fontSize:11,color:'#9ca3af'}}>Stack trace</summary><pre style={{fontSize:10,color:'#374151',background:'#fff',padding:8,borderRadius:4,overflow:'auto',maxHeight:120,marginTop:4,border:'1px solid #e5e7eb'}}>{err.data.stack}</pre></details>}
                    <div style={{display:'flex',gap:12,marginTop:4,fontSize:11,color:'#9ca3af'}}>
                      <span>{err.device || '?'}</span>
                      {err.data?.url && <span style={{fontFamily:'monospace'}}>{err.data.url.replace(/^https?:\/\/[^/]+/,'')}</span>}
                      {err.data?.type === 'unhandledrejection' && <span style={{background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:4,fontWeight:600}}>Promise</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function RefreshSection() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs]       = useState<any[]>([]);
  const [lastRun, setLastRun] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { cfgGet('refreshLog').then(v=>{ if(v?.logs) setLogs(v.logs); if(v?.lastRun) setLastRun(v.lastRun); setLoading(false); }).catch(()=>setLoading(false)); }, []);
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
    try {
      let q=sb('reviews').select('*',{count:'exact'}).order('created_at',{ascending:false});
      if(search) q=q.ilike('text',`%${search}%`);
      q=q.range(page*PAGE,(page+1)*PAGE-1);
      const {data,count,error}=await q;
      if(error) toast('Load error: '+error.message,'err');
      setRows(data||[]); setTotal(count??0);
    } catch(e:any) {
      toast('Load error: '+(e?.message||'unknown'),'err');
    } finally {
      setLoading(false);
    }
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
  const [newTag,setNewTag]=useState('');
  useEffect(()=>{cfgGet('tagRules').then(v=>{if(v) setRules({...DEF_RULES,...v}); setLoading(false);}).catch(()=>setLoading(false));},[]);
  const save=async()=>{setSaving(true);await cfgSet('tagRules',rules);toast('Saved ✓ — reload app to apply');setSaving(false);};
  const addTag=()=>{const n=newTag.trim();if(!n){toast('Tag name required','err');return;}setRules(r=>({...r,categoryKeywords:{...r.categoryKeywords,[n]:[]}}));setNewTag('');};
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
        <h3 style={{fontSize:14,fontWeight:700}}>Category Keywords</h3>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} placeholder="new tag name" style={{...inp,width:160,padding:'5px 10px'}} />
          <button style={btnS} onClick={addTag}>+ Add</button>
        </div>
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
  const [mapProvider,setMapProvider]=useState<'google'|'apple'|'auto'>('auto');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{cfgGet('siteConfig').then(v=>{if(v){setMsg(v.banner?.message||'');setActive(v.banner?.active??false);setType(v.banner?.type||'info');setMapProvider(v.mapProvider||'auto');}setLoading(false);}).catch(()=>setLoading(false));},[]);
  const save=async()=>{setSaving(true);await cfgSet('siteConfig',{banner:{message:msg,active,type},mapProvider});toast('Saved ✓');setSaving(false);};
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
        <div style={{marginTop:24,paddingTop:20,borderTop:'1px solid #e5e7eb'}}>
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:8}}>Map Provider</h3>
          <p style={{fontSize:12,color:'#9ca3af',marginBottom:12}}>Which map app to open when users tap "Get Directions".</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {([['auto','📍','Auto (iOS→Apple, others→Google)'],['google','🗺️','Google Maps'],['apple','🍎','Apple Maps']] as const).map(([p,icon,label])=>(
              <button key={p} onClick={()=>setMapProvider(p)} style={{padding:'10px 16px',borderRadius:10,border:`2px solid ${mapProvider===p?ACCENT:'#e5e7eb'}`,background:mapProvider===p?ACCENT:'#fff',color:mapProvider===p?'#fff':'#374151',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all 0.15s'}}>
                {icon} {label}
              </button>
            ))}
          </div>
          <p style={{fontSize:11,color:'#9ca3af',marginTop:8}}>💡 "Auto" is recommended — automatically uses Apple Maps on iPhone/iPad and Google Maps everywhere else.</p>
        </div>
        <div style={{marginTop:20}}>
          <button style={{...btnP,opacity:saving?0.7:1}} onClick={save} disabled={saving}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THEME SECTION
// ─────────────────────────────────────────────────────────────────────────────
interface ThemeConfig {
  brand: string;
  brandLight: string;
  accent: string;
  bgScreen: string;
}

const THEME_PRESETS: {name:string;emoji:string;config:ThemeConfig}[] = [
  { name:'Neon Moss',    emoji:'🌿', config:{ brand:'#566500', brandLight:'#8a9e00', accent:'#D4EF4D', bgScreen:'#F8FAF8' } },
  { name:'Terracotta',   emoji:'🏔️', config:{ brand:'#a03b00', brandLight:'#c4622d', accent:'#ff9a6c', bgScreen:'#f5f0ed' } },
  { name:'Electric Blue',emoji:'⚡', config:{ brand:'#0057c2', brandLight:'#1C6FEA', accent:'#93c5fd', bgScreen:'#f0f6ff' } },
  { name:'Desert Purple',emoji:'💜', config:{ brand:'#5b21b6', brandLight:'#7c3aed', accent:'#c4b5fd', bgScreen:'#f5f3ff' } },
  { name:'Sandstone',    emoji:'🌸', config:{ brand:'#9d174d', brandLight:'#db2777', accent:'#fbcfe8', bgScreen:'#fdf2f8' } },
  { name:'Forest Teal',  emoji:'🌲', config:{ brand:'#065f46', brandLight:'#059669', accent:'#6ee7b7', bgScreen:'#f0fdf4' } },
];

function applyThemePreview(cfg: ThemeConfig) {
  const root = document.documentElement;
  root.style.setProperty('--brand', cfg.brand);
  root.style.setProperty('--brand-light', cfg.brandLight);
  root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${cfg.brand} 0%, ${cfg.brandLight} 100%)`);
  root.style.setProperty('--brand-bg-screen', cfg.bgScreen);
  root.style.setProperty('--brand-bg-subtle', cfg.brand + '1a');
  root.style.setProperty('--brand-tint-bg', cfg.accent + '26');
  root.style.setProperty('--brand-tint-border', cfg.accent + '80');
  root.style.setProperty('--brand-ring-color', cfg.accent);
}

function ThemeSection() {
  const DEF: ThemeConfig = THEME_PRESETS[0].config;
  const [cfg, setCfg] = useState<ThemeConfig>(DEF);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('Neon Moss');

  useEffect(()=>{
    cfgGet('themeConfig').then(v=>{
      if(v?.brand){
        setCfg(v as ThemeConfig);
        applyThemePreview(v as ThemeConfig);
        const match = THEME_PRESETS.find(p=>p.config.brand===v.brand);
        setActivePreset(match?.name||'Custom');
      }
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setCfg(preset.config);
    setActivePreset(preset.name);
    applyThemePreview(preset.config);
  };

  const handleColorChange = (key: keyof ThemeConfig, val: string) => {
    const next = {...cfg,[key]:val};
    setCfg(next);
    setActivePreset('Custom');
    applyThemePreview(next);
  };

  const save = async () => {
    setSaving(true);
    await cfgSet('themeConfig', cfg);
    applyThemePreview(cfg);
    toast('Theme saved ✓ — live on next app load');
    setSaving(false);
  };

  if(loading) return <p style={{textAlign:'center',color:'#9ca3af',padding:40}}>Loading…</p>;

  return (
    <div>
      <SectionHeader title="Theme & Colors" sub="Customize the app's brand color scheme — changes apply live on next visitor load" />

      {/* Preset grid */}
      <div style={{...card,maxWidth:600,marginBottom:24}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:6}}>Preset Themes</h3>
        <p style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>Click a preset to preview instantly. Save to make it permanent.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
          {THEME_PRESETS.map(p=>(
            <button key={p.name} onClick={()=>applyPreset(p)}
              style={{padding:'12px 14px',border:`2px solid ${activePreset===p.name?ACCENT:'#e5e7eb'}`,borderRadius:10,background:activePreset===p.name?'#fff7ed':'#fff',cursor:'pointer',textAlign:'left',transition:'all 0.15s',boxShadow:activePreset===p.name?`0 0 0 2px ${ACCENT}`:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>{p.emoji}</span>
                <span style={{fontSize:13,fontWeight:700,color:'#18181b'}}>{p.name}</span>
                {activePreset===p.name && <span style={{marginLeft:'auto',fontSize:10,fontWeight:800,color:ACCENT}}>✓ Active</span>}
              </div>
              <div style={{display:'flex',gap:4}}>
                {[p.config.brand,p.config.brandLight,p.config.accent].map((c,i)=>(
                  <div key={i} style={{width:20,height:20,borderRadius:4,background:c,border:'1px solid rgba(0,0,0,0.1)'}} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom color pickers */}
      <div style={{...card,maxWidth:520,marginBottom:24}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:6}}>Custom Colors</h3>
        <p style={{fontSize:12,color:'#9ca3af',marginBottom:16}}>Fine-tune individual colors. Preview updates instantly.</p>
        {([
          ['brand',      'Primary Brand Color',   'Main buttons, links, active states'],
          ['brandLight', 'Secondary Brand Color',  'Hover states, gradients'],
          ['accent',     'Accent / Highlight Color','Badges, tags, rings'],
          ['bgScreen',   'Background Color',        'App background tint'],
        ] as [keyof ThemeConfig,string,string][]).map(([key,label,hint])=>(
          <div key={key} style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,padding:'10px 12px',border:'1px solid #f3f4f6',borderRadius:8,background:'#fafafa'}}>
            <input type="color" value={cfg[key]} onChange={e=>handleColorChange(key,e.target.value)}
              style={{width:44,height:44,padding:2,border:'2px solid #e5e7eb',borderRadius:8,cursor:'pointer',background:'#fff'}} />
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#18181b'}}>{label}</div>
              <div style={{fontSize:11,color:'#9ca3af'}}>{hint}</div>
            </div>
            <code style={{fontSize:11,background:'#f3f4f6',padding:'3px 7px',borderRadius:4,color:'#374151',fontFamily:'monospace'}}>{cfg[key]}</code>
          </div>
        ))}
      </div>

      {/* Preview swatch */}
      <div style={{...card,maxWidth:520,marginBottom:24}}>
        <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>Live Preview</h3>
        <div style={{background:cfg.bgScreen,border:'2px solid #1a1a1a',borderRadius:8,padding:16,boxShadow:'4px 4px 0 #1a1a1a'}}>
          <div style={{background:`linear-gradient(135deg,${cfg.brand},${cfg.brandLight})`,borderRadius:6,padding:'14px 18px',marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:cfg.accent,marginBottom:4}}>✦ Your City, Unplugged</div>
            <div style={{fontFamily:'Epilogue,sans-serif',fontWeight:900,fontSize:18,color:'#fff',lineHeight:1.1}}>Find Something<br/>Worth Leaving<br/>the House For</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <div style={{padding:'8px 14px',background:cfg.accent,border:'2px solid #1a1a1a',boxShadow:'2px 2px 0 #1a1a1a',fontSize:10,fontWeight:800,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',color:'#1a1a1a'}}>Browse Events</div>
            <div style={{padding:'8px 14px',background:cfg.brand,border:`2px solid ${cfg.brand}`,fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',cursor:'pointer',color:'#fff'}}>Browse Places</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:520}}>
        <button style={{...btnP,opacity:saving?0.7:1}} onClick={save} disabled={saving}>
          {saving?'Saving…':'💾 Save Theme'}
        </button>
        <p style={{fontSize:11,color:'#9ca3af',marginTop:8}}>Saved themes take effect for all users on their next page load.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────
interface FeedbackItem {
  id: string;
  url?: string | null;
  context_type?: string | null;
  context_id?: string | null;
  context_name?: string | null;
  category: string;
  message: string;
  user_email?: string | null;
  name?: string | null;
  email?: string | null;
  created_at: string;
  status?: 'new' | 'in-review' | 'resolved' | 'dismissed';
  admin_notes?: string | null;
  session_id?: string | null;
  device?: string | null;
  page?: string | null;
}

function FeedbackSection() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let data: any[] = [];
      const { data: fbData } = await sb('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (fbData) data = fbData;
      if (!data.length) {
        const { data: ufData } = await sb('user_feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (ufData) data = ufData;
      }
      setItems(data as FeedbackItem[]);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    try {
      await sb('feedback').delete().eq('id', id);
    } catch {
      await sb('user_feedback').delete().eq('id', id);
    }
    setItems(p => p.filter(i => i.id !== id));
    toast('Deleted');
    setConfirm(null);
  };

  const updateFeedback = async (id: string, status: string, notes: string) => {
    try {
      await sb('feedback').update({ status, admin_notes: notes }).eq('id', id);
    } catch {
      await sb('user_feedback').update({ status, admin_notes: notes }).eq('id', id);
    }
    setItems(p => p.map(i => i.id === id ? { ...i, status: status as any, admin_notes: notes } : i));
    toast('Updated ✓');
    setEditingId(null);
  };

  const catColor = (c: string) => c === 'bug' ? '#dc2626' : c === 'suggestion' ? '#2563eb' : c === 'compliment' ? '#059669' : '#6b7280';
  const catBg = (c: string) => c === 'bug' ? '#fee2e2' : c === 'suggestion' ? '#dbeafe' : c === 'compliment' ? '#d1fae5' : '#f3f4f6';
  const catLabel = (c: string) => c === 'bug' ? '🐛 Bug' : c === 'suggestion' ? '💡 Suggestion' : c === 'compliment' ? '🌟 Compliment' : '💬 General';

  const CATS = ['all', 'bug', 'suggestion', 'compliment', 'general'];
  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  const counts: Record<string, number> = {};
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1;

  return (
    <div>
      {confirm && <Confirm msg="Delete this feedback entry?" onOk={() => del(confirm)} onCancel={() => setConfirm(null)} />}
      <SectionHeader
        title="User Feedback"
        sub={`${items.length} submissions`}
        action={<button style={btnS} onClick={load}>↻ Refresh</button>}
      />

      {/* Summary chips */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
        {CATS.map(c => {
          const cnt = c === 'all' ? items.length : (counts[c] || 0);
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                border: `2px solid ${filter === c ? catColor(c) : '#e5e7eb'}`,
                background: filter === c ? catBg(c) : '#fff',
                color: filter === c ? catColor(c) : '#6b7280',
                cursor: 'pointer',
              }}
            >
              {c === 'all' ? `All (${cnt})` : `${catLabel(c)} (${cnt})`}
            </button>
          );
        })}
      </div>

      {loading ? <p style={{textAlign:'center',color:'#9ca3af',padding:48}}>Loading…</p> : !filtered.length ? (
        <div style={{...card,textAlign:'center',padding:48,color:'#9ca3af'}}>
          <div style={{fontSize:36,marginBottom:12}}>💬</div>
          <p style={{fontWeight:600}}>No feedback yet</p>
          <p style={{fontSize:13,marginTop:6}}>Feedback from the app will appear here</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {filtered.map(item => (
            <div key={item.id} style={{...card,padding:'16px 18px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:10}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:999,background:catBg(item.category),color:catColor(item.category)}}>
                    {catLabel(item.category)}
                  </span>
                  {item.status && (
                    <span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:999,background:item.status==='resolved'?'#d1fae5':item.status==='in-review'?'#fef3c7':item.status==='dismissed'?'#f3f4f6':'#dbeafe',color:item.status==='resolved'?'#065f46':item.status==='in-review'?'#92400e':item.status==='dismissed'?'#6b7280':'#1e40af'}}>
                      {item.status===('new' as any)?'🆕 New':item.status==='in-review'?'👀 In Review':item.status==='resolved'?'✓ Resolved':'✕ Dismissed'}
                    </span>
                  )}
                  {item.context_type && (
                    <span style={{fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:999,background:'#f3f4f6',color:'#374151'}}>
                      {item.context_type === 'place' ? '📍' : item.context_type === 'event' ? '🎫' : '🌐'} {item.context_name || item.context_id || item.context_type}
                    </span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <span style={{fontSize:11,color:'#9ca3af',whiteSpace:'nowrap'}}>{new Date(item.created_at).toLocaleDateString()}</span>
                  <button onClick={() => { setEditingId(item.id); setEditStatus(item.status || 'new'); setEditNotes(item.admin_notes || ''); }} style={{...btnS,fontSize:11,padding:'3px 7px'}}>Edit</button>
                  <button onClick={() => setConfirm(item.id)} style={btnD}>×</button>
                </div>
              </div>
              <p style={{fontSize:14,color:'#1a1a1a',lineHeight:1.6,margin:'0 0 10px',wordBreak:'break-word'}}>{item.message}</p>
              {item.admin_notes && (
                <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:6,padding:'8px 10px',marginBottom:10,fontSize:12,color:'#374151'}}>
                  <span style={{fontWeight:600,color:'#6b7280'}}>📝 Admin notes: </span>{item.admin_notes}
                </div>
              )}
              <div style={{display:'flex',flexWrap:'wrap',gap:12,fontSize:11,color:'#9ca3af',borderTop:'1px solid #f3f4f6',paddingTop:8}}>
                {(item.url || item.page) && (
                  <span style={{fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:260}}>
                    🔗 {(item.page || item.url || '').replace(/^https?:\/\/[^/]+/,'')}
                  </span>
                )}
                {(item.user_email || item.email || item.name) && <span>✉️ {item.email || item.user_email || item.name}</span>}
                {item.device && <span>📱 {item.device}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditingId(null);}}>
          <div style={{background:'#fff',borderRadius:14,padding:28,maxWidth:420,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
            <h3 style={{fontSize:16,fontWeight:800,color:'#18181b',margin:'0 0 16px'}}>Update Feedback Status</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={lbl}>Status</label><select value={editStatus} onChange={e=>setEditStatus(e.target.value)} style={inp}>
                <option value="new">New</option><option value="in-review">In Review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
              </select></div>
              <div><label style={lbl}>Admin Notes</label><textarea value={editNotes} onChange={e=>setEditNotes(e.target.value)} style={{...inp,minHeight:80,resize:'vertical'}} placeholder="Internal notes about this feedback…" /></div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button style={btnS} onClick={()=>setEditingId(null)}>Cancel</button>
                <button style={btnP} onClick={()=>updateFeedback(editingId,editStatus,editNotes)}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR NAV
// ─────────────────────────────────────────────────────────────────────────────
const NAV: {id:AdminSection;label:string;icon:string;group:string}[] = [
  {id:'dashboard', label:'Dashboard',        icon:'◼',  group:'Overview'},
  {id:'analytics', label:'Analytics',        icon:'📊', group:'Overview'},
  {id:'feedback',  label:'Feedback',         icon:'💬', group:'Overview'},
  {id:'banners',   label:'Banners',          icon:'📢', group:'Content'},
  {id:'events',    label:'Events',           icon:'🎫', group:'Content'},
  {id:'places',    label:'Places',           icon:'📍', group:'Content'},
  {id:'categories',label:'Categories',       icon:'🏷️', group:'Content'},
  {id:'content',   label:'Content Sections', icon:'✏️', group:'Content'},
  {id:'reviews',   label:'Reviews',          icon:'⭐', group:'Content'},
  {id:'refresh',   label:'Data Refresh',     icon:'🔄', group:'Tools'},
  {id:'tagrules',  label:'Tag Rules',        icon:'🔖', group:'Tools'},
  {id:'bulkimport',label:'Bulk Import',      icon:'📋', group:'Tools'},
  {id:'settings',  label:'Settings',         icon:'⚙️', group:'Tools'},
  {id:'theme',     label:'Theme & Colors',   icon:'🎨', group:'Tools'},
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

  const tryPw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PW) {
      // Sign in to Supabase with the admin credentials to get a real session
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: ADMIN_PW,
        });
        if (error) {
          // Fallback: allow local access even if Supabase user doesn't exist
          localStorage.setItem(PW_EXP_KEY, String(Date.now() + PW_TTL));
          setPwUnlocked(true);
          setPwError('');
          toast('Admin access granted (local mode)', 'info');
        } else {
          localStorage.setItem(PW_EXP_KEY, String(Date.now() + PW_TTL));
          setPwUnlocked(true);
          setPwError('');
          toast('Admin access granted ✓', 'ok');
        }
      } catch (err: any) {
        // Fallback to local unlock
        localStorage.setItem(PW_EXP_KEY, String(Date.now() + PW_TTL));
        setPwUnlocked(true);
        setPwError('');
      }
    } else { setPwError('Incorrect password.'); setTimeout(()=>setPwError(''),3000); }
  };



  const logout = () => { localStorage.removeItem(PW_EXP_KEY); setPwUnlocked(false); };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError,   setGoogleError]   = useState('');

  const signInWithGoogle = async () => {
    setGoogleLoading(true); setGoogleError('');
    // After OAuth redirect, App.tsx will see this flag and navigate to #admin
    sessionStorage.setItem('abq_post_auth_redirect', 'admin');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setGoogleError(error.message); setGoogleLoading(false); }
  };

  // If a Google-authed user is present but their email doesn't match, show a clear message
  const wrongAccount = user && user.email !== ADMIN_EMAIL;

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

        {/* Google sign-in — primary method */}
        {wrongAccount ? (
          <div style={{background:'#fee2e2',color:'#dc2626',borderRadius:10,padding:'12px 14px',fontSize:13,marginBottom:16,fontWeight:600,textAlign:'center'}}>
            ⛔ {user.email} is not an admin account.<br/>
            <button onClick={()=>supabase.auth.signOut()} style={{marginTop:8,background:'none',border:'none',color:'#dc2626',cursor:'pointer',textDecoration:'underline',fontSize:12}}>Sign out and try again</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} disabled={googleLoading} style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,
            padding:'11px 16px',borderRadius:10,border:'1.5px solid #e5e7eb',background:'#fff',
            cursor:googleLoading?'wait':'pointer',fontSize:15,fontWeight:700,color:'#18181b',
            boxShadow:'0 1px 3px rgba(0,0,0,0.08)',marginBottom:14,transition:'box-shadow 0.15s',
          }}>
            {googleLoading ? '…' : (
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.6-17.7 11.7z"/><path fill="#FBBC05" d="M24 45c5.9 0 11-2 14.7-5.4l-6.8-5.6C29.8 35.9 27 37 24 37c-6.1 0-10.7-4.1-11.8-9.5l-7 5.4C8 39.8 15.3 45 24 45z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.7 4.8-5 6.2l6.8 5.6C41.5 36.6 45 30.8 45 24c0-1.3-.2-2.7-.5-4z"/></svg>
            )}
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>
        )}
        {googleError && <div style={{background:'#fee2e2',color:'#dc2626',borderRadius:8,padding:'8px 12px',fontSize:13,marginBottom:12,fontWeight:600}}>{googleError}</div>}

        {/* Divider */}
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'4px 0 16px'}}>
          <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
          <span style={{fontSize:12,color:'#9ca3af',fontWeight:600}}>or use password</span>
          <div style={{flex:1,height:1,background:'#e5e7eb'}}/>
        </div>

        <form onSubmit={tryPw}>
          <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} style={{...inp,marginBottom:10,fontSize:15}} placeholder="Admin password" />
          {pwError&&<div style={{background:'#fee2e2',color:'#dc2626',borderRadius:8,padding:'8px 12px',fontSize:13,marginBottom:10,fontWeight:600}}>{pwError}</div>}
          <button type="submit" style={{...btnP,width:'100%',padding:'11px',fontSize:15}}>Sign In</button>
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
      <div style={{flex:1,overflowY:'auto',maxHeight:isMobile?'100vh':'100vh',paddingBottom:isMobile?64:0}}>
        {/* Mobile header */}
        {isMobile&&(
          <div style={{position:'sticky',top:0,background:SIDEBAR_BG,color:'#fff',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,zIndex:100}}>
            <button onClick={()=>setSideOpen(true)} style={{background:'none',border:'none',color:'#fff',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1}}>☰</button>
            <div style={{fontWeight:700,fontSize:15}}>ABQ Admin — {NAV.find(n=>n.id===section)?.label}</div>
          </div>
        )}
        <div style={{maxWidth:1100,margin:'0 auto',padding:isMobile?'20px 16px':'32px 36px'}}>
          <AdminErrorBoundary section={section} key={section}>
            {section==='dashboard'  && <DashboardSection onNav={setSection} />}
            {section==='analytics'  && <AnalyticsSection />}
            {section==='feedback'   && <FeedbackSection />}
            {section==='banners'    && <BannersSection />}
            {section==='events'     && <EventsSection />}
            {section==='places'     && <PlacesSection />}
            {section==='categories' && <CategoriesSection />}
            {section==='content'    && <ContentSection />}
            {section==='reviews'    && <ReviewsSection />}
            {section==='refresh'    && <RefreshSection />}
            {section==='tagrules'   && <TagRulesSection />}
            {section==='bulkimport' && <BulkImportSection />}
            {section==='settings'   && <SettingsSection />}
            {section==='theme'      && <ThemeSection />}
          </AdminErrorBoundary>
        </div>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <div style={{position:'fixed',bottom:0,left:0,right:0,background:SIDEBAR_BG,borderTop:'1px solid rgba(255,255,255,0.1)',display:'flex',justifyContent:'space-around',zIndex:150,paddingBottom:'max(env(safe-area-inset-bottom), 0px)'}}>
            {[
              {id:'dashboard' as AdminSection, label:'Home', icon:'◼'},
              {id:'events' as AdminSection, label:'Events', icon:'🎫'},
              {id:'places' as AdminSection, label:'Places', icon:'📍'},
              {id:'analytics' as AdminSection, label:'Data', icon:'📊'},
              {id:'feedback' as AdminSection, label:'Feedback', icon:'💬'},
            ].map(item => (
              <button
                key={item.id}
                onClick={() => navTo(item.id)}
                style={{
                  flex:1,
                  padding:'8px 0',
                  border:'none',
                  background:'transparent',
                  color:section===item.id?ACCENT:'rgba(255,255,255,0.5)',
                  cursor:'pointer',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  gap:'2px',
                  fontSize:9,
                  fontWeight:section===item.id?700:500,
                  transition:'color 0.15s',
                }}
              >
                <span style={{fontSize:16}}>{item.icon}</span>
                <span style={{lineHeight:1}}>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
