// Turns a handler from ./handlers.js into a Next.js route handler: shared
// database pool, JSON errors and CORS.
import 'server-only';
import { config } from '../config.js';
import { getDb } from '../db/pool.js';
import { errorResponse } from './errors.js';

// Runs a handler and maps anything it throws to the JSON error shape.
// Exported for tests, which pass their own db.
export async function runHandler(handler, db, request, params = {}) {
  try {
    return await handler(db, request, params);
  } catch (err) {
    return errorResponse(err);
  }
}

export function apiRoute(handler) {
  return async (request, context) => {
    const params = context?.params ? await context.params : {};
    return withCors(request, await runHandler(handler, getDb(), request, params));
  };
}

// CORS preflight for the same routes.
export function preflight(request) {
  return withCors(request, new Response(null, { status: 204 }), { preflight: true });
}

// Allow listed cross-origin browsers (CORS_ORIGIN). Same-origin requests,
// including this app's own pages, never need it.
function withCors(request, response, { preflight = false } = {}) {
  const origin = request.headers.get('origin');
  response.headers.append('Vary', 'Origin');
  if (origin && config.corsOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    if (preflight) {
      response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      response.headers.set(
        'Access-Control-Allow-Headers',
        request.headers.get('access-control-request-headers') ?? 'Content-Type',
      );
      response.headers.set('Access-Control-Max-Age', '600');
    }
  }
  return response;
}
