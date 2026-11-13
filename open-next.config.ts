// OpenNext for Cloudflare. ISR: cached pages (the timelines, revalidate 6 h)
// are stored in R2, and stale ones are regenerated in the background through a
// Durable Object queue. Bindings: NEXT_INC_CACHE_R2_BUCKET, NEXT_CACHE_DO_QUEUE
// and WORKER_SELF_REFERENCE in wrangler.jsonc. No tag cache: the app doesn't
// call revalidatePath / revalidateTag.
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
});
