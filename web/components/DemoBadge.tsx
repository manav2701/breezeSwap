import React from 'react'
import { FlaskConical } from 'lucide-react'

/**
 * Marks a surface whose numbers came from `lib/demoData`, not the indexer.
 *
 * This has to be visible wherever sample data is drawn. A weather derivatives
 * UI showing invented open interest without saying so is the kind of thing a
 * reader would reasonably act on.
 */
export function DemoBadge({ label = 'Sample data' }: { label?: string }) {
  return (
    <span className="chip chip-warn" title="The indexer returned no rows, so this panel is showing generated sample data.">
      <FlaskConical className="w-3 h-3" aria-hidden />
      {label}
    </span>
  )
}
