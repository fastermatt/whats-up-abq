import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";
import {
  CATEGORIES, SOURCE_META,
  getEventsForRange, mergeEvents, computeEventDates, getUpcomingWeekend, formatDate, EVENT_DATES,
  getEventHour, getTimeOfDay, fetchLiveEvents, ALL_EVENTS,
  type Event, type EventCategory, type EventSource, type TimeOfDay,
} from "./data/events";
import {
  FEATURED_PLACES, PLACE_CATEGORIES, getDistance, formatDistance,
  fetchOSMPlaces, fetchStaticPlaces, fetchGooglePlacesData,
  loadPlacesCache, savePlacesCache, isCacheStale, clearPlacesCache,
  type Place, type PlaceCategory,
} from "./data/places";

// ─── ICS / Add to Calendar ────────────────────────────────────────────────────
function parseTimeStr(t: string) {
  if (t === "Various showtimes") return { h: 14, m: 0 };
  const p = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!p) return { h: 12, m: 0 };
  let h = parseInt(p[1]); const m = parseInt(p[2]);
  if (p[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (p[3].toUpperCase() === "AM" && h === 12) h = 0;
  return { h, m };
}
function downloadICS(ev: Event) {
  const [y, mo, d] = ev.date.split("-");
  const s = parseTimeStr(ev.time);
  const e = ev.endTime ? parseTimeStr(ev.endTime) : { h: s.h + 2, m: s.m };
  const p = (n: number) => String(n).padStart(2, "0");
  const esc = (str: string) => str.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Explore ABQ//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${y}${mo}${d}T${p(s.h)}${p(s.m)}00`,
    `DTEND:${y}${mo}${d}T${p(e.h)}${p(e.m)}00`,
    `SUMMARY:${esc(ev.title)}`,`DESCRIPTION:${esc(ev.description)}`,
    `LOCATION:${esc(ev.address)}`,`URL:${ev.website || "https://www.visitalbuquerque.org"}`,
    "STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = ev.title.replace(/[^a-z0-9 ]/gi,"").replace(/\s+/g,"_")+".ics";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function parseDate(s: string) { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function daysInMonth(y:number,m:number){return new Date(y,m+1,0).getDate();}
function firstDayOfMonth(y:number,m:number){return new Date(y,m,1).getDay();}
function shortDate(s:string){const d=parseDate(s);return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;}
function rangeLabel(s:string,e:string){
  if(s===e) return shortDate(s);
  const sd=parseDate(s), ed=parseDate(e);
  if(sd.getMonth()===ed.getMonth()) return `${MONTH_SHORT[sd.getMonth()]} ${sd.getDate()}–${ed.getDate()}`;
  return `${shortDate(s)} – ${shortDate(e)}`;
}
function isWeekendRange(s:string,e:string){
  const sd=parseDate(s); const diff=(parseDate(e).getTime()-sd.getTime())/86400000;
  return diff<=1&&(sd.getDay()===6||sd.getDay()===0);
}
function getThisWeek():[string,string]{
  const t=new Date(); t.setHours(0,0,0,0);
  const end=new Date(t); end.setDate(t.getDate()+(6-t.getDay()));
  return [formatDate(t),formatDate(end)];
}
function getNextWeekend():[string,string]{
  const[s]=getUpcomingWeekend(); const sat=parseDate(s); sat.setDate(sat.getDate()+7);
  const sun=new Date(sat); sun.setDate(sat.getDate()+1);
  return [formatDate(sat),formatDate(sun)];
}

// ─── Filter state ─────────────────────────────────────────────────────────────
type PriceBucket = "any"|"free"|"0-15"|"15-30"|"30-60"|"60+";
interface FilterState {
  categories: Set<EventCategory>;
  price: PriceBucket;
  timeOfDay: Set<TimeOfDay>;
  tags: Set<string>;
}
const EMPTY_FILTERS: FilterState = {
  categories: new Set(), price: "any", timeOfDay: new Set(), tags: new Set()
};
function countActiveFilters(f: FilterState) {
  return f.categories.size + (f.price !== "any" ? 1 : 0) + f.timeOfDay.size + f.tags.size;
}
function matchesFilters(ev: Event, f: FilterState): boolean {
  if (f.categories.size > 0 && !f.categories.has(ev.category)) return false;
  if (f.price !== "any") {
    const n = ev.priceNum;
    if (f.price === "free"  && n !== 0) return false;
    if (f.price === "0-15"  && (n < 0.01 || n > 15)) return false;
    if (f.price === "15-30" && (n < 15.01 || n > 30)) return false;
    if (f.price === "30-60" && (n < 30.01 || n > 60)) return false;
    if (f.price === "60+"   && n <= 60) return false;
  }
  if (f.timeOfDay.size > 0) {
    const h = getEventHour(ev.time);
    const tod = getTimeOfDay(h);
    if (!f.timeOfDay.has(tod)) return false;
  }
  if (f.tags.size > 0) {
    if (f.tags.has("free")       && ev.priceNum !== 0) return false;
    if (f.tags.has("kids")       && !ev.isKidFriendly) return false;
    if (f.tags.has("21+")        && !ev.is21Plus) return false;
    if (f.tags.has("outdoor")    && !ev.isOutdoor) return false;
    if (f.tags.has("accessible") && !ev.isAccessible) return false;
  }
  return true;
}

// ─── Zia Symbol SVG ───────────────────────────────────────────────────────────
function ZiaSymbol({ size = 80, color = "currentColor", className = "", style = {} }: {
  size?: number; color?: string; className?: string; style?: React.CSSProperties;
}) {
  const rayOffsets = [-12, -4, 4, 12];
  const cardinals = [0, 90, 180, 270];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill={color} className={className} style={style}>
      <circle cx="50" cy="50" r="9.5" />
      {cardinals.map(groupDeg => (
        <g key={groupDeg} transform={`rotate(${groupDeg} 50 50)`}>
          {rayOffsets.map(offset => (
            <rect key={offset} x="48" y="14" width="4" height="14" rx="2"
              transform={`rotate(${offset} 50 50)`} />
          ))}
        </g>
      ))}
    </svg>
  );
}

// ─── Animated Logo ────────────────────────────────────────────────────────────
function AppLogo({ dark, subtitle }: { dark: boolean; subtitle: string }) {
  const tc = dark ? "text-white" : "text-gray-900";
  const sc = dark ? "text-white/45" : "text-gray-400";
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <ZiaSymbol size={28} color="#FF4500" className="zia-spin-slow flex-shrink-0"
          style={{ filter: "drop-shadow(0 0 6px rgba(255,69,0,0.4))" }} />
        <div className="flex items-baseline gap-1.5">
          <h1 className={`text-4xl font-black tracking-tighter leading-none ${tc}`}>Explore</h1>
          <span className="text-4xl font-black tracking-tighter leading-none logo-abq-shimmer">ABQ</span>
        </div>
      </div>
      <p className={`text-xs font-medium mt-0.5 ml-9 ${sc}`}>{subtitle}</p>
    </div>
  );
}

