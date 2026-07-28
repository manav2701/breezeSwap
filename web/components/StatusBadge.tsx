import React from 'react'

export function StatusBadge({ status }: { status: 'OPEN' | 'SETTLED' | string }) {
  if (status === 'OPEN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black font-mono bg-[#fde047] text-[#0a0a0a]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] animate-pulse" />
        OPEN
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black font-mono bg-[#141414] text-slate-300 border border-white/10">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      SETTLED
    </span>
  )
}
