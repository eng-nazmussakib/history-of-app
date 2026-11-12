import { term } from '@/server/api/handlers.js';
import { apiRoute, preflight } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// GET /v1/terms/:slug
export const GET = apiRoute(term);
export const OPTIONS = preflight;
