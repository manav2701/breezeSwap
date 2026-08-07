import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * Says that a panel is empty because a read failed, not because there is
 * nothing to show.
 *
 * Several pages used to answer a failed load with `setX([])`, which renders the
 * same "No markets deployed yet" / "No positions" copy as a genuinely empty
 * result. A trader cannot act on that: their positions had not disappeared, the
 * page just could not reach the indexer. Anything that clears state on failure
 * should render this instead.
 */
export function LoadError({
  message,
  onRetry,
  what
}: {
  message: string
  onRetry?: () => void
  what?: string
}) {
  return (
    <div className="panel p-8 text-center space-y-3 border-[color:rgba(244,63,94,0.3)]" role="alert">
      <div className="flex items-center justify-center gap-2 text-sm text-ink">
        <AlertCircle className="w-4 h-4 shrink-0 value-short" aria-hidden />
        <span>Could not load {what ?? 'this data'}</span>
      </div>
      <p className="text-xs text-ink-muted break-words max-w-xl mx-auto">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm">
          <RefreshCw className="w-3 h-3" aria-hidden />
          Try again
        </button>
      )}
    </div>
  )
}

/** A one-line variant for inline slots (stat tiles, chart headers, form hints). */
export function InlineError({ message }: { message: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs value-short" role="alert">
      <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
      <span className="break-words">{message}</span>
    </span>
  )
}
