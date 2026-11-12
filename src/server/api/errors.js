// One JSON shape for every API error:
//   { "error": { "status": 404, "message": "No term 'atlantis'" } }

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Connection-level failures (server down, unknown role/database, too many
// clients) are a 503, not a bug in the request.
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ENOENT',
  '28000', '28P01', '3D000', '53300', '57P01', '57P03',
]);

export function isDatabaseUnavailable(err) {
  return (
    DB_UNAVAILABLE_CODES.has(err?.code) ||
    DB_UNAVAILABLE_CODES.has(err?.errors?.[0]?.code) ||
    // node-postgres raises these before reaching the server (e.g. a password
    // is required but none is configured).
    /^SASL: |password must be a string|no pg_hba\.conf entry/i.test(err?.message ?? '')
  );
}

// Any thrown error → JSON Response. Our own HttpErrors and client errors carry
// safe messages; anything else (bugs, driver errors) is logged and hidden
// behind a generic message.
export function errorResponse(err) {
  if (isDatabaseUnavailable(err)) {
    console.error('Database unavailable:', err.code ?? err.message);
    err = new HttpError(503, 'Database unavailable');
  }
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500 && !(err instanceof HttpError)) console.error(err);

  const expose = err instanceof HttpError;
  return Response.json(
    {
      error: {
        status,
        message: expose ? err.message : 'Internal server error',
        ...(expose && err.details ? { details: err.details } : {}),
      },
    },
    { status },
  );
}
