// ABQ Unplugged — Notification System
// Handles: permission, preferences, local scheduled notifications, VAPID push subscription

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotificationPrefs {
  enabled: boolean;
  tonight: boolean;        // Daily 5pm: "X events tonight in ABQ"
  weekend: boolean;        // Thu/Fri 9am: "X events this weekend"
  newEvents: boolean;      // When 10+ new events detected vs last visit
  freeEvents: boolean;     // Fri/Sat morning: free event roundup
  myCategories: boolean;   // Monday: alerts for followed genre events this week
  streakReminder: boolean; // Evening: keep your check-in streak alive
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  tonight: true,
  weekend: true,
  newEvents: true,
  freeEvents: false,
  myCategories: true,
  streakReminder: false,
};

export const NOTIF_DESCRIPTIONS: Record<keyof Omit<NotificationPrefs, 'enabled'>, string> = {
  tonight:        'Daily at 5pm — how many events are happening in ABQ tonight',
  weekend:        'Thursday & Friday — preview of weekend events in Albuquerque',
  newEvents:      'When new events are added to ABQ Unplugged',
  freeEvents:     'Friday & Saturday — roundup of free events this weekend',
  myCategories:   'Monday mornings — new events in your followed categories',
  streakReminder: 'Evening reminder to check in and keep your streak',
};

export const NOTIF_LABELS: Record<keyof Omit<NotificationPrefs, 'enabled'>, string> = {
  tonight:        '🌆 Tonight in ABQ',
  weekend:        '🗓️ Weekend Preview',
  newEvents:      '🆕 New Events Added',
  freeEvents:     '🆓 Free Events Alert',
  myCategories:   '🎸 My Category Alerts',
  streakReminder: '🏆 Streak Reminder',
};

// ── Storage keys ──────────────────────────────────────────────────────────────
const PREFS_KEY              = 'abq_notif_prefs';
const LAST_TRIGGER_PREFIX    = 'abq_notif_last_';
const LAST_EVENT_COUNT_KEY   = 'abq_notif_event_count';

// ── Preference persistence ─────────────────────────────────────────────────────
export function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: NotificationPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
  // Keep server-side prefs in sync whenever the user changes settings
  if (prefs.enabled && hasPermission()) {
    subscribeToPush(prefs).catch(() => {});
  }
}

// ── Permission helpers ─────────────────────────────────────────────────────────
export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function permissionStatus(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function hasPermission(): boolean {
  return notificationsSupported() && Notification.permission === 'granted';
}

// ── Show a notification via service worker (needed for mobile PWA) ─────────────
export async function showNotification(
  title: string,
  options: { body?: string; tag?: string; icon?: string; badge?: string; data?: Record<string, string> } = {}
): Promise<void> {
  if (!hasPermission()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      ...options,
    });
  } catch {
    // Fallback to browser Notification API
    new Notification(title, { icon: '/icons/icon-192.png', ...options });
  }
}

// ── Trigger key helpers ────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function thisWeekStr(): string {
  const d = new Date();
  const weekNum = Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

function getLastTrigger(key: string): string {
  try { return localStorage.getItem(`${LAST_TRIGGER_PREFIX}${key}`) || ''; } catch { return ''; }
}

function setLastTrigger(key: string, value?: string): void {
  try { localStorage.setItem(`${LAST_TRIGGER_PREFIX}${key}`, value ?? todayStr()); } catch {}
}

// ── Context passed by the app ──────────────────────────────────────────────────
export interface NotifContext {
  events: Array<{ startDate?: string; localDate?: string; genres?: string[]; category?: string }>;
  followedGenres: string[];
  checkInStreak: number;
}

