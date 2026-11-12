import { ready } from '@/server/api/handlers.js';
import { apiRoute } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// Readiness: 200 if the database answers, else 503.
export const GET = apiRoute(ready);
