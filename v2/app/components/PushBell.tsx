'use client'

/**
 * PushBell — opt-in push notification toggle.
 *
 * Shows a bell icon button. On first click: requests Notification permission,
 * subscribes via /api/push/subscribe, stores state in localStorage.
 * Subsequent clicks toggle the subscription on/off.
 *
 * Place on the profile page or settings area.
 */

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buf = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < rawData.length; ++i) view[i] = rawData.charCodeAt(i)
  return buf
}

type PushState = 'idle' | 'subscribed' | 'denied' | 'unsupported' | 'loading'

export function PushBell({ className = '' }: { className?: string }) {
  const [state, setState] = useState<PushState>('idle')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setState('subscribed')
      })
    }).catch(() => setState('unsupported'))
  }, [])

  async function handleClick() {
    if (state === 'unsupported' || state === 'denied') return
    setState('loading')

    try {
      const reg = await navigator.serviceWorker.ready

      if (state === 'subscribed') {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
        setState('idle')
        return
      }

      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle')
        return
      }

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save to server
      const resp = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          prefs: { new_events: true, upcoming: true },
        }),
      })

      setState(resp.ok ? 'subscribed' : 'idle')
    } catch (e) {
      console.warn('[PushBell] Error:', e)
      setState('idle')
    }
  }

  if (state === 'unsupported') return null

  const icon = state === 'subscribed'
    ? <Bell className="w-4 h-4 fill-current" />
    : state === 'denied'
    ? <BellOff className="w-4 h-4 opacity-40" />
    : <Bell className="w-4 h-4" />

  const label = state === 'subscribed' ? 'Notifications on'
    : state === 'denied'    ? 'Notifications blocked'
    : state === 'loading'   ? 'Setting up…'
    : 'Enable notifications'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading' || state === 'denied'}
      title={label}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
        border transition-all
        ${state === 'subscribed'
          ? 'bg-[#4f6249]/10 border-[#4f6249]/30 text-[#4f6249]'
          : state === 'denied'
          ? 'bg-[#f0e4cc] border-[#ddc9a3] text-[#8a7a74] cursor-not-allowed'
          : 'bg-white border-[#ddc9a3] text-[#4a3f3a] hover:border-[#9a442d] hover:text-[#9a442d]'
        }
        ${state === 'loading' ? 'opacity-60 cursor-wait' : ''}
        ${className}
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
