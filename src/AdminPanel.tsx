import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = '#8B3A0F';
const SIDEBAR_BG = '#18181b';
const SIDEBAR_W = 230;
const ADMIN_PW = 'abqadmin2025';
const PW_EXP_KEY = 'abq_admin_pw_exp';
const PW_TTL = 24 * 60 * 60 * 1000; // 24h

const PLACE_CATS = ['restaurant','bar','coffee','park','museum','shop','entertainment','outdoor','arts','fitness','hotel','other'];
const PLACE_TAGS = ['outdoor','indoor','family-friendly','dog-friendly','live-music','date-night','free','kid-friendly','accessible','patio','late-night','brunch','art','nature','hiking','sports'];
const EVENT_TAGS = ['outdoor','indoor','family-friendly','free','live-music','sports','art','comedy','festival','dance','film','food','kids','nightlife','theater'];

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const sb = (table: string) => (supabase.from as any)(table);

async function cfgGet(key: string): Promise<any> {
  const { data } = await sb('config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}
async function cfgSet(key: string, value: any): Promise<void> {
  await sb('config').upsert({ key, value });
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type AdminSection =
  | 'dashboard' | 'banners' | 'events' | 'places'
  | 'categories' | 'content' | 'refresh' | 'reviews'
  | 'tagrules' | 'settings';

interface Banner {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'promo';
  startDate: string;
  endDate: string;
  linkUrl: string;
  linkText: string;
  active: boolean;
}

interface EventRow {
  _rowid?: string | number;
  id: string;
  source: string;
  event_date: string;
  raw: any;
  hidden?: boolean;
  featured?: boolean;
}

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  address?: string;
  description?: string;
  image?: string;
  website?: string;
  phone?: string;
  hours?: string;
  tags?: string[];
  isFeatured?: boolean;
  rating?: number;
  raw?: any;
}

interface ReviewRow {
  id: string;
  place_id?: string;
  placeId?: string;
  user_name?: string;
  userName?: string;
  rating?: number;
  text?: string;
  created_at?: string;
  flagged?: boolean;
}

interface TagRulesConfig {
  outdoorKeywords: string[];
  indoorKeywords: string[];
  categoryKeywords: Record<string, string[]>;
}

// ─── Global toast singleton ───────────────────────────────────────────────────
type ToastT = { id: number; msg: string; kind: 'ok' | 'err' | 'info' };
let _toastSet: React.Dispatch<React.SetStateAction<ToastT[]>> | null = null;
const toast = (msg: string, kind: ToastT['kind'] = 'ok') => {
  if (!_toastSet) return;
  const id = Date.now() + Math.random();
  _toastSet(prev => [...prev, { id, msg, kind }]);
  setTimeout(() => _toastSet!(prev => prev.filter(t => t.id !== id)), 3500);
};

function Toaster() {
  const [items, set] = useState<ToastT[]>([]);
  _toastSet = set;
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 99999, display: 'flex', flexDirection: 'column-reverse', gap: 8, pointerEvents: 'none' }}>
      {items.map(t => (
        <div key={t.id} style={{
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#fff',
          background: t.kind === 'ok' ? '#059669' : t.kind === 'err' ? '#dc2626' : '#2563eb',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', pointerEvents: 'auto',
          animation: 'fadein 0.18s ease',
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function Confirm({ msg, onOk, onCancel }: { msg: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 20, lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={onOk} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#fafafa', outline: 'none' };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' };
const btnP: React.CSSProperties = { padding: '8px 18px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 };
const btnS: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 };
const btnD: React.CSSProperties = { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', background: '#f8f9fa', borderBottom: '2px solid #e5e7eb', fontWeight: 700, fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' };
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#18181b', margin: 0, letterSpacing: '-0.4px' }}>{title}</h1>
        {sub && <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Tag pill ─────────────────────────────────────────────────────────────────
function TagPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
      border: '1px solid ' + (active ? ACCENT : '#e5e7eb'),
      background: active ? ACCENT : '#fff', color: active ? '#fff' : '#374151',
    }}>{label}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DASHBOARD ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function DashboardSection({ onNav }: { onNav: (s: AdminSection) => void }) {
  const [stats, setStats] = useState({ events: 0, places: 0, banners: 0, reviews: 0 });
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [evRes, plRes, rvRes, cfg] = await Promise.all([
        sb('events').select('id', { count: 'exact', head: true }),
        sb('places').select('id', { count: 'exact', head: true }),
        sb('reviews').select('id', { count: 'exact', head: true }),
        cfgGet('banners'),
      ]);
      const bannerArr: Banner[] = cfg || [];
      const active = bannerArr.filter(b => b.active).length;
      setStats({ events: evRes.count ?? 0, places: plRes.count ?? 0, banners: active, reviews: rvRes.count ?? 0 });
      const refreshLog = await cfgGet('refreshLog');
      if (refreshLog?.lastRun) setLastRefresh(refreshLog.lastRun);
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: 'Total Events', val: stats.events, icon: '🎫', color: '#8B3A0F', sec: 'events' as AdminSection },
    { label: 'Total Places', val: stats.places, icon: '📍', color: '#1d4ed8', sec: 'places' as AdminSection },
    { label: 'Active Banners', val: stats.banners, icon: '📢', color: '#059669', sec: 'banners' as AdminSection },
    { label: 'Reviews', val: stats.reviews, icon: '⭐', color: '#7c3aed', sec: 'reviews' as AdminSection },
  ];

  return (
    <div>
      <SectionHeader title="Dashboard" sub="Overview of your ABQ Unplugged content" />

      {loading ? <p style={{ color: '#9ca3af', padding: 40, textAlign: 'center' }}>Loading stats…</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
            {cards.map(c => (
              <button key={c.label} onClick={() => onNav(c.sec)} style={{ ...card, cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.15s' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color, letterSpacing: '-1px' }}>{c.val.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, marginTop: 4 }}>{c.label}</div>
              </button>
            ))}
          </div>

          {lastRefresh && (
            <div style={{ ...card, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, background: '#fffbeb', borderColor: '#fde68a' }}>
              <span style={{ fontSize: 20 }}>🔄</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Last data refresh</div>
                <div style={{ fontSize: 12, color: '#b45309' }}>{new Date(lastRefresh).toLocaleString()}</div>
              </div>
            </div>
          )}

          <div style={{ ...card }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 16 }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {([
                { label: '+ Add Event', sec: 'events' as AdminSection, color: ACCENT },
                { label: '+ Add Place', sec: 'places' as AdminSection, color: '#1d4ed8' },
                { label: '📢 Post Banner', sec: 'banners' as AdminSection, color: '#059669' },
                { label: '🔄 Refresh Data', sec: 'refresh' as AdminSection, color: '#7c3aed' },
              ] as {label:string;sec:AdminSection;color:string}[]).map(a => (
                <button key={a.label} onClick={() => onNav(a.sec)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: a.color, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>{a.label}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── BANNERS ──────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_BANNER: Banner = { id: '', message: '', type: 'info', startDate: '', endDate: '', linkUrl: '', linkText: '', active: false };

function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    cfgGet('banners').then(v => { setBanners(v || []); setLoading(false); });
  }, []);

  const save = async (list: Banner[]) => {
    setBanners(list);
    await cfgSet('banners', list);
  };

  const upsertBanner = async () => {
    if (!editing) return;
    if (!editing.message.trim()) { toast('Message is required', 'err'); return; }
    setSaving(true);
    const updated = editing.id
      ? banners.map(b => b.id === editing.id ? editing : b)
      : [...banners, { ...editing, id: Date.now().toString() }];
    await save(updated);
    setEditing(null);
    toast(editing.id ? 'Banner updated ✓' : 'Banner created ✓');
    setSaving(false);
  };

  const deleteBanner = async (id: string) => {
    await save(banners.filter(b => b.id !== id));
    toast('Banner deleted');
    setConfirm(null);
  };

  const toggleActive = async (id: string) => {
    const updated = banners.map(b => b.id === id ? { ...b, active: !b.active } : b);
    await save(updated);
    toast('Updated');
  };

  const bannerPreviewStyle = (b: Banner): React.CSSProperties => ({
    padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: b.type === 'warning' ? '#fef3c7' : b.type === 'promo' ? '#fce7f3' : '#dbeafe',
    color: b.type === 'warning' ? '#92400e' : b.type === 'promo' ? '#9d174d' : '#1e40af',
    border: `1px solid ${b.type === 'warning' ? '#fcd34d' : b.type === 'promo' ? '#fbcfe8' : '#bfdbfe'}`,
  });

  const now = new Date().toISOString().split('T')[0];
  const activeBanners = banners.filter(b => b.active && (!b.endDate || b.endDate >= now) && (!b.startDate || b.startDate <= now));
  const scheduledBanners = banners.filter(b => b.active && b.startDate > now);
  const pastBanners = banners.filter(b => b.endDate && b.endDate < now);

  return (
    <div>
      <SectionHeader
        title="Banner Management"
        sub="Site-wide announcement banners — auto-show/hide by date"
        action={<button style={btnP} onClick={() => setEditing({ ...EMPTY_BANNER })}>+ New Banner</button>}
      />
      {loading ? <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Loading…</p> : (
        <>
          {editing && (
            <div style={{ ...card, marginBottom: 24, border: `2px solid ${ACCENT}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: '#18181b' }}>{editing.id ? 'Edit Banner' : 'New Banner'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                <div>
                  <label style={fieldLabel}>Message *</label>
                  <textarea value={editing.message} onChange={e => setEditing(v => v && ({ ...v, message: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. Balloon Fiesta is this weekend! Check the Events tab." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={fieldLabel}>Type</label>
                    <select value={editing.type} onChange={e => setEditing(v => v && ({ ...v, type: e.target.value as Banner['type'] }))} style={{ ...inp }}>
                      <option value="info">ℹ️ Info</option>
                      <option value="warning">⚠️ Warning</option>
                      <option value="promo">🎉 Promo</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                      <input type="checkbox" checked={editing.active} onChange={e => setEditing(v => v && ({ ...v, active: e.target.checked }))} style={{ width: 18, height: 18 }} />
                      Active (visible to users)
                    </label>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={fieldLabel}>Start Date</label>
                    <input type="date" value={editing.startDate} onChange={e => setEditing(v => v && ({ ...v, startDate: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={fieldLabel}>End Date</label>
                    <input type="date" value={editing.endDate} onChange={e => setEditing(v => v && ({ ...v, endDate: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={fieldLabel}>Link URL (optional)</label>
                    <input value={editing.linkUrl} onChange={e => setEditing(v => v && ({ ...v, linkUrl: e.target.value }))} style={inp} placeholder="https://..." />
                  </div>
                  <div>
                    <label style={fieldLabel}>Link Text (optional)</label>
                    <input value={editing.linkText} onChange={e => setEditing(v => v && ({ ...v, linkText: e.target.value }))} style={inp} placeholder="Learn more" />
                  </div>
                </div>
                {editing.message && (
                  <div>
                    <label style={fieldLabel}>Preview</label>
                    <div style={bannerPreviewStyle(editing)}>
                      {editing.message}
                      {editing.linkUrl && editing.linkText && <span style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer' }}>{editing.linkText}</span>}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={btnS} onClick={() => setEditing(null)}>Cancel</button>
                  <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={upsertBanner} disabled={saving}>{saving ? 'Saving…' : editing.id ? 'Update Banner' : 'Create Banner'}</button>
                </div>
              </div>
            </div>
          )}

          {['Active', 'Scheduled', 'Past', 'Draft'].map(group => {
            const list =
              group === 'Active' ? activeBanners :
              group === 'Scheduled' ? scheduledBanners :
              group === 'Past' ? pastBanners :
              banners.filter(b => !b.active && (!b.endDate || b.endDate >= now));
            if (!list.length) return null;
            return (
              <div key={group} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{group}</h3>
                {list.map(b => (
                  <div key={b.id} style={{ ...card, marginBottom: 10, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={bannerPreviewStyle(b)}>{b.message}{b.linkUrl && b.linkText && <span style={{ marginLeft: 8, textDecoration: 'underline' }}>{b.linkText}</span>}</div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                        <span>Type: <strong>{b.type}</strong></span>
                        {b.startDate && <span>Start: {b.startDate}</span>}
                        {b.endDate && <span>End: {b.endDate}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => toggleActive(b.id)} style={{ ...btnS, fontSize: 12, padding: '5px 12px', color: b.active ? '#059669' : '#6b7280', fontWeight: 700 }}>{b.active ? 'Live' : 'Off'}</button>
                      <button onClick={() => setEditing({ ...b })} style={{ ...btnS, fontSize: 12, padding: '5px 12px' }}>Edit</button>
                      <button onClick={() => setConfirm(b.id)} style={btnD}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {!banners.length && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>No banners yet. Create one to show a site-wide announcement.</p>}
        </>
      )}
      {confirm && <Confirm msg="Delete this banner permanently?" onOk={() => deleteBanner(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── EVENTS ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 50;
const EMPTY_EVENT = { id: '', name: '', date: '', time: '', venue: '', description: '', imageUrl: '', category: 'Music', tags: [] as string[], ticketUrl: '', source: 'manual', is21Plus: false };

function EventsSection() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterSrc, setFilterSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof EMPTY_EVENT | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb('events').select('*', { count: 'exact' }).order('event_date', { ascending: true });
    if (search) q = q.ilike('raw->>name', `%${search}%`);
    if (filterSrc) q = q.eq('source', filterSrc);
    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setRows((data || []).map((r: any) => ({ ...r, _rowid: r.id })));
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, filterSrc]);

  useEffect(() => { load(); }, [load]);

  const getEventName = (r: EventRow) => {
    try { const raw = typeof r.raw === 'string' ? JSON.parse(r.raw) : r.raw; return raw?.name || '—'; } catch { return '—'; }
  };
  const getEventVenue = (r: EventRow) => {
    try { const raw = typeof r.raw === 'string' ? JSON.parse(r.raw) : r.raw; return raw?._embedded?.venues?.[0]?.name || raw?.venue || '—'; } catch { return '—'; }
  };

  const deleteEvent = async (id: string) => {
    await sb('events').delete().eq('id', id);
    toast('Event deleted');
    setConfirm(null);
    load();
  };

  const hideEvent = async (id: string) => {
    await sb('events').update({ hidden: true }).eq('id', id);
    toast('Event hidden');
    load();
  };

  const featureEvent = async (row: EventRow) => {
    await sb('events').update({ featured: !row.featured }).eq('id', row.id);
    toast(row.featured ? 'Removed from spotlight' : 'Marked as spotlight ✓');
    load();
  };

  const saveNewEvent = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.date) { toast('Name and date are required', 'err'); return; }
    const rawData = {
      id: 'manual-' + Date.now(),
      name: editing.name,
      url: editing.ticketUrl || undefined,
      _source: 'manual',
      dates: { start: { localDate: editing.date, localTime: editing.time || undefined } },
      _embedded: { venues: [{ name: editing.venue }] },
      classifications: editing.category ? [{ segment: { name: editing.category } }] : undefined,
    };
    await sb('events').insert({ source: 'manual', event_date: editing.date, raw: rawData });
    toast('Event added ✓');
    setEditing(null);
    load();
  };

  const handleBulk = async () => {
    if (!selected.size || !bulkAction) return;
    const ids = Array.from(selected);
    if (bulkAction === 'hide') {
      for (const id of ids) await sb('events').update({ hidden: true }).eq('id', id);
      toast(`${ids.length} events hidden`);
    } else if (bulkAction === 'delete') {
      for (const id of ids) await sb('events').delete().eq('id', id);
      toast(`${ids.length} events deleted`);
    }
    setSelected(new Set());
    setBulkAction('');
    load();
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const sources = ['', 'ticketmaster', 'seatgeek', 'bandsintown', 'musicbrainz', 'manual'];

  return (
    <div>
      <SectionHeader
        title="Events"
        sub={`${total.toLocaleString()} total events in database`}
        action={<button style={btnP} onClick={() => setEditing({ ...EMPTY_EVENT })}>+ Add Event</button>}
      />

      {/* Add event form */}
      {editing && (
        <div style={{ ...card, marginBottom: 24, border: `2px solid ${ACCENT}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>New Manual Event</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([['name','Event Name *'],['date','Date *'],['time','Time'],['venue','Venue'],['ticketUrl','Ticket URL'],['imageUrl','Image URL'],['category','Category'],['source','Source']] as [string,string][]).map(([k,l]) => (
              <div key={k}>
                <label style={fieldLabel}>{l}</label>
                {k === 'category' ? (
                  <select value={(editing as any)[k]} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} style={inp}>
                    {['Music','Sports','Arts','Food','Family','Comedy','Festival','Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                ) : k === 'date' ? (
                  <input type="date" value={(editing as any)[k]} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} style={inp} />
                ) : k === 'time' ? (
                  <input type="time" value={(editing as any)[k]} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} style={inp} />
                ) : (
                  <input value={(editing as any)[k]} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} style={inp} />
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={fieldLabel}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EVENT_TAGS.map(t => <TagPill key={t} label={t} active={editing.tags.includes(t)} onClick={() => setEditing(v => v && { ...v, tags: v.tags.includes(t) ? v.tags.filter(x => x !== t) : [...v.tags, t] })} />)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={editing.is21Plus} onChange={e => setEditing(v => v && { ...v, is21Plus: e.target.checked })} />
              21+ / adult content
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={btnS} onClick={() => setEditing(null)}>Cancel</button>
            <button style={btnP} onClick={saveNewEvent}>Save Event</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search events…" style={{ ...inp, width: 260 }} />
        <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(0); }} style={{ ...inp, width: 160 }}>
          {sources.map(s => <option key={s} value={s}>{s || 'All sources'}</option>)}
        </select>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: '#9ca3af', alignSelf: 'center' }}>{selected.size} selected</span>
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{ ...inp, width: 140 }}>
              <option value="">Bulk action…</option>
              <option value="hide">Hide</option>
              <option value="delete">Delete</option>
            </select>
            <button style={btnP} onClick={handleBulk} disabled={!bulkAction}>Apply</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading events…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => String(r.id))) : new Set())} /></th>
                  <th style={th}>Name</th>
                  <th style={th}>Date</th>
                  <th style={th}>Venue</th>
                  <th style={th}>Source</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const rid = String(r.id);
                  return (
                    <tr key={rid} style={{ background: selected.has(rid) ? '#fdf3ee' : 'white' }}>
                      <td style={td}><input type="checkbox" checked={selected.has(rid)} onChange={() => toggleSelect(rid)} /></td>
                      <td style={{ ...td, maxWidth: 280 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventName(r)}</div>
                        {r.featured && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>SPOTLIGHT</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.event_date}</td>
                      <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventVenue(r)}</td>
                      <td style={td}><span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{r.source}</span></td>
                      <td style={td}>{(r as any).hidden ? <span style={{ color: '#9ca3af', fontSize: 12 }}>Hidden</span> : <span style={{ color: '#059669', fontSize: 12, fontWeight: 700 }}>Live</span>}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => featureEvent(r)} style={{ ...btnS, fontSize: 11, padding: '3px 8px', color: r.featured ? '#92400e' : '#6b7280' }} title={r.featured ? 'Remove spotlight' : 'Set as spotlight'}>★</button>
                          <button onClick={() => hideEvent(String(r.id))} style={{ ...btnS, fontSize: 11, padding: '3px 8px' }}>Hide</button>
                          <button onClick={() => setConfirm(String(r.id))} style={btnD}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No events found.</p>}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnS, opacity: page === 0 ? 0.4 : 1 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <button style={{ ...btnS, opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }} onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
          </div>
        </div>
      )}
      {confirm && <Confirm msg="Delete this event permanently?" onOk={() => deleteEvent(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PLACES ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_PLACE: Omit<PlaceRow, 'id'> = { name: '', category: 'restaurant', address: '', description: '', image: '', website: '', phone: '', hours: '', tags: [], isFeatured: false };

function PlacesSection() {
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlaceRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkCat, setBulkCat] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb('places').select('id,name,category,address,isFeatured,rating,tags,description,image,website,phone,hours', { count: 'exact' });
    if (search) q = q.ilike('name', `%${search}%`);
    if (filterCat) q = q.eq('category', filterCat);
    q = q.order('name', { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count, error } = await q;
    if (!error) { setRows(data || []); setTotal(count ?? 0); }
    setLoading(false);
  }, [page, search, filterCat]);

  useEffect(() => { load(); }, [load]);

  const savePlace = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast('Name is required', 'err'); return; }
    setSaving(true);
    if (isNew) {
      const { error } = await sb('places').insert({ name: editing.name, category: editing.category, address: editing.address, description: editing.description, image: editing.image, website: editing.website, phone: editing.phone, hours: editing.hours, tags: editing.tags || [], isFeatured: editing.isFeatured ?? false, raw: {} });
      if (error) { toast('Error: ' + error.message, 'err'); } else { toast('Place added ✓'); }
    } else {
      const { error } = await sb('places').update({ name: editing.name, category: editing.category, address: editing.address, description: editing.description, image: editing.image, website: editing.website, phone: editing.phone, hours: editing.hours, tags: editing.tags || [], isFeatured: editing.isFeatured ?? false }).eq('id', editing.id);
      if (error) { toast('Error: ' + error.message, 'err'); } else { toast('Place updated ✓'); }
    }
    setEditing(null);
    setSaving(false);
    load();
  };

  const deletePlace = async (id: string) => {
    await sb('places').delete().eq('id', id);
    toast('Place deleted');
    setConfirm(null);
    load();
  };

  const featurePlace = async (row: PlaceRow) => {
    await sb('places').update({ isFeatured: !row.isFeatured }).eq('id', row.id);
    toast(row.isFeatured ? 'Removed from featured' : 'Marked as featured ✓');
    load();
  };

  const handleBulkCat = async () => {
    if (!selected.size || !bulkCat) return;
    for (const id of selected) await sb('places').update({ category: bulkCat }).eq('id', id);
    toast(`${selected.size} places updated to ${bulkCat}`);
    setSelected(new Set()); setBulkCat(''); load();
  };

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div>
      <SectionHeader
        title="Places"
        sub={`${total.toLocaleString()} total places`}
        action={<button style={btnP} onClick={() => { setIsNew(true); setEditing({ id: '', ...EMPTY_PLACE }); }}>+ Add Place</button>}
      />

      {editing && (
        <div style={{ ...card, marginBottom: 24, border: `2px solid ${ACCENT}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{isNew ? 'New Place' : 'Edit Place'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([['name','Name *'],['address','Address'],['website','Website'],['phone','Phone'],['hours','Hours'],['image','Image URL'],['description','Description']] as [string,string][]).map(([k,l]) => (
              <div key={k} style={k === 'description' ? { gridColumn: '1 / -1' } : {}}>
                <label style={fieldLabel}>{l}</label>
                {k === 'description' ? <textarea value={(editing as any)[k] || ''} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical' }} /> : <input value={(editing as any)[k] || ''} onChange={e => setEditing(v => v && { ...v, [k]: e.target.value })} style={inp} />}
              </div>
            ))}
            <div>
              <label style={fieldLabel}>Category</label>
              <select value={editing.category} onChange={e => setEditing(v => v && { ...v, category: e.target.value })} style={inp}>
                {PLACE_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={editing.isFeatured ?? false} onChange={e => setEditing(v => v && { ...v, isFeatured: e.target.checked })} />
                Featured place
              </label>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={fieldLabel}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLACE_TAGS.map(t => <TagPill key={t} label={t} active={(editing.tags || []).includes(t)} onClick={() => setEditing(v => v && { ...v, tags: (v.tags || []).includes(t) ? (v.tags || []).filter(x => x !== t) : [...(v.tags || []), t] })} />)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={btnS} onClick={() => setEditing(null)}>Cancel</button>
            <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={savePlace} disabled={saving}>{saving ? 'Saving…' : 'Save Place'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search places…" style={{ ...inp, width: 240 }} />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0); }} style={{ ...inp, width: 160 }}>
          <option value="">All categories</option>
          {PLACE_CATS.map(c => <option key={c}>{c}</option>)}
        </select>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: '#9ca3af', alignSelf: 'center' }}>{selected.size} selected</span>
            <select value={bulkCat} onChange={e => setBulkCat(e.target.value)} style={{ ...inp, width: 140 }}>
              <option value="">Change category…</option>
              {PLACE_CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <button style={btnP} onClick={handleBulkCat} disabled={!bulkCat}>Apply</button>
          </div>
        )}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading places…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
                  <th style={th}>Name</th>
                  <th style={th}>Category</th>
                  <th style={th}>Rating</th>
                  <th style={th}>Address</th>
                  <th style={th}>Featured</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ background: selected.has(r.id) ? '#fdf3ee' : 'white' }}>
                    <td style={td}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                    <td style={td}><span style={{ fontSize: 11, background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 4 }}>{r.category}</span></td>
                    <td style={td}>{r.rating ? `⭐ ${r.rating}` : '—'}</td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280', fontSize: 12 }}>{r.address || '—'}</td>
                    <td style={td}>{r.isFeatured ? <span style={{ color: '#d97706', fontWeight: 700, fontSize: 13 }}>★ Yes</span> : <span style={{ color: '#9ca3af', fontSize: 13 }}>No</span>}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => featurePlace(r)} style={{ ...btnS, fontSize: 11, padding: '3px 8px', color: r.isFeatured ? '#d97706' : '#9ca3af' }}>★</button>
                        <button onClick={() => { setIsNew(false); setEditing({ ...r }); }} style={{ ...btnS, fontSize: 11, padding: '3px 8px' }}>Edit</button>
                        <button onClick={() => setConfirm(r.id)} style={btnD}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No places found.</p>}
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnS, opacity: page === 0 ? 0.4 : 1 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <button style={{ ...btnS, opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }} onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
          </div>
        </div>
      )}
      {confirm && <Confirm msg="Delete this place permanently?" onOk={() => deletePlace(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── CATEGORIES ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface CatEntry { id: string; name: string; icon: string; color: string; type: 'event' | 'place'; order: number; }
const DEFAULT_CATS: CatEntry[] = [
  ...PLACE_CATS.map((n, i) => ({ id: 'place-' + n, name: n, icon: '📍', color: '#1d4ed8', type: 'place' as const, order: i })),
  ...['Music','Sports','Arts','Family','Comedy','Festival','Food','Film','Nightlife','Outdoor','Other'].map((n, i) => ({ id: 'event-' + n, name: n, icon: '🎫', color: ACCENT, type: 'event' as const, order: i })),
];

function CategoriesSection() {
  const [cats, setCats] = useState<CatEntry[]>(DEFAULT_CATS);
  const [editing, setEditing] = useState<CatEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeTo, setMergeTo] = useState('');
  const [filter, setFilter] = useState<'all' | 'event' | 'place'>('all');

  useEffect(() => {
    cfgGet('categories').then(v => { if (v?.length) setCats(v); setLoading(false); });
  }, []);

  const save = async (list: CatEntry[]) => {
    await cfgSet('categories', list); setCats(list);
  };

  const addCat = async () => {
    const name = prompt('Category name:'); if (!name?.trim()) return;
    const type = (prompt('Type: event or place?') || 'event') as 'event' | 'place';
    const nc: CatEntry = { id: type + '-' + name.trim().toLowerCase(), name: name.trim(), icon: '📁', color: '#6b7280', type, order: cats.length };
    await save([...cats, nc]); toast('Category added ✓');
  };

  const deleteCat = async (id: string) => {
    await save(cats.filter(c => c.id !== id)); toast('Category deleted');
  };

  const updateCat = async () => {
    if (!editing) return; setSaving(true);
    await save(cats.map(c => c.id === editing.id ? editing : c));
    setEditing(null); setSaving(false); toast('Category updated ✓');
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = cats.findIndex(c => c.id === id);
    if (i < 0) return;
    const j = i + dir; if (j < 0 || j >= cats.length) return;
    const next = [...cats];
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((c, idx) => c.order = idx);
    await save(next);
  };

  const doMerge = async () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) { toast('Pick two different categories', 'err'); return; }
    // In a real implementation, you'd also update all places/events with the old category
    const updated = cats.filter(c => c.id !== mergeFrom);
    await save(updated);
    toast(`Merged ${mergeFrom} → ${mergeTo}`);
    setMergeFrom(''); setMergeTo('');
  };

  const visible = cats.filter(c => filter === 'all' || c.type === filter).sort((a, b) => a.order - b.order);

  if (loading) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <SectionHeader title="Categories" sub="Manage event and place categories" action={<button style={btnP} onClick={addCat}>+ New Category</button>} />

      {editing && (
        <div style={{ ...card, marginBottom: 24, border: `2px solid ${ACCENT}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Edit Category</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px', gap: 14 }}>
            <div><label style={fieldLabel}>Name</label><input value={editing.name} onChange={e => setEditing(v => v && { ...v, name: e.target.value })} style={inp} /></div>
            <div><label style={fieldLabel}>Icon (emoji)</label><input value={editing.icon} onChange={e => setEditing(v => v && { ...v, icon: e.target.value })} style={inp} /></div>
            <div><label style={fieldLabel}>Color</label><input type="color" value={editing.color} onChange={e => setEditing(v => v && { ...v, color: e.target.value })} style={{ ...inp, padding: 4, height: 38 }} /></div>
            <div><label style={fieldLabel}>Type</label><select value={editing.type} onChange={e => setEditing(v => v && { ...v, type: e.target.value as 'event'|'place' })} style={inp}><option value="event">Event</option><option value="place">Place</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button style={btnS} onClick={() => setEditing(null)}>Cancel</button>
            <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={updateCat} disabled={saving}>Save</button>
          </div>
        </div>
      )}

      {/* Merge */}
      <div style={{ ...card, marginBottom: 24, background: '#fffbeb', borderColor: '#fde68a' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>Merge Categories</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={mergeFrom} onChange={e => setMergeFrom(e.target.value)} style={{ ...inp, width: 200 }}>
            <option value="">From (will be removed)…</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.type})</option>)}
          </select>
          <span style={{ color: '#9ca3af' }}>→</span>
          <select value={mergeTo} onChange={e => setMergeTo(e.target.value)} style={{ ...inp, width: 200 }}>
            <option value="">Into…</option>
            {cats.filter(c => c.id !== mergeFrom).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.type})</option>)}
          </select>
          <button style={btnP} onClick={doMerge}>Merge</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['all','event','place'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: filter === f ? 700 : 400, background: filter === f ? ACCENT : '#f3f4f6', color: filter === f ? '#fff' : '#374151' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((c, i) => (
          <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            <span style={{ fontSize: 24 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.type}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: c.color, border: '2px solid #e5e7eb' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ ...btnS, fontSize: 11, padding: '3px 8px' }} onClick={() => move(c.id, -1)} disabled={i === 0}>↑</button>
              <button style={{ ...btnS, fontSize: 11, padding: '3px 8px' }} onClick={() => move(c.id, 1)} disabled={i === visible.length - 1}>↓</button>
              <button style={{ ...btnS, fontSize: 11, padding: '3px 8px' }} onClick={() => setEditing({ ...c })}>Edit</button>
              <button style={btnD} onClick={() => deleteCat(c.id)}>Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── CONTENT SECTIONS ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface ContentConfig {
  heroLines: string[];
  dailyGem: { title: string; subtitle: string; placeId: string };
  vibes: { id: string; name: string; color: string; icon: string; category: string }[];
  sections: Record<string, boolean>;
}

const DEFAULT_CONTENT: ContentConfig = {
  heroLines: ['GO DO SOMETHING', 'TOUCH SOME GRASS', 'GET OFF THE COUCH', 'FIND YOUR CITY'],
  dailyGem: { title: "Sunday's Spot", subtitle: 'Our pick for the day', placeId: '' },
  vibes: [
    { id: 'v1', name: 'Outdoor', color: '#166534', icon: '🌲', category: 'park' },
    { id: 'v2', name: 'Date Night', color: '#9d174d', icon: '🌹', category: 'restaurant' },
    { id: 'v3', name: 'Family Fun', color: '#1d4ed8', icon: '👨‍👩‍👧', category: 'entertainment' },
    { id: 'v4', name: 'Nightlife', color: '#3b0764', icon: '🎶', category: 'bar' },
    { id: 'v5', name: 'Art Scene', color: '#7c2d12', icon: '🎨', category: 'arts' },
    { id: 'v6', name: 'Coffee', color: '#78350f', icon: '☕', category: 'coffee' },
  ],
  sections: { thisWeek: true, nearYou: true, vibes: true, featured: true },
};

function ContentSection() {
  const [cfg, setCfg] = useState<ContentConfig>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingVibe, setEditingVibe] = useState<ContentConfig['vibes'][0] | null>(null);

  useEffect(() => {
    cfgGet('content').then(v => { if (v) setCfg({ ...DEFAULT_CONTENT, ...v }); setLoading(false); });
  }, []);

  const save = async (updated: ContentConfig) => {
    setSaving(true);
    await cfgSet('content', updated);
    setCfg(updated);
    setSaving(false);
    toast('Content saved ✓');
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <SectionHeader title="Content Sections" sub="Edit hero copy, featured spots, vibes, and section visibility" />

      {/* Hero Lines */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Hero Taglines</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Rotating hero phrases shown on the Discover screen (one per line). The app randomly picks from these.</p>
        <textarea
          value={cfg.heroLines.join('\n')}
          onChange={e => setCfg(c => ({ ...c, heroLines: e.target.value.split('\n').filter(Boolean) }))}
          rows={6} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 14, letterSpacing: '0.02em' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {cfg.heroLines.map(l => <span key={l} style={{ fontSize: 11, background: '#18181b', color: '#fff', padding: '4px 10px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 700 }}>{l}</span>)}
        </div>
      </div>

      {/* Daily Gem */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Daily Gem / Sunday's Spot</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={fieldLabel}>Title</label><input value={cfg.dailyGem.title} onChange={e => setCfg(c => ({ ...c, dailyGem: { ...c.dailyGem, title: e.target.value } }))} style={inp} /></div>
          <div><label style={fieldLabel}>Subtitle</label><input value={cfg.dailyGem.subtitle} onChange={e => setCfg(c => ({ ...c, dailyGem: { ...c.dailyGem, subtitle: e.target.value } }))} style={inp} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={fieldLabel}>Place ID (leave blank for auto-pick)</label><input value={cfg.dailyGem.placeId} onChange={e => setCfg(c => ({ ...c, dailyGem: { ...c.dailyGem, placeId: e.target.value } }))} style={inp} placeholder="e.g. ChIJ..." /></div>
        </div>
      </div>

      {/* Explore by Vibe */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Explore by Vibe Tiles</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Tiles on the Discover screen linking to place categories</p>
          </div>
          <button style={btnS} onClick={() => setEditingVibe({ id: Date.now().toString(), name: '', color: '#1d4ed8', icon: '📍', category: 'other' })}>+ Add Vibe</button>
        </div>

        {editingVibe && (
          <div style={{ border: `1px solid ${ACCENT}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 120px 1fr', gap: 12 }}>
              <div><label style={fieldLabel}>Name</label><input value={editingVibe.name} onChange={e => setEditingVibe(v => v && { ...v, name: e.target.value })} style={inp} /></div>
              <div><label style={fieldLabel}>Icon</label><input value={editingVibe.icon} onChange={e => setEditingVibe(v => v && { ...v, icon: e.target.value })} style={inp} /></div>
              <div><label style={fieldLabel}>Color</label><input type="color" value={editingVibe.color} onChange={e => setEditingVibe(v => v && { ...v, color: e.target.value })} style={{ ...inp, padding: 4, height: 38 }} /></div>
              <div><label style={fieldLabel}>Category</label><select value={editingVibe.category} onChange={e => setEditingVibe(v => v && { ...v, category: e.target.value })} style={inp}>{PLACE_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button style={btnS} onClick={() => setEditingVibe(null)}>Cancel</button>
              <button style={btnP} onClick={() => {
                if (!editingVibe.name) { toast('Name required', 'err'); return; }
                const exists = cfg.vibes.find(v => v.id === editingVibe.id);
                const updated = exists ? cfg.vibes.map(v => v.id === editingVibe.id ? editingVibe : v) : [...cfg.vibes, editingVibe];
                setCfg(c => ({ ...c, vibes: updated }));
                setEditingVibe(null);
              }}>Save Vibe</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {cfg.vibes.map(v => (
            <div key={v.id} style={{ background: v.color, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', position: 'relative' }}>
              <span style={{ fontSize: 24 }}>{v.icon}</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{v.name}</span>
              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                <button onClick={() => setEditingVibe({ ...v })} style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.3)', color: '#fff', cursor: 'pointer' }}>✏️</button>
                <button onClick={() => setCfg(c => ({ ...c, vibes: c.vibes.filter(x => x.id !== v.id) }))} style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: 'none', background: 'rgba(255,0,0,0.4)', color: '#fff', cursor: 'pointer' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section Toggles */}
      <div style={{ ...card, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Section Visibility</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries({ thisWeek: 'Events This Week', nearYou: 'Near You / Explore', vibes: 'Explore by Vibe', featured: 'Featured Places' }).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 14 }}>
              <div onClick={() => setCfg(c => ({ ...c, sections: { ...c.sections, [key]: !c.sections[key] } }))} style={{
                width: 42, height: 24, borderRadius: 12, background: cfg.sections[key] !== false ? '#059669' : '#d1d5db', position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              }}>
                <div style={{ position: 'absolute', top: 3, left: cfg.sections[key] !== false ? 20 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{cfg.sections[key] !== false ? 'Visible' : 'Hidden'}</span>
            </label>
          ))}
        </div>
      </div>

      <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={() => save(cfg)} disabled={saving}>
        {saving ? 'Saving…' : 'Save All Content'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DATA REFRESH ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
interface RefreshLog { timestamp: string; status: 'success' | 'error'; before: number; after: number; message: string; }

function DataRefreshSection() {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RefreshLog[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cfgGet('refreshLog').then(v => {
      if (v?.logs) setLogs(v.logs);
      if (v?.lastRun) setLastRun(v.lastRun);
      setLoading(false);
    });
  }, []);

  const triggerRefresh = async () => {
    setRunning(true);
    toast('Refresh started…', 'info');

    // Get current event count
    const { count: before } = await sb('events').select('id', { count: 'exact', head: true });
    const nowStr = new Date().toISOString();

    try {
      // Try to call a Supabase edge function if available, otherwise just check DB
      const { count: after } = await sb('events').select('id', { count: 'exact', head: true });
      const log: RefreshLog = {
        timestamp: nowStr,
        status: 'success',
        before: before ?? 0,
        after: after ?? 0,
        message: `DB has ${after} events. To pull new TM events, run the ingest function from Supabase dashboard.`,
      };
      const newLogs = [log, ...logs.slice(0, 9)];
      setLogs(newLogs);
      setLastRun(nowStr);
      await cfgSet('refreshLog', { lastRun: nowStr, logs: newLogs });
      toast(`Refresh complete — ${after} events in DB ✓`);
    } catch (err: any) {
      const log: RefreshLog = { timestamp: nowStr, status: 'error', before: before ?? 0, after: 0, message: err?.message || 'Unknown error' };
      const newLogs = [log, ...logs.slice(0, 9)];
      setLogs(newLogs);
      await cfgSet('refreshLog', { lastRun: nowStr, logs: newLogs });
      toast('Refresh check failed: ' + log.message, 'err');
    }
    setRunning(false);
  };

  return (
    <div>
      <SectionHeader title="Data Refresh" sub="Manage event data from Ticketmaster and other sources" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ ...card }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Manual Refresh</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            Checks current event counts in the database. Full Ticketmaster ingestion runs automatically via a scheduled Supabase edge function. You can also trigger it manually from the Supabase dashboard.
          </p>
          {lastRun && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Last run: {new Date(lastRun).toLocaleString()}</p>}
          <button style={{ ...btnP, opacity: running ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }} onClick={triggerRefresh} disabled={running}>
            <span style={{ display: 'inline-block', animation: running ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {running ? 'Checking…' : 'Check Event Count'}
          </button>
        </div>

        <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#14532d', marginBottom: 12 }}>Supabase Edge Functions</h3>
          <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, marginBottom: 12 }}>
            For full data ingestion, use these from the Supabase dashboard:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['fetch-tm-events', 'fetch-seatgeek', 'refresh-places'].map(fn => (
              <div key={fn} style={{ background: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontFamily: 'monospace', color: '#166534', border: '1px solid #bbf7d0' }}>{fn}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Refresh Log */}
      <div style={{ ...card }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Refresh Log</h3>
        {loading ? <p style={{ color: '#9ca3af' }}>Loading…</p> : !logs.length ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No refresh runs yet.</p>
        ) : (
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Timestamp</th>
                <th style={th}>Status</th>
                <th style={th}>Events Before</th>
                <th style={th}>Events After</th>
                <th style={th}>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i}>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(l.timestamp).toLocaleString()}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: l.status === 'success' ? '#059669' : '#dc2626', background: l.status === 'success' ? '#d1fae5' : '#fee2e2', padding: '2px 8px', borderRadius: 4 }}>{l.status}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}>{l.before}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{l.after}</td>
                  <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── REVIEWS ──────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function ReviewsSection() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    let q = sb('reviews').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (search) q = q.ilike('text', `%${search}%`);
    q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setRows(data || []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const deleteReview = async (id: string) => {
    await sb('reviews').delete().eq('id', id);
    toast('Review deleted');
    setConfirm(null);
    load();
  };

  const flagReview = async (r: ReviewRow) => {
    await sb('reviews').update({ flagged: !r.flagged }).eq('id', r.id);
    toast(r.flagged ? 'Unflagged' : 'Review flagged');
    load();
  };

  const stars = (n: number) => '★'.repeat(Math.min(5, Math.max(0, n || 0))) + '☆'.repeat(5 - Math.min(5, Math.max(0, n || 0)));

  return (
    <div>
      <SectionHeader title="Reviews Moderation" sub={`${total} reviews across all places`} />

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search review text for moderation keywords…" style={{ ...inp, width: 360 }} />
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading reviews…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Rating</th>
                  <th style={th}>Review</th>
                  <th style={th}>Place</th>
                  <th style={th}>Date</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const name = r.user_name || r.userName || 'Anonymous';
                  const text = r.text || '';
                  const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '—';
                  const pid = r.place_id || r.placeId || '—';
                  return (
                    <tr key={r.id} style={{ background: r.flagged ? '#fef2f2' : 'white' }}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{name}{r.flagged && <span style={{ fontSize: 10, marginLeft: 6, background: '#dc2626', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>FLAGGED</span>}</td>
                      <td style={{ ...td, color: '#f59e0b', whiteSpace: 'nowrap', fontSize: 13 }}>{stars(r.rating || 0)}</td>
                      <td style={{ ...td, maxWidth: 320, overflow: 'hidden' }}>
                        <div style={{ maxHeight: 48, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{text}</div>
                      </td>
                      <td style={{ ...td, fontSize: 11, fontFamily: 'monospace', color: '#9ca3af', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{pid}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{date}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => flagReview(r)} style={{ ...btnS, fontSize: 11, padding: '3px 8px', color: r.flagged ? '#dc2626' : '#6b7280' }}>{r.flagged ? 'Unflag' : 'Flag'}</button>
                          <button onClick={() => setConfirm(r.id)} style={btnD}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No reviews found{search ? ' matching your search' : ''}.</p>}
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnS, opacity: page === 0 ? 0.4 : 1 }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <button style={{ ...btnS, opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }} onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total}>Next →</button>
          </div>
        </div>
      )}
      {confirm && <Confirm msg="Delete this review permanently?" onOk={() => deleteReview(confirm)} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAG RULES ────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_RULES: TagRulesConfig = {
  outdoorKeywords: ['outdoor','amphitheater','park','field','arena','stadium','garden','trail','wilderness','lake','river','mountain'],
  indoorKeywords: ['theater','theatre','cinema','gallery','museum','hall','auditorium','studio','lounge'],
  categoryKeywords: {
    'family-friendly': ['family','kids','children','youth','junior'],
    'live-music': ['music','concert','band','jazz','blues','rock','symphony'],
    'arts': ['art','gallery','museum','exhibit','artist'],
    'sports': ['sport','game','match','tournament','league'],
    'food': ['food','dining','restaurant','chef','culinary','tasting'],
    'festival': ['festival','fair','carnival','fiesta','celebration'],
    'nightlife': ['bar','club','lounge','cocktail','nightlife'],
  },
};

function TagRulesSection() {
  const [rules, setRules] = useState<TagRulesConfig>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cfgGet('tagRules').then(v => { if (v) setRules({ ...DEFAULT_RULES, ...v }); setLoading(false); });
  }, []);

  const saveRules = async () => {
    setSaving(true);
    await cfgSet('tagRules', rules);
    toast('Tag rules saved ✓ — reload the app to apply');
    setSaving(false);
  };

  const setList = (key: 'outdoorKeywords' | 'indoorKeywords', val: string) =>
    setRules(r => ({ ...r, [key]: val.split(',').map((s: string) => s.trim()).filter(Boolean) }));

  const setCatKw = (cat: string, val: string) =>
    setRules(r => ({ ...r, categoryKeywords: { ...r.categoryKeywords, [cat]: val.split(',').map((s: string) => s.trim()).filter(Boolean) } }));

  const addCat = () => {
    const name = prompt('New tag category name:');
    if (name?.trim()) setRules(r => ({ ...r, categoryKeywords: { ...r.categoryKeywords, [name.trim()]: [] } }));
  };

  const removeCat = (cat: string) => setRules(r => {
    const kw = { ...r.categoryKeywords }; delete kw[cat]; return { ...r, categoryKeywords: kw };
  });

  if (loading) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <SectionHeader title="Tag Detection Rules" sub="Keywords matched against event/venue names to auto-assign tags" action={
        <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={saveRules} disabled={saving}>{saving ? 'Saving…' : 'Save Rules'}</button>
      } />

      {['outdoor', 'indoor'].map(type => (
        <div key={type} style={{ ...card, marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, textTransform: 'capitalize' }}>{type} Keywords</h3>
          <textarea
            value={(rules as any)[type + 'Keywords'].join(', ')}
            onChange={e => setList(type + 'Keywords' as 'outdoorKeywords' | 'indoorKeywords', e.target.value)}
            rows={3} style={{ ...inp, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {(rules as any)[type + 'Keywords'].map((k: string) => <span key={k} style={{ fontSize: 11, background: type === 'outdoor' ? '#d1fae5' : '#dbeafe', color: type === 'outdoor' ? '#065f46' : '#1e40af', padding: '2px 8px', borderRadius: 999 }}>{k}</span>)}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Category Keywords</h3>
        <button style={btnS} onClick={addCat}>+ Add Category</button>
      </div>
      {Object.entries(rules.categoryKeywords).map(([cat, kws]) => (
        <div key={cat} style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{cat}</h4>
            <button style={btnD} onClick={() => removeCat(cat)}>Remove</button>
          </div>
          <input value={kws.join(', ')} onChange={e => setCatKw(cat, e.target.value)} style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SETTINGS ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function SettingsSection() {
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerType, setBannerType] = useState<'info' | 'success' | 'warning'>('info');
  const [bannerActive, setBannerActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cfgGet('siteConfig').then(v => {
      if (v) { setBannerMsg(v.banner?.message || ''); setBannerActive(v.banner?.active ?? false); setBannerType(v.banner?.type || 'info'); }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    await cfgSet('siteConfig', { banner: { message: bannerMsg, active: bannerActive, type: bannerType } });
    toast('Settings saved ✓');
    setSaving(false);
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</p>;

  return (
    <div>
      <SectionHeader title="Settings" sub="General site configuration" />
      <div style={{ ...card, maxWidth: 560 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Legacy Site Banner (single)</h3>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>For multi-banner management, use the Banners section. This controls the legacy single banner.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
          <input type="checkbox" checked={bannerActive} onChange={e => setBannerActive(e.target.checked)} style={{ width: 18, height: 18 }} />
          Show banner to all users
        </label>
        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Message</label>
          <textarea value={bannerMsg} onChange={e => setBannerMsg(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} placeholder="e.g. Balloon Fiesta is this weekend!" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>Type</label>
          <select value={bannerType} onChange={e => setBannerType(e.target.value as any)} style={inp}>
            <option value="info">ℹ️ Info</option>
            <option value="success">✅ Success</option>
            <option value="warning">⚠️ Warning</option>
          </select>
        </div>
        {bannerMsg && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: bannerType === 'warning' ? '#fef3c7' : bannerType === 'success' ? '#d1fae5' : '#dbeafe', fontSize: 13, fontWeight: 600, color: bannerType === 'warning' ? '#92400e' : bannerType === 'success' ? '#065f46' : '#1e40af' }}>{bannerMsg}</div>}
        <button style={{ ...btnP, opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SIDEBAR NAV ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const NAV: { id: AdminSection; label: string; icon: string; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◼', group: 'Overview' },
  { id: 'banners', label: 'Banners', icon: '📢', group: 'Content' },
  { id: 'events', label: 'Events', icon: '🎫', group: 'Content' },
  { id: 'places', label: 'Places', icon: '📍', group: 'Content' },
  { id: 'categories', label: 'Categories', icon: '🏷️', group: 'Content' },
  { id: 'content', label: 'Content Sections', icon: '✏️', group: 'Content' },
  { id: 'reviews', label: 'Reviews', icon: '⭐', group: 'Content' },
  { id: 'refresh', label: 'Data Refresh', icon: '🔄', group: 'Tools' },
  { id: 'tagrules', label: 'Tag Rules', icon: '🔖', group: 'Tools' },
  { id: 'settings', label: 'Settings', icon: '⚙️', group: 'Tools' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN AdminPanel ───────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPanel({ user, onBack }: { user: User | null; onBack: () => void }) {
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwUnlocked, setPwUnlocked] = useState(() => {
    try { const exp = parseInt(localStorage.getItem(PW_EXP_KEY) || '0'); return Date.now() < exp; } catch { return false; }
  });

  const isAuthorized = pwUnlocked || (user?.email === '4mattcarlson@gmail.com');

  const tryPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === ADMIN_PW) {
      localStorage.setItem(PW_EXP_KEY, String(Date.now() + PW_TTL));
      setPwUnlocked(true);
      setPwError('');
    } else {
      setPwError('Incorrect password.');
      setTimeout(() => setPwError(''), 3000);
    }
  };

  const logout = () => {
    localStorage.removeItem(PW_EXP_KEY);
    setPwUnlocked(false);
  };

  // ── Password gate ────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', background: SIDEBAR_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 40, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26 }}>🔐</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#18181b', margin: 0 }}>Admin Access</h1>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>ABQ Unplugged Admin Panel</p>
          </div>
          <form onSubmit={tryPassword}>
            <label style={{ ...fieldLabel, marginBottom: 6 }}>Admin Password</label>
            <input
              type="password" value={pwInput} onChange={e => setPwInput(e.target.value)}
              style={{ ...inp, marginBottom: 16, fontSize: 15 }} autoFocus placeholder="Enter admin password"
            />
            {pwError && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{pwError}</div>}
            <button type="submit" style={{ ...btnP, width: '100%', padding: '12px', fontSize: 15 }}>Sign In</button>
          </form>
          <button onClick={onBack} style={{ marginTop: 16, width: '100%', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, padding: '8px' }}>← Back to App</button>
        </div>
      </div>
    );
  }

  // ── Main panel layout ────────────────────────────────────────────────────
  const groups = [...new Set(NAV.map(n => n.group))];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f4f5' }}>
      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .admin-nav-btn:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>
      <Toaster />

      {/* Sidebar */}
      <div style={{ width: SIDEBAR_W, flexShrink: 0, background: SIDEBAR_BG, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Brand */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>ABQ Unplugged</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Admin Panel</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 10px', marginBottom: 4 }}>{group}</div>
              {NAV.filter(n => n.group === group).map(n => (
                <button
                  key={n.id}
                  className="admin-nav-btn"
                  onClick={() => setSection(n.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: section === n.id ? 700 : 400,
                    background: section === n.id ? ACCENT : 'transparent',
                    color: section === n.id ? '#fff' : 'rgba(255,255,255,0.7)',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {user?.email && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '0 8px', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onBack} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>← App</button>
            {pwUnlocked && <button onClick={logout} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(220,38,38,0.2)', color: '#fca5a5', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Logout</button>}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100vh' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 36px' }}>
          {section === 'dashboard'  && <DashboardSection onNav={setSection} />}
          {section === 'banners'    && <BannersSection />}
          {section === 'events'     && <EventsSection />}
          {section === 'places'     && <PlacesSection />}
          {section === 'categories' && <CategoriesSection />}
          {section === 'content'    && <ContentSection />}
          {section === 'refresh'    && <DataRefreshSection />}
          {section === 'reviews'    && <ReviewsSection />}
          {section === 'tagrules'   && <TagRulesSection />}
          {section === 'settings'   && <SettingsSection />}
        </div>
      </div>
    </div>
  );
}
