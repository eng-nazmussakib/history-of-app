// Runtime configuration from environment variables (Next loads .env* from the
// app folder; variables already set in the environment win).
import 'server-only';

const toList = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Getters, not values: on Cloudflare Workers (OpenNext) the Worker's variables
// are copied into process.env per request, possibly after this module loads,
// so reading them once at import could freeze in the local defaults.
export const config = {
  get env() {
    return process.env.NODE_ENV ?? 'development';
  },
  // Default: local Unix socket as your OS user, no password. The host must be
  // spelled out: unlike psql, node-postgres treats a missing host as TCP to
  // localhost, where Postgres usually wants a password.
  get databaseUrl() {
    return process.env.DATABASE_URL ?? 'postgresql:///history_of?host=/var/run/postgresql';
  },
  // Browser origins (other than this app's own) allowed to call /v1 with CORS.
  // The app's own pages don't need it: they're same-origin, and server
  // components read the database directly. Empty = no cross-origin access.
  get corsOrigins() {
    return toList(process.env.CORS_ORIGIN ?? '');
  },
  // Public origin for canonical links, the sitemap and structured data.
  get siteUrl() {
    return process.env.SITE_URL?.replace(/\/+$/, '') || null;
  },
  // Port for the local fallback origin when SITE_URL isn't set.
  get port() {
    return Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000);
  },
};
