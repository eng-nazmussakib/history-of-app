import { robotsTxt } from '@/lib/seo-files.js';
import { getOrigin } from '@/server/data.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(robotsTxt(await getOrigin()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
