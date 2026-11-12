import { notFound } from '@/server/api/handlers.js';
import { apiRoute } from '@/server/api/route.js';

export const dynamic = 'force-dynamic';

// Unknown /v1 paths answer with the API's JSON 404, not the HTML not-found page.
const handler = apiRoute(notFound);
export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
