'use client'

import React from 'react'
import { motion, useReducedMotion } from 'motion/react'

type RevealProps = {
  children: React.ReactNode
  /** Stagger index — each step delays the reveal by 60ms. */
  index?: number
  className?: string
}

/**
 * Fades content up as it scrolls into view.
 *
 * Motion is decoration here, never the thing that makes content legible: when
 * the viewer prefers reduced motion the children render immediately at their
 * final position rather than animating faster.
 */
export function Reveal({ children, index = 0, className }: RevealProps) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.5,
        delay: Math.min(index, 6) * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  )
}
