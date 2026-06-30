const LIMITS = {
  info: { max: 30, windowMs: 60_000 },
  download: { max: 10, windowMs: 60_000 },
  health: { max: 60, windowMs: 60_000 },
};

const buckets = new Map();

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'local';
}

export function checkRateLimit(route, request) {
  const limit = LIMITS[route] || { max: 30, windowMs: 60_000 };
  const key = `${route}:${getClientIp(request)}`;
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
