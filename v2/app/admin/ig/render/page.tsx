'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PostCanvas, type PostCanvasHandle } from '../components/PostCanvas'
import { TEMPLATES, type TemplateContext } from '../lib/templates'
import { verifyRenderedPng, waitForDesignImages } from '../lib/verifyRender'
import { useEditor } from '../store'
import type { CanvasFormat } from '../types'

type RenderResult =
  | { ok: true; dataUrl: string }
  | { ok: false; reason: string; dataUrl?: undefined }

declare global {
  interface Window {
    __renderIG?: (
      templateId: string,
      ctx: TemplateContext,
      format?: CanvasFormat,
    ) => Promise<RenderResult>
  }
}

const REQUIRED_FONTS = [
  '900 16px Epilogue',
  '400 16px Inter',
  '500 16px Inter',
  '700 16px Inter',
  'italic 400 16px Fraunces',
  '500 16px "DM Mono"',
]

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

function waitFor(condition: () => boolean, timeoutMs = 45000): Promise<void> {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (condition()) {
        resolve()
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('font load timed out'))
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

export default function IGHeadlessRenderPage() {
  const canvasRef = useRef<PostCanvasHandle | null>(null)
  const fontsReadyRef = useRef(false)
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadFonts() {
      await Promise.allSettled(REQUIRED_FONTS.map(font => document.fonts.load(font)))
      await document.fonts.ready
      if (!cancelled) {
        fontsReadyRef.current = true
        setFontsReady(true)
      }
    }
    loadFonts()
    return () => { cancelled = true }
  }, [])

  const renderIG = useCallback(async (
    templateId: string,
    ctx: TemplateContext,
    format: CanvasFormat = '4:5',
  ): Promise<RenderResult> => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (!template) return { ok: false, reason: 'unknown template' }

    const handle = canvasRef.current
    if (!handle) return { ok: false, reason: 'renderer not ready' }

    try {
      await waitFor(() => fontsReadyRef.current)
      const design = template.build(ctx ?? {}, format)
      useEditor.getState().applyTemplateDesign(template.id, design)
      useEditor.getState().setActiveSlide(0)

      await document.fonts.ready
      await waitForDesignImages(design)
      await nextFrame()
      await nextFrame()
      await handle.waitForReady()

      const dataUrl = await handle.exportPng()
      const verification = await verifyRenderedPng(dataUrl)
      if (!verification.ok) {
        return {
          ok: false,
          reason: verification.reasons.join('; ') || 'render verification failed',
        }
      }

      return { ok: true, dataUrl }
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'render failed',
      }
    }
  }, [])

  useEffect(() => {
    window.__renderIG = renderIG
    return () => {
      if (window.__renderIG === renderIG) delete window.__renderIG
    }
  }, [renderIG])

  return (
    <div className="min-h-[120px] text-white/60">
      <p className="text-sm">IG headless renderer {fontsReady ? 'ready' : 'loading fonts'}</p>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: 1200,
          height: 2100,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <PostCanvas onExportRef={handle => { canvasRef.current = handle }} />
      </div>
    </div>
  )
}
