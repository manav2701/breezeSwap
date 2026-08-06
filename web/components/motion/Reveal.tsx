'use client'

import React, { useEffect, useRef, useState } from 'react'

type RevealProps = {
  children: React.ReactNode
  /** Stagger index — each step delays the reveal by 60ms. */
  index?: number
  className?: string
}

/**
 * Fades content up as it scrolls into view.
 *
 * Written so that **the visible state is the default and the hidden state is
 * the exception**. The previous implementation animated from
 * `initial={{ opacity: 0 }}`, which meant anything that stopped the animation
 * completing — a throttled rAF in a background tab, a stalled compositor, an
 * IntersectionObserver that never fires — left real content stuck at zero
 * opacity. That happened here: two market cards sat permanently invisible.
 *
 * Three things now guarantee the content is readable:
 *
 *  - it is only hidden after mount, so server-rendered HTML and a no-JS
 *    client both show it;
 *  - a timeout reveals it regardless if the observer has not fired;
 *  - reduced-motion skips the mechanism entirely.
 */
export function Reveal({ children, index = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'idle' | 'hidden' | 'shown'>('idle')

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setState('shown')
      return
    }

    setState('hidden')

    const reveal = () => setState('shown')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal()
            observer.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.01 }
    )
    observer.observe(el)

    // Backstop: if the observer never fires, the content still appears.
    const failsafe = window.setTimeout(reveal, 1200)

    return () => {
      observer.disconnect()
      window.clearTimeout(failsafe)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={
        state === 'hidden'
          ? {
              opacity: 0,
              transform: 'translateY(14px)',
              transition: 'none',
            }
          : state === 'shown'
            ? {
                opacity: 1,
                transform: 'none',
                transition: `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${Math.min(index, 6) * 0.06}s, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${Math.min(index, 6) * 0.06}s`,
              }
            : undefined
      }
    >
      {children}
    </div>
  )
}