// ── Main trigger function — call on app load & when events refresh ─────────────
export async function checkAndTriggerNotifications(
  prefs: NotificationPrefs,
  ctx: NotifContext
): Promise<void> {
  if (!prefs.enabled || !hasPermission()) return;

  const now     = new Date();
  const today   = todayStr();
  const hour    = now.getHours();
  const dow     = now.getDay(); // 0=Sun, 1=Mon … 5=Fri, 6=Sat

  // Compute weekend date strings
  const satOffset = dow === 6 ? 0 : (6 - dow + 7) % 7;
  const sunOffset = dow === 0 ? 0 : (7 - dow) % 7;
  const sat = new Date(now); sat.setDate(now.getDate() + satOffset);
  const sun = new Date(now); sun.setDate(now.getDate() + sunOffset);
  const satStr = sat.toISOString().split('T')[0];
  const sunStr = sun.toISOString().split('T')[0];

  // Helper to get event start date string (handle both field names)
  const getDate = (e: { startDate?: string; localDate?: string }) =>
    e.startDate || e.localDate || '';

  const tonightEvents  = ctx.events.filter(e => getDate(e) === today);
  const weekendEvents  = ctx.events.filter(e => getDate(e) === satStr || getDate(e) === sunStr);

  // ── 1. Tonight in ABQ — daily 5pm–9pm ──────────────────────────────────────
  if (prefs.tonight && hour >= 17 && hour < 21 && tonightEvents.length > 0) {
    if (getLastTrigger('tonight') !== today) {
      await showNotification(`🌆 ${tonightEvents.length} events tonight in ABQ`, {
        body: 'Tap to see what\'s happening in Albuquerque tonight.',
        tag: 'abq-tonight',
        data: { url: '/#events', filter: 'Tonight' },
      });
      setLastTrigger('tonight');
    }
  }

  // ── 2. Weekend Preview — Thursday & Friday, 9am–6pm ───────────────────────
  if (prefs.weekend && (dow === 4 || dow === 5) && hour >= 9 && hour < 18 && weekendEvents.length > 0) {
    if (getLastTrigger('weekend') !== today) {
      await showNotification(`🗓️ ${weekendEvents.length} events this weekend in ABQ`, {
        body: 'Your Albuquerque weekend preview is ready — tap to explore.',
        tag: 'abq-weekend',
        data: { url: '/#events', filter: 'This Weekend' },
      });
      setLastTrigger('weekend');
    }
  }

  // ── 3. New Events Added — any time, compared to last cached count ──────────
  if (prefs.newEvents) {
    const lastCount = parseInt(localStorage.getItem(LAST_EVENT_COUNT_KEY) || '0', 10);
    const currCount = ctx.events.length;
    if (lastCount > 0 && currCount > lastCount + 10) {
      const added = currCount - lastCount;
      if (getLastTrigger('newevents') !== today) {
        await showNotification(`🆕 ${added} new events added to ABQ Unplugged`, {
          body: 'Fresh events just dropped. Tap to discover what\'s new in Albuquerque.',
          tag: 'abq-new-events',
          data: { url: '/#events' },
        });
        setLastTrigger('newevents');
      }
    }
    localStorage.setItem(LAST_EVENT_COUNT_KEY, String(currCount));
  }

  // ── 4. Free Events Alert — Friday & Saturday, 9am–2pm ─────────────────────
  if (prefs.freeEvents && (dow === 5 || dow === 6) && hour >= 9 && hour < 14) {
    const freeWeekend = weekendEvents.filter(
      e => e.genres?.includes('Free') || e.category?.toLowerCase().includes('free')
    );
    if (freeWeekend.length > 0 && getLastTrigger('free') !== today) {
      await showNotification(`🆓 ${freeWeekend.length} free events this weekend in ABQ`, {
        body: 'Free things to do in Albuquerque this weekend — no ticket needed.',
        tag: 'abq-free',
        data: { url: '/#events', filter: 'Free' },
      });
      setLastTrigger('free');
    }
  }

  // ── 5. My Category Alerts — Monday morning, for followed genres ────────────
  if (prefs.myCategories && ctx.followedGenres.length > 0 && dow === 1 && hour >= 8 && hour < 12) {
    const weekKey = thisWeekStr();
    if (getLastTrigger('categories') !== weekKey) {
      const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const catEvents = ctx.events.filter(e => {
        const d = getDate(e);
        return d >= today && d <= weekEndStr &&
          e.genres?.some(g => ctx.followedGenres.includes(g));
      });
      if (catEvents.length > 0) {
        const genreLabel = ctx.followedGenres.slice(0, 2).join(' & ');
        await showNotification(`🎸 ${catEvents.length} ${genreLabel} events this week`, {
          body: 'New events in your followed categories are happening in ABQ this week.',
          tag: 'abq-categories',
          data: { url: '/#events', filter: '❤️ For You' },
        });
        setLastTrigger('categories', weekKey);
      }
    }
  }

  // ── 6. Streak Reminder — daily 7pm–10pm if streak active ──────────────────
  if (prefs.streakReminder && ctx.checkInStreak > 0 && hour >= 19 && hour < 22) {
    if (getLastTrigger('streak') !== today) {
      await showNotification(`🏆 Keep your ${ctx.checkInStreak}-day streak alive!`, {
        body: 'Check in to something in Albuquerque today before midnight.',
        tag: 'abq-streak',
        data: { url: '/#events' },
      });
      setLastTrigger('streak');
    }
  }
}

// ── VAPID Push Subscription (ready for when a backend exists) ─────────────────
// To enable true background push notifications:
//   1. Generate VAPID keys: npx web-push generate-vapid-keys
//   2. Set VAPID_PUBLIC_KEY to your public key below
//   3. Add a Netlify Function endpoint that stores subscriptions (use Supabase)
//   4. Add a Netlify scheduled function that sends pushes daily at appropriate times

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export async function subscribeToPush(prefs?: NotificationPrefs): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VAPID_PUBLIC_KEY not set — push disabled');
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Register/update subscription + prefs with our backend
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.toJSON().keys?.p256dh,
          auth:   sub.toJSON().keys?.auth,
        },
        prefs: prefs ?? loadPrefs(),
      }),
    }).catch(err => console.warn('[push] subscribe POST failed:', err));

    return sub;
  } catch (err) {
    console.warn('[push] subscribeToPush failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
