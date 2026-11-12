import { terms } from '@/server/api/handlers.js';
import { apiRoute, preflight } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// GET /v1/terms?type=country&limit=50
export const GET = apiRoute(terms);
export const OPTIONS = preflight;
