/**
 * Server-side proxy for the indexer's admin audit log.
 *
 * The indexer now requires `ADMIN_API_KEY` on `/api/admin/*`. That key must not
 * reach the browser, so the admin page calls this route instead and the key stays
 * in the server environment (`ADMIN_API_KEY`, deliberately not `NEXT_PUBLIC_`).
 *
 * Note this route is itself unauthenticated: the admin page's role check runs in
 * the browser and cannot gate a server route. It exists to keep the shared secret
 * server-side and to give the audit feed a single chokepoint that a real session
 * check (e.g. a signed-in-wallet cookie) can later be attached to.
 */
const INDEXER_URL = (process.env.INDEXER_URL || process.env.NEXT_PUBLIC_INDEXER_URL || 'http://localhost:3001')
  .replace(/\/+$/, '')

export async function GET(request: Request) {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    return Response.json(
      { events: [], error: 'ADMIN_API_KEY is not set for this deployment' },
      { status: 503 }
    )
  }

  const requestedLimit = Number(new URL(request.url).searchParams.get('limit'))
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 50

  const upstream = await fetch(`${INDEXER_URL}/api/admin/audit-log?limit=${limit}`, {
    headers: { Authorization: `Bearer ${adminKey}` },
    cache: 'no-store',
  })

  if (!upstream.ok) {
    return Response.json({ events: [], error: 'Audit log unavailable' }, { status: upstream.status })
  }

  return Response.json(await upstream.json())
}
