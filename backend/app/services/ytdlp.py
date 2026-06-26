import asyncio
import json
import shutil
import sys
import subprocess
from collections.abc import Callable
from typing import Any

from app.config import get_settings

_active_downloads: dict[str, Callable[[], None]] = {}


def register_download(download_id: str, cancel_fn: Callable[[], None]) -> None:
    _active_downloads[download_id] = cancel_fn


def unregister_download(download_id: str) -> None:
    _active_downloads.pop(download_id, None)


def cancel_download(download_id: str) -> bool:
    cancel_fn = _active_downloads.get(download_id)
    if cancel_fn:
        cancel_fn()
        _active_downloads.pop(download_id, None)
        return True
    return False


def find_ytdlp_binary() -> list[str]:
    settings = get_settings()
    if settings.ytdlp_path:
        return [settings.ytdlp_path]
    found = shutil.which("yt-dlp")
    if found:
        return [found]
    return [sys.executable, "-m", "yt_dlp"]


def format_section_time(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    if hrs > 0:
        return f"{hrs}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"


async def run_ytdlp(
    args: list[str],
    *,
    on_progress: Callable[[float], None] | None = None,
    timeout_ms: int = 300_000,
    download_id: str | None = None,
) -> str:
    binary = find_ytdlp_binary()
    proc = await asyncio.create_subprocess_exec(
        *binary,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    cancelled = False

    def cancel() -> None:
        nonlocal cancelled
        cancelled = True
        try:
            proc.kill()
        except ProcessLookupError:
            pass

    if download_id:
        register_download(download_id, cancel)

    stderr_chunks: list[str] = []

    async def read_stderr() -> None:
        assert proc.stderr is not None
        while True:
            chunk = await proc.stderr.read(4096)
            if not chunk:
                break
            text = chunk.decode(errors="replace")
            stderr_chunks.append(text)
            if on_progress:
                import re

                for match in re.finditer(r"(\d+\.?\d*)%", text):
                    on_progress(float(match.group(1)))

    try:
        await asyncio.wait_for(
            asyncio.gather(read_stderr(), proc.wait()),
            timeout=timeout_ms / 1000,
        )
    except asyncio.TimeoutError:
        cancel()
        raise RuntimeError("yt-dlp timed out") from None
    finally:
        if download_id:
            unregister_download(download_id)

    if cancelled:
        raise RuntimeError("Download cancelled")

    if proc.returncode != 0:
        stderr = "".join(stderr_chunks).strip()
        raise RuntimeError(stderr or f"yt-dlp exited with code {proc.returncode}")

    return "".join(stderr_chunks)


async def run_ytdlp_json(args: list[str], timeout_ms: int = 120_000) -> dict[str, Any]:
    binary = find_ytdlp_binary()
    proc = await asyncio.create_subprocess_exec(
        *binary,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=timeout_ms / 1000,
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("yt-dlp timed out") from None

    if proc.returncode != 0:
        err = stderr.decode(errors="replace").strip()
        raise RuntimeError(err or f"yt-dlp exited with code {proc.returncode}")

    return json.loads(stdout.decode())


async def is_ytdlp_available() -> bool:
    try:
        binary = find_ytdlp_binary()
        proc = await asyncio.create_subprocess_exec(
            *binary,
            "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=15)
        return proc.returncode == 0
    except Exception:
        return False


async def is_ffmpeg_available() -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=10)
        return proc.returncode == 0
    except Exception:
        return False


def map_ytdlp_to_video_info(data: dict[str, Any]) -> dict[str, Any]:
    formats: list[dict[str, Any]] = []
    for height in (1080, 720, 480, 360):
        match = next(
            (
                f
                for f in data.get("formats", [])
                if f.get("height") == height
                and f.get("vcodec") != "none"
                and f.get("ext") == "mp4"
            ),
            None,
        )
        if match:
            filesize = match.get("filesize") or match.get("filesize_approx")
            formats.append(
                {
                    "quality": f"{height}p",
                    "ext": "mp4",
                    "size": f"{filesize / (1024 * 1024):.1f} MB" if filesize else "Unknown size",
                    "fps": match.get("fps") or 30,
                    "itag": match.get("format_id"),
                    "hasAudio": match.get("acodec") != "none",
                }
            )

    audio_format = next(
        (f for f in data.get("formats", []) if f.get("acodec") != "none" and f.get("vcodec") == "none"),
        None,
    )
    if audio_format:
        filesize = audio_format.get("filesize") or audio_format.get("filesize_approx")
        formats.append(
            {
                "quality": "Audio Only",
                "ext": "mp3",
                "size": f"{filesize / (1024 * 1024):.1f} MB" if filesize else "Unknown size",
                "fps": None,
                "itag": audio_format.get("format_id"),
                "hasAudio": True,
            }
        )

    if not formats:
        formats.append(
            {"quality": "720p", "ext": "mp4", "size": "Auto", "fps": 30, "itag": "best", "hasAudio": True}
        )

    duration = data.get("duration") or 0
    mins = int(duration // 60)
    secs = int(duration % 60)
    if duration >= 3600:
        duration_str = f"{int(duration // 3600)}:{mins % 60:02d}:{secs:02d}"
    else:
        duration_str = f"{mins}:{secs:02d}"

    return {
        "type": "video",
        "id": data.get("id"),
        "title": data.get("title"),
        "author": data.get("uploader") or data.get("channel") or "Unknown Creator",
        "thumbnail": data.get("thumbnail"),
        "duration": duration_str,
        "durationSeconds": duration,
        "formats": formats,
    }


def map_ytdlp_to_playlist_info(data: dict[str, Any], playlist_id: str) -> dict[str, Any]:
    author = data.get("uploader") or data.get("channel") or "YouTube"
    videos = []
    for entry in data.get("entries") or []:
        if not entry or not entry.get("id"):
            continue
        duration_sec = entry.get("duration") or 0
        videos.append(
            {
                "id": entry["id"],
                "title": entry.get("title") or "Untitled",
                "author": author,
                "thumbnail": (
                    (entry.get("thumbnails") or [{}])[-1].get("url")
                    if entry.get("thumbnails")
                    else entry.get("thumbnail")
                )
                or f"https://img.youtube.com/vi/{entry['id']}/mqdefault.jpg",
                "duration": format_section_time(duration_sec),
                "durationSec": duration_sec,
                "size": "—",
                "status": "queued",
            }
        )

    return {
        "type": "playlist",
        "id": playlist_id,
        "title": data.get("title") or "YouTube Playlist",
        "author": author,
        "thumbnail": (
            (data.get("thumbnails") or [{}])[0].get("url")
            if data.get("thumbnails")
            else videos[0]["thumbnail"]
            if videos
            else "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60"
        ),
        "videosCount": len(videos),
        "videos": videos,
    }
