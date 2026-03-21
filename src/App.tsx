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
  FEATURED_PLACES, PLACE_CATKCORIES, getDistance, formatDistance,
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
  const esc = (str: string) => str.replace(/\,;\\]/g, "\\$&").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Explore ABQ//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${y}${mo}${d}T${p(s.h)}${p(s.m)}00`,
    `DTEND:${y}${mo}${$}T${p(e.h)}${p(e.m)}00`,
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
  I