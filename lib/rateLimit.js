const buckets = new Map();

const LIMITS = {
  info: { max: 30, windowMs: 60_000 },
  download: { max: 10, windowMs: 60_000 },
  health: { max: 60, windowMs: 60_000 },
};

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

export function checkRateLimit(route, requestOrMax) {
  const limit = LIMITS[route] || { max: requestOrMax || 30, windowMs: 60_000 };
  const request = typeof requestOrMax === 'object' ? requestOrMax : null;
  const key = request ? `${route}:${getClientIp(request)}` : `${route}:global`;

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now - bucket.start > limit.windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit.max) {
    return Response.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 }
    );
  }

  return null;
}
