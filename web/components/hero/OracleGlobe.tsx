'use client'

import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type Node = { id: string; label: string; x: number; y: number }

/**
 * The regions BreezeSwap has markets for, positioned on the wireframe by
 * rough longitude/latitude rather than by eye — the arc lengths between them
 * should look like the real distances.
 */
const NODES: Node[] = [
  { id: 'london', label: 'London', x: 0.5, y: 0.3 },
  { id: 'dubai', label: 'Dubai', x: 0.68, y: 0.46 },
  { id: 'singapore', label: 'Singapore', x: 0.78, y: 0.63 },
  // Seoul and Tokyo are genuinely close together; separated vertically here so
  // their labels do not sit on top of each other.
  { id: 'seoul', label: 'Seoul', x: 0.87, y: 0.31 },
  { id: 'tokyo', label: 'Tokyo', x: 0.94, y: 0.44 },
]

const SIZE = 320
const R = 132
const CX = SIZE / 2
const CY = SIZE / 2

/** Maps a node's normalised (x, y) onto the sphere's visible face. */
function project(n: Node) {
  const px = CX + (n.x - 0.5) * 2 * R * 0.82
  const py = CY + (n.y - 0.5) * 2 * R * 0.82
  return { px, py }
}

/**
 * The hero's data visual: a wireframe globe with a beam travelling from each
 * region into the settlement core.
 *
 * It is an illustration of what the protocol does — readings flow in from real
 * places, settlement flows out — not a chart, so it carries no axis and no
 * numbers. Everything is inline SVG and CSS; nothing is fetched, and under
 * reduced-motion it renders as a still diagram.
 */
export function OracleGlobe({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion()

  const nodes = useMemo(() => NODES.map((n) => ({ ...n, ...project(n) })), [])

  // Latitude/longitude wires. Ellipse rx sweeps to fake rotation in depth.
  const meridians = [0.18, 0.5, 0.82, 1].map((k) => R * k)
  const parallels = [-0.62, -0.32, 0, 0.32, 0.62].map((k) => ({
    cy: CY + k * R,
    rx: R * Math.sqrt(Math.max(0, 1 - k * k)),
  }))

  return (
    <div className={`relative ${className}`} aria-hidden>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full overflow-visible">
        <defs>
          <radialGradient id="globeFill" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(253,224,71,0.14)" />
            <stop offset="55%" stopColor="rgba(125,211,252,0.05)" />
            <stop offset="100%" stopColor="rgba(10,11,14,0)" />
          </radialGradient>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fde047" stopOpacity="0" />
            <stop offset="50%" stopColor="#fde047" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
          </linearGradient>
          <filter id="coreGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R} fill="url(#globeFill)" />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {meridians.map((rx, i) => (
          <ellipse
            key={`m${i}`}
            cx={CX}
            cy={CY}
            rx={rx}
            ry={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        {parallels.map((p, i) => (
          <ellipse
            key={`p${i}`}
            cx={CX}
            cy={p.cy}
            rx={p.rx}
            ry={p.rx * 0.16}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Beams: each region feeding the settlement core. */}
        {nodes.map((n, i) => {
          const d = `M ${n.px} ${n.py} Q ${(n.px + CX) / 2} ${(n.py + CY) / 2 - 26} ${CX} ${CY}`
          return (
            <g key={n.id}>
              <path d={d} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
              {!reduced && (
                <motion.path
                  d={d}
                  fill="none"
                  stroke="url(#beamGrad)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  initial={{ pathLength: 0.18, pathOffset: 0, opacity: 0 }}
                  animate={{ pathOffset: [0, 1], opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 2.6,
                    delay: i * 0.55,
                    repeat: Infinity,
                    repeatDelay: 1.4,
                    ease: 'easeInOut',
                  }}
                />
              )}
            </g>
          )
        })}

        {/* Settlement core */}
        <circle cx={CX} cy={CY} r="7" fill="#fde047" filter="url(#coreGlow)" />
        {!reduced && (
          <motion.circle
            cx={CX}
            cy={CY}
            r="7"
            fill="none"
            stroke="#fde047"
            strokeWidth="1"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: [1, 3.4], opacity: [0.6, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />
        )}

        {/* Region markers */}
        {nodes.map((n, i) => (
          <g key={`n-${n.id}`}>
            <circle cx={n.px} cy={n.py} r="3.5" fill="#7dd3fc" />
            <circle
              cx={n.px}
              cy={n.py}
              r="3.5"
              fill="none"
              stroke="rgba(125,211,252,0.4)"
              strokeWidth="5"
            />
            {!reduced && (
              <motion.circle
                cx={n.px}
                cy={n.py}
                r="3.5"
                fill="none"
                stroke="#7dd3fc"
                strokeWidth="1"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: [1, 3], opacity: [0.7, 0] }}
                transition={{
                  duration: 2.4,
                  delay: i * 0.4,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                style={{ transformOrigin: `${n.px}px ${n.py}px` }}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Region labels are HTML, not SVG text — they inherit the app's font
          stack and stay legible when the SVG scales. */}
      {nodes.map((n) => (
        <span
          key={`l-${n.id}`}
          className="absolute -translate-x-1/2 translate-y-2 text-[10px] text-ink-faint whitespace-nowrap pointer-events-none"
          style={{ left: `${(n.px / SIZE) * 100}%`, top: `${(n.py / SIZE) * 100}%` }}
        >
          {n.label}
        </span>
      ))}
    </div>
  )
}
