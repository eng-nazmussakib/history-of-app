import { health } from '@/server/api/handlers.js';
import { apiRoute } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// Liveness: the process is up.
export const GET = apiRoute(health);
