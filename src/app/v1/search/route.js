import { search } from '@/server/api/handlers.js';
import { apiRoute, preflight } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// GET /v1/search?q=&limit=
export const GET = apiRoute(search);
export const OPTIONS = preflight;
