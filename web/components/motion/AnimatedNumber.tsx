'use client'

import React, { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

type AnimatedNumberProps = {
  value: number
  /** Decimal places to render. */
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

const DURATION = 0.7

/**
 * Counts up to `value` when it changes.
 *
 * Always renders tabular numerals so the digits do not reflow mid-count, and
 * skips straight to the final value under reduced-motion.
 *
 * A failsafe snaps to the target shortly after the tween should have ended.
 * This is a number a reader will act on, so it must never be left frozen at
 * whatever intermediate figure the animation reached if rAF is throttled —
 * "$412" when the real open interest is "$1,340" is worse than no animation.
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  prefix = '',
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    displayRef.current = display
  }, [display])

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }

    const controls = animate(displayRef.current, value, {
      duration: DURATION,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })

    const failsafe = window.setTimeout(() => setDisplay(value), DURATION * 1000 + 250)

    return () => {
      controls.stop()
      window.clearTimeout(failsafe)
    }
  }, [value, reduced])

  return (
    <span className={`numeric ${className ?? ''}`}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
