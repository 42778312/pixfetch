from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.rate_limit import check_rate_limit
from app.services.ytdlp import is_ffmpeg_available, is_ytdlp_available

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health(request: Request):
    limited = check_rate_limit("health", request)
    if limited:
        return limited

    ytdlp_ok = await is_ytdlp_available()
    ffmpeg_ok = await is_ffmpeg_available()
    healthy = ytdlp_ok or ffmpeg_ok

    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if healthy else "degraded",
            "ytdl": False,
            "ytdlp": ytdlp_ok,
            "ffmpeg": ffmpeg_ok,
        },
    )
