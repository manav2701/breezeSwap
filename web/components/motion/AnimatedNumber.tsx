'use client'

import React, { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'

type AnimatedNumberProps = {
  value: number
  /** Decimal places to render. */
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

/**
 * Counts up to `value` when it changes.
 *
 * Always renders tabular numerals so the digits do not reflow mid-count, and
 * skips straight to the final value under reduced-motion.
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

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }
    const controls = animate(display, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
    // `display` is the animation's start point, not a trigger — including it
    // would restart the tween on every frame it emits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
