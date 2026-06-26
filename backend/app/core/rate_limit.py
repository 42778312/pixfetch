import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse

LIMITS = {
    "info": {"max": 30, "window_ms": 60_000},
    "download": {"max": 10, "window_ms": 60_000},
    "health": {"max": 60, "window_ms": 60_000},
}

_buckets: dict[str, dict] = defaultdict(dict)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "local"


def check_rate_limit(route: str, request: Request) -> JSONResponse | None:
    limit = LIMITS.get(route, {"max": 30, "window_ms": 60_000})
    key = f"{route}:{get_client_ip(request)}"
    now = time.time() * 1000

    bucket = _buckets.get(key)
    if not bucket or now - bucket["start"] > limit["window_ms"]:
        bucket = {"start": now, "count": 0}
        _buckets[key] = bucket

    bucket["count"] += 1

    if bucket["count"] > limit["max"]:
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests. Please wait a moment and try again."},
        )
    return None
