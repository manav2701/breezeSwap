import { CorsOptions } from 'cors'
import { logger } from '../utils/logger'

const LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

/**
 * Origin allow-list for the API.
 *
 * `cors()` with no options reflects any `Origin` and answers every preflight, so
 * any page on the internet could read the API with the caller's credentials
 * attached. Set `ALLOWED_ORIGINS` to a comma-separated list of the deployed web
 * origins; localhost dev origins are always permitted.
 *
 * Requests with no `Origin` header (server-to-server, curl, health checks) are
 * unaffected — the browser same-origin policy is what CORS relaxes, and there is
 * nothing to relax for a non-browser caller.
 */
export function buildCorsOptions(): CorsOptions {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  const allowed = new Set([...configured, ...LOCAL_ORIGINS])

  if (configured.length === 0) {
    logger.warn('ALLOWED_ORIGINS is not set — only localhost web origins may call this API from a browser')
  }

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin.replace(/\/+$/, ''))) return callback(null, true)
      return callback(null, false)
    },
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Api-Key'],
    maxAge: 600
  }
}