// ─── Image with fallback ──────────────────────────────────────────────────────
function EventImage({ src, gradient, className="", alt="" }: { src:string; gradient:string; className?:string; alt?:string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className={className} style={{ background: gradient }} />
    : <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: EventSource; dark?: boolean }) {
  const meta = SOURCE_META[source];
  return (
    <a href={meta.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: `${meta.color}22`, color: meta.color }}
      onClick={e => e.stopPropagation()}>
      {source}
    </a>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({
  filters, onApply, onClose, dark, allEvents,
}: {
  filters: FilterState; onApply: (f: FilterState) => void;
  onClose: () => void; dark: boolean; allEvents: Event[];
}) {
  const [local, setLocal] = useState<FilterState>(() => ({
    categories: new Set(filters.categories),
    price: filters.price,
    timeOfDay: new Set(filters.timeOfDay),
    tags: new Set(filters.tags),
  }));
  const matchCount = useMemo(() => allEvents.filter(ev => matchesFilters(ev, local)).length, [local, allEvents]);
  const toggleCat = (cat: EventCategory) => setLocal(prev => {
    const cats = new Set(prev.categories); cats.has(cat) ? cats.delete(cat) : cats.add(cat);
    return { ...prev, categories: cats };
  });
  const toggleTOD = (t: TimeOfDay) => setLocal(prev => {
    const tod = new Set(prev.timeOfDay); tod.has(t) ? tod.delete(t) : tod.add(t);
    return { ...prev, timeOfDay: tod };
  });
  const toggleTag = (tag: string) => setLocal(prev => {
    const tags = new Set(prev.tags); tags.has(tag) ? tags.delete(tag) : tags.add(tag);
    return { ...prev, tags };
  });
  const setPrice = (p: PriceBucket) => setLocal(prev => ({ ...prev, price: prev.price === p ? "any" : p }));
  const clearAll = () => setLocal({ categories: new Set(), price: "any", timeOfDay: new Set(), tags: new Set() });
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const bg = dark ? "bg-[#1c1c1e]" : "bg-white";
  const tc = dark ? "text-white" : "text-gray-900";
  const sc = dark ? "text-white/50" : "text-gray-400";
  const border = dark ? "border-white/8" : "border-gray-100";

  const PRICE_OPTS: { key: PriceBucket; label: string; desc: string }[] = [
    { key: "free",  label: "Free",      desc: "No cost" },
    { key: "0-15",  label: "Under $15", desc: "$1–$15" },
    { key: "15-30", label: "$15–$30",   desc: "Mid-range" },
    { key: "30-60", label: "$30–$60",   desc: "Premium" },
    { key: "60+",   label: "$60+",      desc: "VIP" },
  ];
  const TOD_OPTS: { key: TimeOfDay; icon: string; label: string; hours: string }[] = [
    { key: "morning",   icon: "🌅", label: "Morning",   hours: "Before noon" },
    { key: "afternoon", icon: "☀️", label: "Afternoon", hours: "12–5 PM" },
    { key: "evening",   icon: "🌆", label: "Evening",   hours: "5–9 PM" },
    { key: "night",     icon: "🌙", label: "Night",     hours: "9 PM+" },
  ];
  const TAG_OPTS = [
    { key: "free", icon: "✅", label: "Free only" },
    { key: "kids", icon: "👶", label: "Kid-friendly" },
    { key: "outdoor", icon: "🌿", label: "Outdoors" },
    { key: "accessible", icon: "♿", label: "Accessible" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-in"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) { onApply(local); onClose(); } }}>
      <div className={`sheet-in w-full max-w-[430px] rounded-t-3xl overflow-hidden ${bg}`}
        style={{ maxHeight: "88vh", boxShadow: "0 -8px 60px rgba(0,0,0,0.4)" }}>
        <div className="flex justify-center pt-3"><div className={`w-10 h-1 rounded-full ${dark ? "bg-white/20" : "bg-black/15"}`} /></div>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${border}`}>
          <div className="flex items-center gap-2">
            <ZiaSymbol size={18} color="#FF4500" className="zia-spin-slow" />
            <h2 className={`text-lg font-black ${tc}`}>Filter Events</h2>
          </div>
          <button onClick={clearAll} className="text-sm font-semibold text-orange-500 px-3 py-1 rounded-full active:scale-95 transition-all" style={{ background: "rgba(249,115,22,0.1)" }}>Clear All</button>
        </div>
        <div className="ios-scroll scrollbar-hide" style={{ maxHeight: "calc(88vh - 120px)", overflowY: "auto" }}>
          <div className="px-5 pt-4 pb-3">
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${sc}`}>Category</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat, idx) => {
                const active = local.categories.has(cat.label);
                return (
                  <button key={cat.label} onClick={() => toggleCat(cat.label)}
                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl border-2 transition-all active:scale-95 ${active ? "border-transparent" : dark ? "border-white/10 bg-white/4" : "border-gray-100 bg-gray-50"}`}
                    style={{ ...(active ? { background: `${cat.color}22`, borderColor: cat.color } : {}), animation: `fade-in 0.3s ease ${idx * 30}ms both` }}>
                    <span className="text-xl">{cat.emoji}</span>
                    <span className={`text-xs font-bold text-center leading-tight ${active ? "" : sc}`} style={active ? { color: cat.color } : {}}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`px-5 py-3 border-t ${border}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${sc}`}>Price</p>
            <div className="flex gap-2 flex-wrap">
              {PRICE_OPTS.map(opt => {
                const active = local.price === opt.key;
                return (
                  <button key={opt.key} onClick={() => setPrice(opt.key)}
                    className={`flex-1 min-w-[calc(20%-8px)] py-2.5 rounded-2xl text-xs font-bold border-2 transition-all active:scale-95 text-center ${active ? "border-orange-500 text-orange-500" : dark ? "border-white/10 text-white/55 bg-white/4" : "border-gray-100 text-gray-500 bg-gray-50"}`}
                    style={active ? { background: "rgba(249,115,22,0.12)" } : {}}>
                    <div>{opt.label}</div>
                    <div className={`text-xs font-normal mt-0.5 ${active ? "text-orange-400" : dark ? "text-white/30" : "text-gray-300"}`}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`px-5 py-3 border-t ${border}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${sc}`}>Time of Day</p>
            <div className="grid grid-cols-4 gap-2">
              {TOD_OPTS.map(opt => {
                const active = local.timeOfDay.has(opt.key);
                return (
                  <button key={opt.key} onClick={() => toggleTOD(opt.key)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all active:scale-95 ${active ? "border-orange-500" : dark ? "border-white/10 bg-white/4" : "border-gray-100 bg-gray-50"}`}
                    style={active ? { background: "rgba(249,115,22,0.12)" } : {}}>
                    <span className="text-2xl">{opt.icon}</span>
                    <span className={`text-xs font-bold ${active ? "text-orange-500" : sc}`}>{opt.label}</span>
                    <span className={`text-xs ${active ? "text-orange-400" : dark ? "text-white/25" : "text-gray-300"}`}>{opt.hours}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`px-5 py-3 border-t ${border}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${sc}`}>Vibe</p>
            <div className="flex gap-2 flex-wrap">
              {TAG_OPTS.map(tag => {
                const active = local.tags.has(tag.key);
                return (
                  <button key={tag.key} onClick={() => toggleTag(tag.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-bold transition-all active:scale-95 ${active ? "border-orange-500 text-orange-500" : dark ? "border-white/10 text-white/55 bg-white/4" : "border-gray-100 text-gray-500 bg-gray-50"}`}
                    style={active ? { background: "rgba(249,115,22,0.12)" } : {}}>
                    <span>{tag.icon}</span><span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`px-5 py-3 border-t ${border}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-2 ${sc}`}>Data Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SOURCE_META) as EventSource[]).map(src => (
                <a key={src} href={SOURCE_META[src].url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                  style={{ background: `${SOURCE_META[src].color}18`, color: SOURCE_META[src].color }}>
                  {src}
                </a>
              ))}
            </div>
          </div>
          <div className="h-4" />
        </div>
        <div className="px-4 pb-6 pt-3">
          <button onClick={() => { onApply(local); onClose(); }}
            className="w-full py-4 rounded-2xl font-black text-base text-white transition-all active:scale-98"
            style={{ background: matchCount > 0 ? "#FF4500" : "#6b7280", boxShadow: matchCount > 0 ? "0 4px 24px rgba(255,69,0,0.35)" : "none" }}>
            {matchCount > 0 ? `Show ${matchCount} Event${matchCount !== 1 ? "s" : ""}` : "No matching events"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Range Calendar ───────────────────────────────────────────────────────────
function RangeCalendar({ rangeStart, rangeEnd, onRangeChange, dark, onClose, eventDates: evDates }: {
  rangeStart:string; rangeEnd:string; onRangeChange:(s:string,e:string)=>void; dark:boolean; onClose:()=>void; eventDates?: Set<string>;
}) {
  const EVENT_DATES_LOCAL = evDates ?? EVENT_DATES;
  const today = formatDate(new Date());
  const sel = parseDate(rangeStart);
  const [vY, setVY] = useState(sel.getFullYear());
  const [vM, setVM] = useState(sel.getMonth());
  const [picking, setPicking] = useState<"start"|"end">("start");
  const [lS, setLS] = useState(rangeStart);
  const [lE, setLE] = useState(rangeEnd);
  const days = daysInMonth(vY, vM);
  const first = firstDayOfMonth(vY, vM);
  const cells = Array.from({ length: first + days }, (_, i) => i < first ? null : i - first + 1);
  function cellD(day: number) { return `${vY}-${String(vM+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; }
  function onDay(day: number) {
    const d = cellD(day);
    if (picking === "start") { setLS(d); setLE(d); setPicking("end"); }
    else { if (d < lS) { setLE(lS); setLS(d); } else { setLE(d); } setPicking("start"); }
  }
  const bg = dark ? "bg-[#1c1c1e]" : "bg-white";
  const tc = dark ? "text-white" : "text-gray-900";
  return (
    <div className={`rounded-3xl overflow-hidden ${bg} spring-in`}
      style={{ boxShadow: dark?"0 8px 40px rgba(0,0,0,0.5)":"0 8px 40px rgba(0,0,0,0.14)" }}>
      <div className="flex justify-center pt-3 pb-1"><div className={`w-10 h-1 rounded-full ${dark?"bg-white/20":"bg-black/15"}`}/></div>
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { label: "This Weekend", fn: ()=>{ const[s,e]=getUpcomingWeekend(); setLS(s);setLE(e);setPicking("start"); }},
          { label: "This Week",    fn: ()=>{ const[s,e]=getThisWeek(); setLS(s);setLE(e);setPicking("start"); }},
          { label: "Next Weekend", fn: ()=>{ const[s,e]=getNextWeekend(); setLS(s);setLE(e);setPicking("start"); }},
        ].map(({label,fn})=>(
          <button key={label} onClick={fn}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border active:scale-95 transition-all ${dark?"border-white/15 text-white/70 bg-white/5":"border-gray-200 text-gray-600 bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-2 flex gap-3">
        {(["start","end"] as const).map(p => (
          <div key={p} className={`flex-1 py-2 rounded-xl text-center text-xs font-bold border-2 transition-all ${picking===p?"border-orange-500 text-orange-500":dark?"border-white/10 text-white/35":"border-gray-200 text-gray-400"}`}>
            {p==="start"?`From: ${shortDate(lS)}`:`To: ${shortDate(lE)}`}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-1">
        <button onClick={()=>vM===0?(setVM(11),setVY(y=>y-1)):setVM(m=>m-1)}
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${dark?"bg-white/10 text-white":"bg-gray-100 text-gray-700"}`}>
          <svg width="7" height="12" viewBox="0 0 7 12"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <p className={`font-bold text-sm ${tc}`}>{MONTH_NAMES[vM]} {vY}</p>
        <button onClick={()=>vM===11?(setVM(0),setVY(y=>y+1)):setVM(m=>m+1)}
          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${dark?"bg-white/10 text-white":"bg-gray-100 text-gray-700"}`}>
          <svg width="7" height="12" viewBox="0 0 7 12"><path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 px-3 pb-0.5">
        {DAY_NAMES.map(d=><div key={d} className={`text-center text-xs font-semibold py-0.5 ${dark?"text-white/35":"text-gray-400"}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {cells.map((day,i)=>{
          if(!day) return <div key={`e${i}`}/>;
          const isS=cellD(day)===lS, isE=cellD(day)===lE;
          const inR=cellD(day)>lS&&cellD(day)<lE;
          const isTd=cellD(day)===today, hasEv=EVENT_DATES_LOCAL.has(cellD(day));
          return (
            <div key={day} className="cal-day flex flex-col items-center py-0.5 relative" onClick={()=>onDay(day)}>
              {(inR||(isS&&lS!==lE)||(isE&&lS!==lE))&&(
                <div className="absolute inset-y-0.5 bg-orange-500/15 -z-0"
                  style={{left:isS?"50%":inR?"0":"0",right:isE?"50%":inR?"0":"0"}}/>
              )}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${(isS||isE)?"bg-orange-500 text-white shadow-md":isTd?dark?"bg-white/15 text-white":"bg-gray-900 text-white":dark?"text-white":"text-gray-800"}`}>{day}</div>
              {hasEv&&!(isS||isE)&&<div className={`w-1 h-1 rounded-full mt-0 ${dark?"bg-orange-400":"bg-orange-500"}`}/>}
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-5 pt-1">
        <button onClick={()=>{ onRangeChange(lS,lE); onClose(); }}
          className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-sm active:scale-98 transition-all"
          style={{boxShadow:"0 4px 20px rgba(249,115,22,0.35)"}}>
          Show Events: {rangeLabel(lS, lE)}
        </button>
      </div>
    </div>
  );
}

// ─── Event Detail Sheet ───────────────────────────────────────────────────────
function EventDetailSheet({ event, dark, onClose }: { event:Event; dark:boolean; onClose:()=>void }) {
  const [calAdded, setCalAdded] = useState(false);
  const touchStartY = useRef(0);
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[onClose]);
  const d=dark, tc=d?"text-white":"text-gray-900", sc=d?"text-white/50":"text-gray-400", rowBg=d?"bg-white/6":"bg-gray-50";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-in"
      style={{background:"rgba(0,0,0,0.65)",backdropFilter:"blur(4px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className={`sheet-in w-full max-w-[430px] rounded-t-3xl overflow-hidden ${d?"bg-[#111]":"bg-white"}`}
        style={{maxHeight:"92vh",boxShadow:"0 -8px 60px rgba(0,0,0,0.4)"}}
        onTouchStart={e=>{ touchStartY.current = e.touches[0].clientY; }}
        onTouchMove={e=>{ if(e.touches[0].clientY - touchStartY.current > 90) onClose(); }}>
        <div className="flex justify-center pt-3 cursor-grab active:cursor-grabbing" onClick={onClose}>
          <div className={`w-12 h-1.5 rounded-full ${d?"bg-white/30":"bg-black/20"}`}/>
        </div>
        <div className="ios-scroll scrollbar-hide" style={{maxHeight:"calc(92vh - 16px)",overflowY:"auto"}}>
          <div className="relative h-64 mx-4 mt-3 rounded-2xl overflow-hidden hero-reveal">
            <EventImage src={event.image} gradient={event.gradient} className="w-full h-full" alt={event.title}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"/>
            <div className="absolute top-3 left-3 right-3 flex justify-between">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{background:"rgba(0,0,0,0.45)"}}>{event.category}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${event.priceNum===0?"bg-green-500 text-white":"text-white"}`} style={event.priceNum!==0?{background:"rgba(0,0,0,0.45)"}:{}}>{event.price}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-2xl font-black leading-tight">{event.title}</p>
              {event.movieGenre && <p className="text-orange-300 text-xs font-semibold mt-0.5">{event.movieRating} · {event.movieRuntime} · {event.movieGenre}</p>}
            </div>
          </div>
          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-3.5 ${rowBg}`}><p className={`text-xs font-bold mb-1 ${sc}`}>📅 DATE</p>
                <p className={`font-bold text-sm ${tc}`}>{parseDate(event.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}{event.endDate&&` – ${parseDate(event.endDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}</p>
              </div>
              <div className={`rounded-2xl p-3.5 ${rowBg}`}><p className={`text-xs font-bold mb-1 ${sc}`}>🕐 TIME</p>
                <p className={`font-bold text-sm ${tc}`}>{event.time}{event.endTime?` – ${event.endTime}`:""}</p>
              </div>
            </div>
            <div className={`rounded-2xl p-3.5 ${rowBg}`}>
              <p className={`text-xs font-bold mb-1 ${sc}`}>📍 LOCATION</p>
              <p className={`font-bold text-sm ${tc}`}>{event.location}</p>
              <p className={`text-xs mt-1 ${sc}`}>{event.address}</p>
              {event.theaters && <div className="mt-2">{event.theaters.map(t=><p key={t} className={`text-xs ${sc}`}>• {t}</p>)}</div>}
              <button onClick={()=>window.open(`https://maps.google.com?q=${encodeURIComponent(event.address)}`)} className="mt-2 text-xs font-semibold text-orange-500">Open in Maps →</button>
            </div>
            <div className="flex items-center gap-2"><span className={`text-xs ${sc}`}>Source:</span><SourceBadge source={event.source} dark={dark}/></div>
            {event.accessibility&&<div className={`rounded-2xl p-3.5 ${rowBg} flex gap-2`}><span className="text-base">♿</span><p className={`text-xs ${sc}`}>{event.accessibility}</p></div>}
            <div><p className={`text-xs font-bold mb-2 ${sc}`}>ABOUT THIS EVENT</p><p className={`text-sm leading-relaxed ${d?"text-white/80":"text-gray-600"}`}>{event.description}</p></div>
            {event.tags&&event.tags.length>0&&<div className="flex flex-wrap gap-2">{event.tags.map(tag=><span key={tag} className={`px-3 py-1 rounded-full text-xs font-medium ${d?"bg-white/8 text-white/55":"bg-gray-100 text-gray-500"}`}>#{tag}</span>)}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={()=>{downloadICS(event);setCalAdded(true);setTimeout(()=>setCalAdded(false),3000);}}
                className={`flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-97 ${calAdded?"bg-green-500 text-white":d?"bg-white/10 text-white":"bg-gray-100 text-gray-900"}`}>
                {calAdded?"✓ Added!":"📅 Add to Calendar"}
              </button>
              {(event.ticketUrl||event.website)&&(
                <button onClick={()=>window.open(event.ticketUrl||event.website)}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center active:scale-97 transition-all"
                  style={{background:event.gradient}}>
                  {event.ticketUrl?"Get Tickets →":"More Info →"}
                </button>
              )}
            </div>
            <div className="pb-6"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Card ────────────────────────────────────────────────────────────────
function HeroCard({ event, onClick }: { event:Event; dark?:boolean; onClick:()=>void }) {
  return (
    <div className="event-card mx-4 rounded-3xl overflow-hidden cursor-pointer relative hero-reveal" style={{height:320}} onClick={onClick}>
      <EventImage src={event.image} gradient={event.gradient} className="absolute inset-0 w-full h-full" alt={event.title}/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent"/>
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="px-2.5 py-1 rounded-full text-xs font-black text-white tracking-wider" style={{background:"rgba(255,69,0,0.9)"}}>Featured</span>
        {event.priceNum===0&&<span className="px-2.5 py-1 rounded-full text-xs font-bold text-white bg-green-500">Free</span>}
      </div>
      <div className="absolute top-4 right-4"><SourceBadge source={event.source} dark={true}/></div>
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <p className="text-orange-400 text-xs font-bold mb-0.5 uppercase tracking-wider">{event.category}</p>
        <h2 className="text-white font-black text-2xl leading-tight mb-2">{event.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/65 text-xs">{parseDate(event.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}{event.endDate&&` – ${parseDate(event.endDate).toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}</span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/65 text-xs">{event.time}</span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/65 text-xs truncate max-w-[130px]">{event.location}</span>
        </div>
        <p className="text-white font-bold text-sm mt-1.5">{event.price}</p>
      </div>
    </div>
  );
}

// ─── Event Card (grid) ────────────────────────────────────────────────────────
function EventCard({ event, dark, onClick }: { event:Event; dark:boolean; onClick:()=>void }) {
  const d=dark;
  return (
    <div className={`event-card rounded-2xl overflow-hidden cursor-pointer ${d?"bg-[#1c1c1e]":"bg-white"}`}
      style={{boxShadow:d?"0 2px 16px rgba(0,0,0,0.3)":"0 2px 20px rgba(0,0,0,0.07)"}} onClick={onClick}>
      <div className="relative h-40 overflow-hidden">
        <EventImage src={event.image} gradient={event.gradient} className="w-full h-full" alt={event.title}/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"/>
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded-lg text-xs font-black text-white" style={{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)"}}>
            {parseDate(event.date).toLocaleDateString("en-US",{month:"short",day:"numeric"}).toUpperCase()}
          </span>
        </div>
        <div className="absolute top-2.5 right-2.5">
          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${event.priceNum===0?"bg-green-500 text-white":"text-white"}`}
            style={event.priceNum!==0?{background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)"}:{}}>
            {event.price}
          </span>
        </div>
        {event.featured&&<div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-lg bg-orange-500 text-white text-xs font-black">HOT</div>}
      </div>
      <div className="p-3">
        <p className={`font-black text-sm leading-snug mb-1.5 ${d?"text-white":"text-gray-900"}`}>{event.title}</p>
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d?"bg-white/8 text-white/55":"bg-gray-100 text-gray-500"}`}>{event.category}</span>
          <span className={`text-xs ${d?"text-white/35":"text-gray-300"}`}>·</span>
          <span className={`text-xs ${d?"text-white/45":"text-gray-400"}`}>{event.time.length>15?"See times":event.time}</span>
        </div>
        <SourceBadge source={event.source} dark={dark}/>
      </div>
    </div>
  );
}

// ─── Event Row (list) ─────────────────────────────────────────────────────────
function EventRow({ event, dark, onClick }: { event:Event; dark:boolean; onClick:()=>void }) {
  const d=dark;
  return (
    <div className={`event-card flex items-center gap-3 p-3 rounded-2xl cursor-pointer ${d?"bg-[#1c1c1e]":"bg-white"}`}
      style={{boxShadow:d?"0 1px 8px rgba(0,0,0,0.25)":"0 1px 8px rgba(0,0,0,0.06)"}} onClick={onClick}>
      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
        <EventImage src={event.image} gradient={event.gradient} className="w-full h-full" alt=""/>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm leading-snug truncate ${d?"text-white":"text-gray-900"}`}>{event.title}</p>
        <p className={`text-xs mt-0.5 truncate ${d?"text-white/45":"text-gray-400"}`}>{event.time} · {event.location}</p>
        <div className="flex items-center gap-2 mt-1.5"><SourceBadge source={event.source} dark={dark}/><span className={`text-xs font-bold ${event.priceNum===0?"text-green-500":d?"text-white/65":"text-gray-600"}`}>{event.price}</span></div>
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="flex-shrink-0"><path d="M1 1L6 6L1 11" stroke={d?"rgba(255,255,255,0.25)":"rgba(0,0,0,0.2)"} strokeWidth="2" strokeLinecap="round"/></svg>
    </div>
  );
}

// ─── Leaflet Map helpers ──────────────────────────────────────────────────────
function createPlaceIcon(category: PlaceCategory, isSelected = false) {
  const catMeta = PLACE_CATEGORIES.find(c => c.label === category);
  const emoji = catMeta?.emoji || "📍";
  const color = catMeta?.color || "#FF4500";
  const size = isSelected ? 44 : 36;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:${isSelected?20:16}px;box-shadow:0 3px 12px rgba(0,0,0,0.35);border:3px solid white;transition:all 0.2s;">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
function createUserIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#007AFF;border:3px solid white;box-shadow:0 0 0 5px rgba(0,122,255,0.25);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Recenter map when user location changes
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center]);
  return null;
}

// ─── Place Detail Sheet ───────────────────────────────────────────────────────
function PlaceDetailSheet({ place, dark, onClose, distance }: {
  place: Place; dark: boolean; onClose: () => void; distance?: number;
}) {
  const touchStartY = useRef(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const d = dark, tc = d ? "text-white" : "text-gray-900", sc = d ? "text-white/50" : "text-gray-400", rowBg = d ? "bg-white/6" : "bg-gray-50";
  const catMeta = PLACE_CATEGORIES.find(c => c.label === place.category);
  const priceStr = "$".repeat(place.priceLevel);
  const stars = "★".repeat(Math.floor(place.rating)) + (place.rating % 1 >= 0.5 ? "½" : "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center backdrop-in"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet-in w-full max-w-[430px] rounded-t-3xl overflow-hidden ${d ? "bg-[#111]" : "bg-white"}`}
        style={{ maxHeight: "92vh", boxShadow: "0 -8px 60px rgba(0,0,0,0.4)" }}
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }}
        onTouchMove={e => { if (e.touches[0].clientY - touchStartY.current > 90) onClose(); }}>
        <div className="flex justify-center pt-3 cursor-grab active:cursor-grabbing" onClick={onClose}>
          <div className={`w-12 h-1.5 rounded-full ${d ? "bg-white/30" : "bg-black/20"}`} />
        </div>
        <div className="ios-scroll scrollbar-hide" style={{ maxHeight: "calc(92vh - 16px)", overflowY: "auto" }}>
          {/* Hero */}
          <div className="relative h-56 mx-4 mt-3 rounded-2xl overflow-hidden hero-reveal">
            <EventImage src={place.image} gradient={place.gradient} className="w-full h-full" alt={place.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
            <div className="absolute top-3 left-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: `${catMeta?.color}cc` }}>
                {catMeta?.emoji} {place.category}
              </span>
            </div>
            <div className="absolute top-3 right-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
                {priceStr}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white text-2xl font-black leading-tight">{place.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-yellow-400 text-sm">{stars}</span>
                <span className="text-white/70 text-xs">{place.rating.toFixed(1)}</span>
                {distance !== undefined && (
                  <span className="text-white/70 text-xs">· 📍 {formatDistance(distance)} away</span>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-3">
            {/* Hours & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-3.5 ${rowBg}`}>
                <p className={`text-xs font-bold mb-1 ${sc}`}>🕐 HOURS</p>
                <p className={`font-bold text-sm ${tc}`} style={{ fontSize: 11 }}>{place.hours}</p>
              </div>
              <div className={`rounded-2xl p-3.5 ${rowBg}`}>
                <p className={`text-xs font-bold mb-1 ${sc}`}>💰 PRICE</p>
                <p className={`font-bold text-sm ${tc}`}>{priceStr} {place.priceLevel === 1 ? "· Budget" : place.priceLevel === 2 ? "· Mid-range" : place.priceLevel === 3 ? "· Upscale" : "· Fine dining"}</p>
              </div>
            </div>

            {/* Location */}
            <div className={`rounded-2xl p-3.5 ${rowBg}`}>
              <p className={`text-xs font-bold mb-1 ${sc}`}>📍 LOCATION</p>
              <p className={`font-bold text-sm ${tc}`}>{place.address}</p>
              {distance !== undefined && (
                <p className={`text-xs mt-1 text-orange-500 font-semibold`}>{formatDistance(distance)} from your location</p>
              )}
              <button onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(place.address)}`)}
                className="mt-2 text-xs font-semibold text-orange-500">Open in Maps →</button>
            </div>

            {/* Contact */}
            {(place.phone || place.website) && (
              <div className="flex gap-3">
                {place.phone && (
                  <button onClick={() => window.open(`tel:${place.phone}`)}
                    className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${d ? "bg-white/8 text-white" : "bg-gray-100 text-gray-900"}`}>
                    📞 Call
                  </button>
                )}
                {place.website && (
                  <button onClick={() => window.open(place.website)}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
                    style={{ background: catMeta?.color || "#FF4500" }}>
                    🌐 Website
                  </button>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <p className={`text-xs font-bold mb-2 ${sc}`}>ABOUT</p>
              <p className={`text-sm leading-relaxed ${d ? "text-white/80" : "text-gray-600"}`}>{place.description}</p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {place.isKidFriendly && <span className={`px-3 py-1 rounded-full text-xs font-medium ${d ? "bg-white/8 text-white/55" : "bg-gray-100 text-gray-500"}`}>👶 Kid-friendly</span>}
              {place.isOutdoor && <span className={`px-3 py-1 rounded-full text-xs font-medium ${d ? "bg-white/8 text-white/55" : "bg-gray-100 text-gray-500"}`}>🌿 Outdoor</span>}
              {place.isAccessible && <span className={`px-3 py-1 rounded-full text-xs font-medium ${d ? "bg-white/8 text-white/55" : "bg-gray-100 text-gray-500"}`}>♿ Accessible</span>}
              {place.tags.map(tag => (
                <span key={tag} className={`px-3 py-1 rounded-full text-xs font-medium ${d ? "bg-white/8 text-white/55" : "bg-gray-100 text-gray-500"}`}>#{tag}</span>
              ))}
            </div>

            <div className="pb-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────
function PlaceCard({ place, dark, onClick, distance }: { place: Place; dark: boolean; onClick: () => void; distance?: number }) {
  const d = dark;
  const catMeta = PLACE_CATEGORIES.find(c => c.label === place.category);
  const priceStr = "$".repeat(place.priceLevel);
  const stars = Math.floor(place.rating);
  return (
    <div className={`event-card rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 ${d ? "bg-[#1c1c1e]" : "bg-white"}`}
      style={{ width: 200, boxShadow: d ? "0 2px 16px rgba(0,0,0,0.3)" : "0 2px 20px rgba(0,0,0,0.07)" }}
      onClick={onClick}>
      <div className="relative overflow-hidden" style={{ height: 140 }}>
        <EventImage src={place.image} gradient={place.gradient} className="w-full h-full" alt={place.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-lg text-xs font-black text-white" style={{ background: `${catMeta?.color}dd` }}>{catMeta?.emoji} {place.category}</span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold text-white" style={{ background: "rgba(0,0,0,0.5)" }}>{priceStr}</span>
        </div>
        {distance !== undefined && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-orange-500">{formatDistance(distance)}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className={`font-black text-sm leading-snug mb-1 ${d ? "text-white" : "text-gray-900"}`}>{place.name}</p>
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-xs">{"★".repeat(stars)}</span>
          <span className={`text-xs ${d ? "text-white/40" : "text-gray-400"}`}>{place.rating}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Places View ─────────────────────────────────────────────────────────────
function PlacesView({ dark }: { dark: boolean }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [radius, setRadius] = useState<number>(0); // 0 = any
  const [selectedCats, setSelectedCats] = useState<Set<PlaceCategory>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapView, setMapView] = useState(false);
  const [osmPlaces, setOsmPlaces] = useState<Place[]>([]);
  const [osmLoading, setOsmLoading] = useState(true);
  const [osmError, setOsmError] = useState(false);
  const ABQ_CENTER: [number, number] = [35.0844, -106.6504];

  // Places data source info
  const [dataSource, setDataSource] = useState<"static" | "osm" | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null); // ms since last fetch
  const [refreshing, setRefreshing] = useState(false);

  // Core fetch function — loads static JSON first for instant display,
  // then always augments with live OSM data to provide hundreds of places.
  const doFetch = (controller: AbortController, onDone?: () => void) => {
    // 1. Load static curated places instantly
    fetchStaticPlaces(
      (batch) => {
        if (controller.signal.aborted) return;
        setOsmPlaces(batch);
        setDataSource("static");
        setOsmLoading(false);
        setCacheAge(0);
      },
      controller.signal
    )
    .then(() => {
      if (controller.signal.aborted) return;

      // 2. In parallel: load Google Places JSON + OSM data
      Promise.allSettled([
        fetchGooglePlacesData(),
        fetchOSMPlaces(controller.signal),
      ]).then(([gpResult, osmResult]) => {
        if (controller.signal.aborted) return;
        setOsmPlaces(prev => {
          let merged = [...prev];
          const seen = new Set(merged.map(p => p.name.toLowerCase()));
          // Add Google Places results first (higher quality data)
          if (gpResult.status === "fulfilled" && gpResult.value.length > 0) {
            for (const p of gpResult.value) {
              if (!seen.has(p.name.toLowerCase())) { merged.push(p); seen.add(p.name.toLowerCase()); }
            }
          }
          // Then add OSM results
          if (osmResult.status === "fulfilled") {
            for (const p of osmResult.value) {
              if (!seen.has(p.name.toLowerCase())) { merged.push(p); seen.add(p.name.toLowerCase()); }
            }
          }
          savePlacesCache(merged, "osm");
          return merged;
        });
        setDataSource(gpResult.status === "fulfilled" && gpResult.value.length > 0 ? "static" : "osm");
        onDone?.();
      });
    })
    .catch(err => {
      if (err.name === "AbortError") return;
      // Static file unavailable — fall back to OSM only
      fetchOSMPlaces(controller.signal)
        .then(places => {
          if (!controller.signal.aborted) {
            setOsmPlaces(places); setDataSource("osm"); setOsmLoading(false);
            savePlacesCache(places, "osm"); setCacheAge(0); onDone?.();
          }
        })
        .catch(() => { if (!controller.signal.aborted) { setOsmError(true); setOsmLoading(false); onDone?.(); } });
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setOsmError(false);

    const cached = loadPlacesCache();

    if (cached) {
      // Show cached data immediately — no loading state needed
      setOsmPlaces(cached.places);
      setDataSource(cached.source);
      setOsmLoading(false);
      const ageMs = Date.now() - cached.timestamp;
      setCacheAge(ageMs);

      if (isCacheStale(cached)) {
        // Silently refresh in the background
        setRefreshing(true);
        setOsmPlaces([]); // clear so fresh results stream in cleanly
        doFetch(controller, () => setRefreshing(false));
      }
    } else {
      // No cache — show loading and fetch
      setOsmLoading(true);
      setOsmPlaces([]);
      doFetch(controller);
    }

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestLocation = () => {
    setLocationLoading(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLocation([pos.coords.latitude, pos.coords.longitude]); setLocationLoading(false); },
      () => { setLocationLoading(false); setLocationError(true); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const toggleCat = (cat: PlaceCategory) => setSelectedCats(prev => {
    const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s;
  });

  // Merge featured + OSM, deduplicated by name
  const allPlaces = useMemo(() => {
    const featuredNames = new Set(FEATURED_PLACES.map(p => p.name.toLowerCase()));
    const deduped = osmPlaces.filter(p => !featuredNames.has(p.name.toLowerCase()));
    return [...FEATURED_PLACES, ...deduped];
  }, [osmPlaces]);

  const filteredPlaces = useMemo(() => {
    let places = allPlaces;
    if (selectedCats.size > 0) places = places.filter(p => selectedCats.has(p.category));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      places = places.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)));
    }
    if (userLocation && radius > 0) {
      places = places.filter(p => getDistance(userLocation[0], userLocation[1], p.lat, p.lng) <= radius);
    }
    if (userLocation) {
      places = [...places].sort((a, b) =>
        getDistance(userLocation[0], userLocation[1], a.lat, a.lng) -
        getDistance(userLocation[0], userLocation[1], b.lat, b.lng)
      );
    }
    return places;
  }, [allPlaces, selectedCats, userLocation, radius, searchQuery]);

  const tc = dark ? "text-white" : "text-gray-900";
  const sc = dark ? "text-white/45" : "text-gray-400";
  const bg2 = dark ? "bg-[#1c1c1e]" : "bg-white";
  const mapCenter = userLocation || ABQ_CENTER;
  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const RADIUS_OPTS = [
    { label: "Any", value: 0 },
    { label: "½ mi", value: 0.5 },
    { label: "1 mi", value: 1 },
    { label: "2 mi", value: 2 },
    { label: "5 mi", value: 5 },
    { label: "10 mi", value: 10 },
  ];

  return (
    <div className="flex-1 ios-scroll scrollbar-hide pb-28">
      {/* Location + Search bar */}
      <div className="px-4 pt-1 pb-2 space-y-2">
        <div className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 ${bg2}`}
          style={{ boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
          <span className={sc}>🔍</span>
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search restaurants, parks, coffee..."
            className={`flex-1 bg-transparent text-sm outline-none ${tc} placeholder-gray-400`}
          />
          {searchQuery && <button onClick={() => setSearchQuery("")} className={`text-sm ${sc}`}>✕</button>}
        </div>

        {/* Live data status */}
        {osmLoading && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${dark ? "bg-white/5 text-white/50" : "bg-black/4 text-gray-500"}`}>
            <span className="dot-bounce inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
            Loading places…
          </div>
        )}
        {refreshing && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs ${dark ? "bg-white/5 text-white/40" : "bg-black/4 text-gray-400"}`}>
            <span className="dot-bounce inline-block w-1.5 h-1.5 rounded-full bg-orange-400" />
            Refreshing places in background…
          </div>
        )}
        {!osmLoading && !refreshing && !osmError && allPlaces.length > 0 && (
          <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs ${dark ? "bg-white/5 text-white/40" : "bg-black/4 text-gray-400"}`}>
            <span>
              ✓ {allPlaces.length.toLocaleString()} places
              {cacheAge !== null && cacheAge > 0
                ? ` · cached ${cacheAge < 3600000 ? `${Math.round(cacheAge/60000)}m` : `${Math.round(cacheAge/3600000)}h`} ago`
                : dataSource === "osm" ? " via OpenStreetMap" : ""}
            </span>
            <button
              onClick={() => {
                clearPlacesCache();
                setCacheAge(null);
                setRefreshing(true);
                setOsmPlaces([]);
                setOsmLoading(true);
                const c = new AbortController();
                doFetch(c, () => setRefreshing(false));
              }}
              className={`ml-2 text-xs underline underline-offset-2 ${dark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"} transition-colors`}>
              Refresh
            </button>
          </div>
        )}
        {osmError && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-orange-500 ${dark ? "bg-orange-500/10" : "bg-orange-50"}`}>
            <span>⚠️</span>
            <span>Couldn't load live data — showing curated highlights</span>
          </div>
        )}

        {/* Location button + radius */}
        <div className="flex items-center gap-2">
          <button
            onClick={requestLocation}
            disabled={locationLoading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black border-2 transition-all active:scale-95 flex-shrink-0 ${
              userLocation ? "border-orange-500 text-white" : dark ? "border-white/15 text-white/70" : "border-gray-300 text-gray-700"
            }`}
            style={userLocation ? { background: "#FF4500", boxShadow: "0 4px 14px rgba(255,69,0,0.35)" } : {}}>
            {locationLoading ? "⏳" : userLocation ? "📍" : "📍"}
            {locationLoading ? " Finding..." : userLocation ? " Near Me" : " Use My Location"}
          </button>

          {userLocation && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {RADIUS_OPTS.map(opt => (
                <button key={opt.value} onClick={() => setRadius(opt.value)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    radius === opt.value
                      ? "border-orange-500 text-orange-500 bg-orange-50"
                      : dark ? "border-white/15 text-white/55" : "border-gray-200 text-gray-500"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {locationError && <p className="text-xs text-red-400 px-1">Couldn't get location — check permissions and try again.</p>}
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2">
        {PLACE_CATEGORIES.map(cat => {
          const active = selectedCats.has(cat.label);
          return (
            <button key={cat.label} onClick={() => toggleCat(cat.label)}
              className={`filter-pill flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${
                active ? "border-transparent text-white shadow-md" : dark ? "bg-transparent text-white/55 border-white/12" : "bg-white text-gray-600 border-gray-200"
              }`}
              style={active ? { background: cat.color, boxShadow: `0 4px 14px ${cat.color}55` } : {}}>
              {cat.emoji} {cat.label}
            </button>
          );
        })}
        {selectedCats.size > 0 && (
          <button onClick={() => setSelectedCats(new Set())}
            className="filter-pill flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold text-orange-500 border border-orange-500/30">
            Clear ✕
          </button>
        )}
      </div>

      {/* Map / List toggle + count */}
      <div className="flex items-center justify-between px-4 mb-2">
        <p className={`text-sm font-black ${tc}`}>
          {filteredPlaces.length} place{filteredPlaces.length !== 1 ? "s" : ""}{userLocation ? " nearby" : " in ABQ"}
        </p>
        <div className="flex gap-1">
          {([false, true] as const).map(isMap => (
            <button key={String(isMap)} onClick={() => setMapView(isMap)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${mapView === isMap ? dark ? "bg-white/15 text-white" : "bg-gray-900 text-white" : dark ? "text-white/30" : "text-gray-400"}`}>
              {isMap ? "🗺️" : "☰"}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAP VIEW ── */}
      {mapView && (
        <div className="px-4 mb-3" style={{ animation: "fade-in 0.3s ease both" }}>
          <div className="rounded-2xl overflow-hidden" style={{ height: 280, boxShadow: dark ? "0 4px 24px rgba(0,0,0,0.5)" : "0 4px 24px rgba(0,0,0,0.12)" }}>
            <MapContainer
              center={mapCenter}
              zoom={12}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}>
              <MapController center={mapCenter} />
              <TileLayer url={tileUrl} attribution='© <a href="https://carto.com">CartoDB</a>' />
              {filteredPlaces.map(place => (
                <Marker
                  key={place.id}
                  position={[place.lat, place.lng]}
                  icon={createPlaceIcon(place.category, selectedPlace?.id === place.id)}
                  eventHandlers={{ click: () => setSelectedPlace(place) }}
                />
              ))}
              {userLocation && <Marker position={userLocation} icon={createUserIcon()} />}
            </MapContainer>
          </div>
          {/* Scrollable cards below map */}
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pt-3 pb-1">
            {filteredPlaces.map((place, idx) => {
              const dist = userLocation ? getDistance(userLocation[0], userLocation[1], place.lat, place.lng) : undefined;
              return (
                <div key={place.id} style={{ animation: `card-reveal 0.35s ease ${idx * 50}ms both` }}>
                  <PlaceCard place={place} dark={dark} onClick={() => setSelectedPlace(place)} distance={dist} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!mapView && (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filteredPlaces.map((place, idx) => {
            const dist = userLocation ? getDistance(userLocation[0], userLocation[1], place.lat, place.lng) : undefined;
            return (
              <div key={place.id} style={{ animation: `card-reveal 0.38s ease ${Math.min(idx * 55, 500)}ms both` }}>
                <PlaceCard place={place} dark={dark} onClick={() => setSelectedPlace(place)} distance={dist} />
              </div>
            );
          })}
          {filteredPlaces.length === 0 && (
            <div className="col-span-2 flex flex-col items-center py-16 text-center">
              <ZiaSymbol size={60} color={dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} className="mb-3" />
              <p className={`font-black text-xl ${tc}`}>No places found</p>
              <p className={`text-sm mt-1 ${sc}`}>Try expanding your radius or clearing filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Place Detail Sheet */}
      {selectedPlace && (
        <PlaceDetailSheet
          place={selectedPlace} dark={dark} onClose={() => setSelectedPlace(null)}
          distance={userLocation ? getDistance(userLocation[0], userLocation[1], selectedPlace.lat, selectedPlace.lng) : undefined}
        />
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState<"events" | "places">("events");
  const [weekend] = useState(() => getUpcomingWeekend());
  const [rangeStart, setRangeStart] = useState(weekend[0]);
  const [rangeEnd,   setRangeEnd]   = useState(weekend[1]);
  const [dark, setDark]             = useState(false);
  const [filters, setFilters]       = useState<FilterState>(EMPTY_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showCalendar, setShowCalendar]   = useState(false);
  const [showFilters,  setShowFilters]    = useState(false);
  const [searchQuery,  setSearchQuery]    = useState("");
  const [showSearch,   setShowSearch]     = useState(false);
  const [viewMode,     setViewMode]       = useState<"grid" | "list">("grid");
  const [liveEvents,   setLiveEvents]     = useState<Event[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showSearch && searchRef.current) searchRef.current.focus(); }, [showSearch]);

  // Sync dark mode to <html> so iOS overscroll area and safe-zone bg match the app
  useEffect(() => {
    document.documentElement.style.backgroundColor = dark ? "#000" : "#F4F4F0";
  }, [dark]);

  // Load live Ticketmaster events from pre-baked JSON on mount
  useEffect(() => {
    fetchLiveEvents().then(evs => { if (evs.length > 0) setLiveEvents(evs); });
  }, []);

  // Merged events: static curated + live Ticketmaster (deduplicated)
  const allEvents = useMemo(() => liveEvents.length ? mergeEvents(ALL_EVENTS, liveEvents) : ALL_EVENTS, [liveEvents]);

  // Dynamic event dates for calendar dots (updates when live events load)
  const eventDates = useMemo(() => liveEvents.length ? computeEventDates(allEvents) : EVENT_DATES, [allEvents, liveEvents]);

  const rangeEvents = useMemo(() => getEventsForRange(rangeStart, rangeEnd, liveEvents), [rangeStart, rangeEnd, liveEvents]);
  const filteredEvents = useMemo(() =>
    rangeEvents
      .filter(ev => matchesFilters(ev, filters))
      .filter(ev => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return ev.title.toLowerCase().includes(q) || ev.category.toLowerCase().includes(q)
          || ev.location.toLowerCase().includes(q) || ev.description.toLowerCase().includes(q)
          || (ev.tags || []).some(t => t.toLowerCase().includes(q));
      }),
    [rangeEvents, filters, searchQuery]);

  const heroEvent = filteredEvents.find(e => e.featured) || filteredEvents[0];
  const remainingEvents = filteredEvents.filter(e => e.id !== heroEvent?.id);
  const activeFilterCount = countActiveFilters(filters);
  const eventsAnimKey = useMemo(() =>
    `${rangeStart}-${rangeEnd}-${filters.price}-${[...filters.categories].sort().join(",")}-${[...filters.timeOfDay].sort().join(",")}-${[...filters.tags].sort().join(",")}`,
    [rangeStart, rangeEnd, filters]);

  const bg      = dark ? "bg-[#000]"     : "bg-[#F4F4F0]";
  const tc      = dark ? "text-white"    : "text-gray-900";
  const sc      = dark ? "text-white/45" : "text-gray-400";
  const divider = dark ? "border-white/8" : "border-black/8";
  const wkLabel  = isWeekendRange(rangeStart, rangeEnd) ? "Weekend · " : "";
  const dateDisp = rangeLabel(rangeStart, rangeEnd);

  return (
    <div className={`theme-transition ${bg} min-h-screen w-full flex flex-col`}>

      {/* Header — safe-area-inset-top ensures content clears Dynamic Island / notch */}
      <div className={`${dark ? "bg-black" : "bg-[#F4F4F0]"} px-5 pb-2 z-20`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
        <div className="flex items-start justify-between mb-2">
          <AppLogo dark={dark} subtitle={mode === "events"
            ? `Albuquerque, NM · ${filteredEvents.length} event${filteredEvents.length !== 1 ? "s" : ""} found`
            : "Albuquerque, NM · Restaurants, parks & more"}
          />
          <button onClick={() => setDark(d => !d)}
            className={`mt-1 w-12 h-7 rounded-full relative transition-all duration-300 ${dark ? "bg-[#2c2c2e]" : "bg-gray-200"}`}>
            <div className={`absolute top-0.5 w-6 h-6 rounded-full shadow transition-all duration-300 flex items-center justify-center text-xs ${dark ? "translate-x-5 bg-white" : "translate-x-0.5 bg-white"}`}>
              {dark ? "🌙" : "☀️"}
            </div>
          </button>
        </div>

        {/* Mode toggle */}
        <div className={`flex gap-1 p-0.5 rounded-full mb-2 ${dark ? "bg-white/8" : "bg-black/8"}`}>
          {([["events", "🎉 Events"], ["places", "🗺️ Places"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded-full text-xs font-black transition-all ${mode === m ? "text-gray-900 shadow-sm" : sc}`}
              style={mode === m ? { background: "white" } : {}}>
              {label}
            </button>
          ))}
        </div>

        {/* Events: date picker + search bar row */}
        {mode === "events" && (
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowCalendar(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs transition-all active:scale-95 flex-1 justify-center ${showCalendar ? "text-white" : dark ? "bg-white/8 text-white" : "bg-gray-100 text-gray-700"}`}
              style={showCalendar ? { background: "#FF4500" } : {}}>
              <span>📅</span>
              <span className="whitespace-nowrap">{wkLabel}{dateDisp}</span>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ transform: showCalendar ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(""); }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 flex-shrink-0 ${showSearch ? "bg-orange-500 text-white" : dark ? "bg-white/8 text-white" : "bg-gray-100 text-gray-700"}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
          </div>
        )}
        {mode === "events" && showSearch && (
          <div className={`rounded-2xl flex items-center gap-2 px-4 mb-2 spring-in ${dark ? "bg-[#1c1c1e]" : "bg-white"}`}
            style={{ boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.08)" }}>
            <span className={sc}>🔍</span>
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events, venues, movies..."
              className={`flex-1 py-3 bg-transparent text-sm outline-none ${tc} placeholder-gray-400`} />
            {searchQuery && <button onClick={() => setSearchQuery("")} className={`text-sm ${sc}`}>✕</button>}
          </div>
        )}
      </div>

      {/* ── EVENTS MODE ── */}
      {mode === "events" && (
        <div className="flex-1 ios-scroll scrollbar-hide pb-28">
          {/* Filter pills row — category quick-filters */}
          <div className="mb-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 py-1">
              {CATEGORIES.map(cat => {
                const active = filters.categories.has(cat.label);
                return (
                  <button key={cat.label}
                    onClick={() => setFilters(prev => { const cats = new Set(prev.categories); cats.has(cat.label) ? cats.delete(cat.label) : cats.add(cat.label); return { ...prev, categories: cats }; })}
                    className={`filter-pill flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all ${active ? "border-transparent text-white shadow-md" : dark ? "bg-transparent text-white/55 border-white/12" : "bg-white text-gray-600 border-gray-200"}`}
                    style={active ? { background: cat.color, boxShadow: `0 4px 14px ${cat.color}55` } : {}}>
                    {cat.emoji} {cat.label}
                  </button>
                );
              })}
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)}
                  className="filter-pill flex-shrink-0 px-3 py-2 rounded-full text-xs font-bold text-orange-500 border border-orange-500/30 transition-all">
                  Clear ✕
                </button>
              )}
            </div>
          </div>

          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center spring-in">
              <ZiaSymbol size={72} color={dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"} className="mb-4" />
              <p className={`text-2xl font-black ${tc}`}>Nothing found!</p>
              <p className={`text-sm mt-2 ${sc}`}>{rangeEvents.length > 0 ? "Try adjusting your filters." : "No events in this date range."}</p>
              <button onClick={() => { const [s, e] = getUpcomingWeekend(); setRangeStart(s); setRangeEnd(e); setFilters(EMPTY_FILTERS); }}
                className="mt-5 px-5 py-3 rounded-2xl font-bold text-sm text-white" style={{ background: "#FF4500" }}>
                Jump to Next Events
              </button>
            </div>
          )}

          {heroEvent && (
            <div className="mb-4" key={`hero-${eventsAnimKey}`}>
              <HeroCard event={heroEvent} dark={dark} onClick={() => setSelectedEvent(heroEvent)} />
            </div>
          )}

          {remainingEvents.length > 0 && (
            <div className="flex items-center justify-between px-5 mb-3">
              <p className={`text-base font-black ${tc}`}>{wkLabel}{dateDisp}</p>
              <div className="flex items-center gap-1.5">
                {(["grid", "list"] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${viewMode === m ? dark ? "bg-white/15 text-white" : "bg-gray-900 text-white" : dark ? "text-white/30" : "text-gray-400"}`}>
                    {m === "grid" ? "⊞" : "☰"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === "grid" ? (
            <div key={`grid-${eventsAnimKey}`} className="px-4 grid grid-cols-2 gap-3">
              {remainingEvents.map((ev, idx) => (
                <div key={ev.id} style={{ animation: `card-reveal 0.42s ease ${Math.min(idx * 60, 540)}ms both` }}>
                  <EventCard event={ev} dark={dark} onClick={() => setSelectedEvent(ev)} />
                </div>
              ))}
            </div>
          ) : (
            <div key={`list-${eventsAnimKey}`} className="px-4 space-y-2.5">
              {remainingEvents.map((ev, idx) => (
                <div key={ev.id} style={{ animation: `card-reveal 0.42s ease ${Math.min(idx * 55, 500)}ms both` }}>
                  <EventRow event={ev} dark={dark} onClick={() => setSelectedEvent(ev)} />
                </div>
              ))}
            </div>
          )}
          <div className="h-6" />
        </div>
      )}

      {/* ── PLACES MODE ── */}
      {mode === "places" && <PlacesView dark={dark} />}

      {/* Safe-area bottom filler — solid color eliminates white gap on iOS home indicator */}
      <div className={`fixed bottom-0 left-0 right-0 z-[29] ${dark ? "bg-[#111]" : "bg-white"}`}
        style={{ height: "env(safe-area-inset-bottom, 0px)" }} />

      {/* ── Bottom Nav ── */}
      <div className={`fixed left-0 right-0 w-full z-30 nav-entrance ${dark ? "bg-[#111]/92" : "bg-white/92"} border-t ${divider}`}
        style={{ backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", bottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-2.5 gap-2">

          {/* Ko-Fi donate button */}
          <a href="https://ko-fi.com/stopscrolling" target="_blank" rel="noopener noreferrer"
            title="Buy me a coffee on Ko-fi"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 ${dark ? "bg-white/8 text-white/55 hover:text-white/90" : "bg-gray-100 text-gray-400 hover:text-gray-700"}`}>
            <span>☕</span>
            <span>Support</span>
          </a>

          {/* Events mode: filter button */}
          {mode === "events" && (
            <button onClick={() => setShowFilters(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black border-2 transition-all active:scale-95 relative ${activeFilterCount > 0 ? "border-orange-500 text-white" : dark ? "border-white/12 text-white/70" : "border-gray-300 text-gray-700 bg-white"}`}
              style={activeFilterCount > 0 ? { background: "#FF4500", boxShadow: "0 4px 16px rgba(255,69,0,0.35)" } : {}}>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 1h12M3 5h8M5 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Filters
              {activeFilterCount > 0 && <span className="bg-white text-orange-500 rounded-full w-4 h-4 flex items-center justify-center font-black text-xs">{activeFilterCount}</span>}
            </button>
          )}

          {mode === "places" && (
            <p className={`text-xs font-semibold ${sc} flex-1 text-center`}>
              Explore Albuquerque
            </p>
          )}
        </div>
      </div>

      {/* Calendar sheet */}
      {showCalendar && (
        <div className="fixed inset-0 z-40 flex items-end justify-center backdrop-in"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCalendar(false); }}>
          <div className="w-full max-w-[430px] px-3 pb-3">
            <RangeCalendar rangeStart={rangeStart} rangeEnd={rangeEnd}
              onRangeChange={(s, e) => { setRangeStart(s); setRangeEnd(e); }} dark={dark} onClose={() => setShowCalendar(false)} eventDates={eventDates} />
          </div>
        </div>
      )}

      {showFilters && (
        <FilterSheet filters={filters} onApply={setFilters} onClose={() => setShowFilters(false)}
          dark={dark} allEvents={getEventsForRange(rangeStart, rangeEnd)} />
      )}

      {selectedEvent && <EventDetailSheet event={selectedEvent} dark={dark} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
