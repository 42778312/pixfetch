import asyncio
from collections.abc import AsyncIterator

from app.services.ytdlp import find_ytdlp_binary, format_section_time


async def stream_video(
    video_id: str,
    quality: str,
    *,
    start_seconds: float = 0,
    end_seconds: float | None = None,
) -> tuple[AsyncIterator[bytes], str, str]:
    """Return async byte iterator, content-type, and file extension."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    is_audio = quality in ("Audio Only", "mp3")
    height = int(quality.replace("p", "")) if not is_audio else 0

    format_arg = (
        "bestaudio/best"
        if is_audio
        else f"bestvideo[height<={height}][ext=mp4]+bestaudio/best[height<={height}]/best[height<={height}]"
    )

    args = [
        url,
        "-f",
        format_arg,
        "--merge-output-format",
        "mp3" if is_audio else "mp4",
        "-o",
        "-",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
    ]
    if is_audio:
        args.extend(["--extract-audio", "--audio-format", "mp3"])

    if start_seconds > 0 or (end_seconds is not None and end_seconds > start_seconds):
        start_label = format_section_time(start_seconds)
        end_label = format_section_time(end_seconds if end_seconds is not None else start_seconds + 60)
        args.extend(["--download-sections", f"*{start_label}-{end_label}"])

    binary = find_ytdlp_binary()
    proc = await asyncio.create_subprocess_exec(
        *binary,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    async def iter_stdout() -> AsyncIterator[bytes]:
        assert proc.stdout is not None
        try:
            while True:
                chunk = await proc.stdout.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            if proc.returncode is None:
                await proc.wait()
            if proc.returncode not in (0, None):
                stderr = await proc.stderr.read() if proc.stderr else b""
                raise RuntimeError(stderr.decode(errors="replace").strip() or f"yt-dlp exited {proc.returncode}")

    content_type = "audio/mpeg" if is_audio else "video/mp4"
    ext = "mp3" if is_audio else "mp4"
    return iter_stdout(), content_type, ext
