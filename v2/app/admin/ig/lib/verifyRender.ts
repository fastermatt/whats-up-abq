'use client'

import type { Design } from '../types'
import { proxyIfNeeded } from './image-proxy'

export interface RenderVerificationOptions {
  minWidth?: number
  minHeight?: number
  sampleSize?: number
  minNonBackgroundFraction?: number
  colorDistanceThreshold?: number
}

export interface ImageReadinessOptions {
  timeoutMs?: number
}

export async function waitForDesignImages(
  design: Design,
  opts: ImageReadinessOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5000
  const sources = Array.from(new Set(design.slides.flatMap(slide => {
    const urls: string[] = []
    if (slide.background.type === 'image' && slide.background.src) {
      urls.push(slide.background.src)
    }
    for (const layer of slide.layers) {
      if (layer.type === 'image' && layer.visible && layer.src) {
        urls.push(layer.src)
      }
    }
    return urls
  })))

  if (sources.length > 0) {
    await Promise.allSettled(sources.map(src => waitForImageSettled(proxyIfNeeded(src), timeoutMs)))
  }

  await nextFrame()
  await nextFrame()
}

export async function verifyRenderedPng(
  dataUrl: string,
  opts: RenderVerificationOptions = {},
): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = []
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    return { ok: false, reasons: ['Export is not a PNG data URL.'] }
  }

  const image = await decodeImage(dataUrl).catch(() => null)
  if (!image) {
    return { ok: false, reasons: ['PNG could not be decoded.'] }
  }

  const minWidth = opts.minWidth ?? 500
  const minHeight = opts.minHeight ?? 500
  if (image.width < minWidth || image.height < minHeight) {
    reasons.push(`Export is too small (${image.width}x${image.height}; minimum ${minWidth}x${minHeight}).`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return { ok: false, reasons: ['Could not create a canvas context to inspect the export.'] }
  }
  ctx.drawImage(image, 0, 0)

  const sampleSize = Math.max(8, Math.floor(opts.sampleSize ?? 72))
  const sample = safeDrawSample(ctx, image.width, image.height, sampleSize)
  if (!sample) {
    return { ok: false, reasons: ['Could not sample the rendered export.'] }
  }
  const nonBackgroundFraction = computeNonBackgroundFraction(
    sample.data,
    opts.colorDistanceThreshold ?? 28,
  )
  const minNonBackgroundFraction = opts.minNonBackgroundFraction ?? 0.02
  if (nonBackgroundFraction < minNonBackgroundFraction) {
    reasons.push(`Export appears blank or flat (${(nonBackgroundFraction * 100).toFixed(1)}% non-background pixels).`)
  }

  return { ok: reasons.length === 0, reasons }
}

function waitForImageSettled(src: string, timeoutMs: number): Promise<void> {
  return new Promise(resolve => {
    const img = new Image()
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(finish, timeoutMs)
    img.crossOrigin = 'anonymous'
    img.onload = finish
    img.onerror = finish
    img.src = src
    if (img.complete) finish()
  })
}

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode failed'))
    img.src = dataUrl
  })
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

function safeDrawSample(
  source: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleSize: number,
): ImageData | null {
  const sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = sampleSize
  sampleCanvas.height = sampleSize
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!sampleCtx) return null
  try {
    sampleCtx.drawImage(source.canvas, 0, 0, width, height, 0, 0, sampleSize, sampleSize)
    return sampleCtx.getImageData(0, 0, sampleSize, sampleSize)
  } catch {
    return null
  }
}

function computeNonBackgroundFraction(data: Uint8ClampedArray, threshold: number): number {
  const bins = new Map<string, { count: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    const bin = bins.get(key)
    if (bin) {
      bin.count += 1
      bin.r += r
      bin.g += g
      bin.b += b
    } else {
      bins.set(key, { count: 1, r, g, b })
    }
  }

  let dominant = { count: 0, r: 0, g: 0, b: 0 }
  for (const bin of bins.values()) {
    if (bin.count > dominant.count) dominant = bin
  }
  if (dominant.count === 0) return 0

  const bg = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
  }
  let nonBackground = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(data[i] - bg.r, data[i + 1] - bg.g, data[i + 2] - bg.b)
    if (distance > threshold) nonBackground += 1
  }
  return nonBackground / pixels
}
