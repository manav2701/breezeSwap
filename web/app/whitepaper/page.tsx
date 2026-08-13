'use client'

import React from 'react'
import { Download, ExternalLink } from 'lucide-react'

const PDF = '/breezeswap-whitepaper.pdf'

/**
 * The whitepaper, embedded.
 *
 * Served from `public/` rather than rendered from source, so the page shows exactly the
 * typeset document rather than an approximation of it. The object tag falls back to a
 * download prompt on browsers with no inline PDF viewer, which is most mobile ones, so the
 * page never renders as an empty grey rectangle.
 */
export default function WhitepaperPage() {
  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[color:var(--color-hairline)]">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Whitepaper</p>
          <h1 className="display-2 text-ink">Pooled underwriting for on-chain weather risk</h1>
          <p className="lede mt-3">
            The economics, the capital model, and what we measured rather than assumed.
            Includes the results that argue against our own defaults.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href={PDF} download className="btn btn-primary">
            <Download className="w-4 h-4" aria-hidden />
            Download PDF
          </a>
          <a href={PDF} target="_blank" rel="noreferrer" className="btn btn-ghost">
            <ExternalLink className="w-4 h-4" aria-hidden />
            Open in new tab
          </a>
        </div>
      </header>

      <div className="panel overflow-hidden" style={{ height: '82vh', minHeight: 520 }}>
        <object data={PDF} type="application/pdf" width="100%" height="100%" aria-label="BreezeSwap whitepaper">
          <div className="p-8 flex flex-col items-center justify-center gap-4 h-full text-center">
            <p className="text-sm text-ink-muted max-w-sm">
              Your browser will not display PDFs inline. The document is still here.
            </p>
            <a href={PDF} download className="btn btn-primary">
              <Download className="w-4 h-4" aria-hidden />
              Download the whitepaper
            </a>
          </div>
        </object>
      </div>
    </div>
  )
}
