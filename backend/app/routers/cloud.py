import asyncio
import json
import time

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.constants import is_valid_quality, is_valid_video_id, sanitize_filename
from app.core.errors import map_youtube_error
from app.core.rate_limit import check_rate_limit
from app.core.storage import parse_size_to_bytes
from app.dependencies import get_session_token
from app.services.google_drive import create_resumable_session, upload_stream_resumable
from app.services.google_oauth import get_google_access_token
from app.services.stream_resolver import stream_video

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/google-drive")
async def google_drive_upload(
    request: Request,
    id: str = Query(..., alias="id"),
    quality: str = Query("720p"),
    title: str = Query("video"),
    size: str = Query(""),
    start: str | None = Query(None),
    end: str | None = Query(None),
    taskId: str | None = Query(None),
):
    limited = check_rate_limit("download", request)
    if limited:
        return limited

    token_data = await get_session_token(request)
    token_result = await get_google_access_token(token_data)
    if not token_result:
        return JSONResponse(status_code=401, content={"error": "Sign in with Google to save to Drive"})
    if isinstance(token_result, dict) and token_result.get("reauthRequired"):
        body = _sse_event(
            {
                "status": "error",
                "progress": 0,
                "speed": "0 MB/s",
                "eta": "Google Drive permission missing. Sign out, then sign in with Google again and allow Drive access.",
                "code": "drive_scope_missing",
            }
        )
        return StreamingResponse(
            iter([body]),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    access_token = token_result

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

    expected_bytes = parse_size_to_bytes(size)
    task_id = taskId or f"{id}-{quality}-{int(time.time() * 1000)}"
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def run_upload():
        try:
            await queue.put(
                {
                    "status": "connecting",
                    "progress": 2,
                    "speed": "0 MB/s",
                    "eta": "Starting stream...",
                    "taskId": task_id,
                }
            )

            byte_iter, content_type, ext = await stream_video(
                id, quality, start_seconds=start_seconds, end_seconds=end_seconds
            )

            clean_title = sanitize_filename(title)
            has_clip = start_seconds > 0 or end_seconds is not None
            filename = f"{clean_title}_clip.{ext}" if has_clip else f"{clean_title}.{ext}"

            await queue.put(
                {
                    "status": "downloading",
                    "progress": 5,
                    "speed": "0 MB/s",
                    "eta": "Uploading to Google Drive...",
                    "taskId": task_id,
                }
            )

            session_url = await create_resumable_session(access_token, filename, content_type)
            last_update = 0.0

            def on_progress(progress: dict):
                nonlocal last_update
                now = time.time() * 1000
                if now - last_update < 300:
                    return
                last_update = now
                uploaded = progress.get("uploaded", 0)
                total = progress.get("total") or expected_bytes
                progress_pct = 10
                if total > 0:
                    progress_pct = min(round((uploaded / total) * 90) + 5, 95)
                elif uploaded > 0:
                    progress_pct = min(50 + round(uploaded / (50 * 1024 * 1024)), 90)
                queue.put_nowait(
                    {
                        "status": "downloading",
                        "progress": progress_pct,
                        "speed": "—",
                        "eta": "Uploading to Google Drive...",
                        "taskId": task_id,
                    }
                )

            file_data = await upload_stream_resumable(session_url, byte_iter, on_progress=on_progress)

            web_view_link = file_data.get("webViewLink") or (
                f"https://drive.google.com/file/d/{file_data['id']}/view" if file_data.get("id") else None
            )

            await queue.put(
                {
                    "status": "completed",
                    "progress": 100,
                    "speed": "0 MB/s",
                    "eta": "Saved to Google Drive",
                    "taskId": task_id,
                    "webViewLink": web_view_link,
                    "driveFileId": file_data.get("id"),
                }
            )
        except Exception as err:
            await queue.put(
                {
                    "status": "error",
                    "progress": 0,
                    "speed": "0 MB/s",
                    "eta": map_youtube_error(err),
                    "taskId": task_id,
                }
            )
        finally:
            await queue.put(None)

    async def generator():
        task = asyncio.create_task(run_upload())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield _sse_event(event)
        finally:
            if not task.done():
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
