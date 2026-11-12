import { index } from '@/server/api/handlers.js';
import { apiRoute, preflight } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

export const GET = apiRoute(index);
export const OPTIONS = preflight;
