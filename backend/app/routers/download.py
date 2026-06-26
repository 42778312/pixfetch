import asyncio
import json
import time
from urllib.parse import quote

from fastapi import APIRouter, Query, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from app.core.constants import is_valid_quality, is_valid_video_id, sanitize_filename
from app.core.errors import map_youtube_error
from app.core.rate_limit import check_rate_limit
from app.core.storage import get_download_status, get_downloads_dir, get_final_path
from app.services.downloader import download_video
from app.services.stream_resolver import stream_video
from app.services.ytdlp import cancel_download

router = APIRouter(prefix="/api", tags=["download"])


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/download")
async def download_sse(
    request: Request,
    id: str = Query(..., alias="id"),
    quality: str = Query("720p"),
    taskId: str | None = Query(None),
):
    limited = check_rate_limit("download", request)
    if limited:
        return limited

    if not is_valid_video_id(id):
        return JSONResponse(status_code=400, content={"error": "Invalid video ID"})
    if not is_valid_quality(quality):
        return JSONResponse(status_code=400, content={"error": "Invalid quality parameter"})

    download_id = taskId or f"{id}-{quality}-{int(time.time() * 1000)}"
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    def on_progress(progress_data: dict):
        queue.put_nowait(progress_data)

    async def run_download():
        try:
            await download_video(id, quality, on_progress, download_id)
        except Exception as err:
            await queue.put(
                {
                    "status": "error",
                    "progress": 0,
                    "speed": "0 MB/s",
                    "eta": map_youtube_error(err),
                    "videoId": id,
                }
            )
        finally:
            await queue.put(None)

    async def generator():
        task = asyncio.create_task(run_download())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield _sse_event(event)
        finally:
            if not task.done():
                cancel_download(download_id)
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    )


@router.delete("/download")
async def cancel_download_route(taskId: str = Query(...)):
    if not taskId:
        return JSONResponse(status_code=400, content={"error": "taskId is required"})
    cancelled = cancel_download(taskId)
    return {"cancelled": cancelled}


@router.get("/download/stream")
async def download_stream(
    request: Request,
    id: str = Query(..., alias="id"),
    quality: str = Query("720p"),
    title: str = Query("video"),
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    limited = check_rate_limit("download", request)
    if limited:
        return limited

    if not is_valid_video_id(id):
        return JSONResponse(status_code=400, content={"error": "Invalid video ID"})
    if not is_valid_quality(quality):
        return JSONResponse(status_code=400, content={"error": "Invalid quality parameter"})

    start_seconds = float(start) if start else 0.0
    end_seconds = float(end) if end else None

    if start and (start_seconds != start_seconds or start_seconds < 0):
        return JSONResponse(status_code=400, content={"error": "Invalid start time"})
    if end_seconds is not None and (end_seconds != end_seconds or end_seconds <= start_seconds):
        return JSONResponse(status_code=400, content={"error": "Invalid end time"})

    try:
        byte_iter, content_type, ext = await stream_video(
            id, quality, start_seconds=start_seconds, end_seconds=end_seconds
        )
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": map_youtube_error(err)})

    clean_title = sanitize_filename(title)
    has_clip = start_seconds > 0 or end_seconds is not None
    client_filename = f"{clean_title}_clip.{ext}" if has_clip else f"{clean_title}.{ext}"

    async def body():
        async for chunk in byte_iter:
            yield chunk

    encoded = quote(client_filename)
    return StreamingResponse(
        body(),
        media_type=content_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{encoded}"; filename*=UTF-8\'\'{encoded}'
            ),
            "Cache-Control": "no-cache",
        },
    )


@router.get("/download/file")
async def download_file(
    id: str = Query(..., alias="id"),
    quality: str = Query("720p"),
    title: str = Query("video"),
):
    if not is_valid_video_id(id):
        return JSONResponse(status_code=400, content={"error": "Invalid video ID"})
    if not is_valid_quality(quality):
        return JSONResponse(status_code=400, content={"error": "Invalid quality parameter"})

    file_path = get_final_path(id, quality)
    resolved = file_path.resolve()
    downloads_root = get_downloads_dir().resolve()

    if not str(resolved).startswith(str(downloads_root)):
        return JSONResponse(status_code=400, content={"error": "Invalid file path"})

    if not resolved.exists():
        return JSONResponse(
            status_code=404,
            content={"error": "Downloaded file not found. Please run the download again."},
        )

    is_audio = quality == "Audio Only"
    ext = "mp3" if is_audio else "mp4"
    clean_title = sanitize_filename(title)
    client_filename = f"{clean_title}.{ext}"
    encoded = quote(client_filename)

    return FileResponse(
        path=resolved,
        media_type="audio/mpeg" if is_audio else "video/mp4",
        filename=client_filename,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{encoded}"; filename*=UTF-8\'\'{encoded}'
            ),
        },
    )


@router.get("/download/status")
async def download_status(
    id: str = Query(..., alias="id"),
    quality: str = Query("720p"),
    size: str | None = Query(None),
):
    if not is_valid_video_id(id):
        return JSONResponse(status_code=400, content={"error": "Invalid video ID"})
    if not is_valid_quality(quality):
        return JSONResponse(status_code=400, content={"error": "Invalid quality parameter"})

    try:
        return get_download_status(id, quality, size)
    except Exception as err:
        return JSONResponse(status_code=500, content={"error": str(err)})
