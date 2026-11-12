import { termEvents } from '@/server/api/handlers.js';
import { apiRoute, preflight } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// GET /v1/terms/:slug/events?from=&to=&tags=&page=&limit=
export const GET = apiRoute(termEvents);
export const OPTIONS = preflight;
