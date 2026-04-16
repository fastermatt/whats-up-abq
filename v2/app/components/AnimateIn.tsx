'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface AnimateInProps {
  children: ReactNode
  className?: string
  delay?: number
  /** Animation variant */
  animation?: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale'
  /** Only animate when element scrolls into view */
  onScroll?: boolean
}

export function AnimateIn({
  children,
  className = '',
  delay = 0,
  animation = 'fade-up',
  onScroll = true,
}: AnimateInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!onScroll)

  useEffect(() => {
    if (!onScroll) {
      const t = setTimeout(() => setVisible(true), delay)
      return () => clearTimeout(t)
    }

    const el = ref.current
    if (!el) return

    // Check if reduced motion is preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay, onScroll])

  const baseStyle = 'transition-all duration-700 ease-out'

  const hiddenStyles: Record<string, string> = {
    'fade-up': 'opacity-0 translate-y-6',
    'fade-in': 'opacity-0',
    'slide-left': 'opacity-0 -translate-x-8',
    'slide-right': 'opacity-0 translate-x-8',
    'scale': 'opacity-0 scale-95',
  }

  const visibleStyle = 'opacity-100 translate-y-0 translate-x-0 scale-100'

  return (
    <div
      ref={ref}
      className={`${baseStyle} ${visible ? visibleStyle : hiddenStyles[animation]} ${className}`}
    >
      {children}
    </div>
  )
}

/** Stagger wrapper — each child gets an incremental delay */
export function StaggerChildren({
  children,
  className = '',
  stagger = 50,
  animation = 'fade-up' as AnimateInProps['animation'],
}: {
  children: ReactNode[]
  className?: string
  stagger?: number
  animation?: AnimateInProps['animation']
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <AnimateIn key={i} delay={i * stagger} animation={animation}>
          {child}
        </AnimateIn>
      ))}
    </div>
  )
}
