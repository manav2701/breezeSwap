/** A failed indexer request, carrying the HTTP status when there was one. */
export class IndexerError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'IndexerError'
    this.status = status
  }
}

/**
 * Fetch JSON from the indexer, failing loudly.
 *
 * Most reads used to end in `catch { return [] }` or `catch { return '0' }`. A
 * caller then had no way to tell "the indexer is down" from "there is nothing
 * here", so an outage rendered as a market with no trades, a portfolio with no
 * positions and a protocol that had collected no fees. The UI already has
 * fallbacks for a thrown error — it needs the error to be thrown.
 *
 * A 404 is the one failure that is genuinely information, so it is reported
 * through `IndexerError.status` for the few callers that distinguish a missing
 * record from a broken indexer.
 */
export async function fetchJson<T>(url: string, what: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new IndexerError(`Failed to reach the indexer for ${what}: ${detail}`)
  }

  if (!res.ok) {
    throw new IndexerError(`Failed to fetch ${what}: ${res.status} ${res.statusText}`, res.status)
  }

  try {
    return (await res.json()) as T
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new IndexerError(`Indexer returned an unreadable response for ${what}: ${detail}`, res.status)
  }
}

/** `true` when the request failed because the record does not exist. */
export function isNotFound(err: unknown): boolean {
  return err instanceof IndexerError && err.status === 404
}
