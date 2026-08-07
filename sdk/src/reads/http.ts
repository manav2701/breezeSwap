/**
 * Shared helpers for reading JSON from the indexer HTTP API.
 *
 * Every read in this directory followed one of two shapes: fetch a URL and
 * either throw a caller-specific error on failure, or swallow all failures and
 * fall back to an empty/`null`/zero value. Both were re-implemented per
 * function, so a change to how the indexer is called (headers, error text,
 * timeouts) meant editing a dozen near-identical blocks. These two helpers are
 * the single place that shape lives now.
 */

/**
 * Fetch JSON and throw when the request fails.
 *
 * `errorMessage` builds the thrown message from the failed response so callers
 * keep their existing, human-facing error text (e.g. `Market not found: 0x…`).
 */
export async function fetchJson<T = unknown>(
  url: string,
  errorMessage?: (res: Response) => string
): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      errorMessage ? errorMessage(res) : `Request failed (${res.status} ${res.statusText}): ${url}`
    )
  }
  return (await res.json()) as T
}

/**
 * Fetch JSON, returning `fallback` on any failure (non-OK response, network
 * error, or malformed body). Used by reads that degrade to an empty result
 * rather than surfacing the error to the UI.
 */
export async function fetchJsonOr<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url)
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  }
}
