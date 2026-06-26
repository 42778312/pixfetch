from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from app.core.errors import map_youtube_error
from app.core.rate_limit import check_rate_limit
from app.services.url_parser import build_playlist_url, build_video_url, parse_youtube_input
from app.services.youtube_info import fetch_playlist_info, fetch_video_info

router = APIRouter(prefix="/api", tags=["info"])


@router.get("/info")
async def info(
    request: Request,
    url: str | None = Query(None),
    mode: str | None = Query(None),
):
    limited = check_rate_limit("info", request)
    if limited:
        return limited

    if not url:
        return JSONResponse(status_code=400, content={"error": "URL is required"})

    parsed = parse_youtube_input(url)
    if not parsed.mode:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid YouTube URL. Please enter a valid video or playlist link."},
        )

    effective_mode = parsed.mode
    if mode in ("video", "playlist"):
        effective_mode = mode

    if effective_mode == "ambiguous":
        return {
            "type": "ambiguous",
            "videoId": parsed.video_id,
            "playlistId": parsed.playlist_id,
            "videoUrl": build_video_url(parsed.video_id),
            "playlistUrl": build_playlist_url(parsed.playlist_id),
        }

    if effective_mode == "playlist" and parsed.playlist_id:
        try:
            return await fetch_playlist_info(parsed.playlist_id)
        except Exception as err:
            return JSONResponse(status_code=500, content={"error": map_youtube_error(err)})

    if parsed.video_id:
        try:
            return await fetch_video_info(build_video_url(parsed.video_id))
        except Exception as err:
            return JSONResponse(status_code=500, content={"error": map_youtube_error(err)})

    return JSONResponse(status_code=400, content={"error": "Invalid YouTube URL."})
