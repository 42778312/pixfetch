from collections.abc import Callable

from app.core.storage import cleanup_old_downloads, get_final_path
from app.services.ytdlp import run_ytdlp


async def download_video(
    video_id: str,
    quality: str,
    on_progress: Callable[[dict], None],
    download_id: str | None = None,
) -> str:
    cleanup_old_downloads()

    final_path = get_final_path(video_id, quality)
    if final_path.exists() and final_path.stat().st_size > 0:
        on_progress(
            {"status": "completed", "progress": 100, "speed": "0 MB/s", "eta": "0s", "videoId": video_id}
        )
        return str(final_path)

    url = f"https://www.youtube.com/watch?v={video_id}"
    is_audio = quality == "Audio Only"
    ext = "mp3" if is_audio else "mp4"
    label = "Audio Only" if is_audio else quality
    output_template = str(final_path.parent / f"{video_id}_{label}.{ext}")

    format_arg = (
        "bestaudio/best"
        if is_audio
        else f"bestvideo[height<={int(quality.replace('p', ''))}][ext=mp4]+bestaudio/best[height<={int(quality.replace('p', ''))}]"
    )

    args = [
        url,
        "-f",
        format_arg,
        "--merge-output-format",
        "mp3" if is_audio else "mp4",
        "-o",
        output_template,
        "--no-playlist",
        "--newline",
        "--continue",
    ]
    if is_audio:
        args.extend(["--extract-audio", "--audio-format", "mp3"])

    on_progress(
        {
            "status": "connecting",
            "progress": 0,
            "speed": "0 MB/s",
            "eta": "Analyzing streams...",
        }
    )
    on_progress(
        {
            "status": "downloading",
            "progress": 5,
            "speed": "0 MB/s",
            "eta": "Downloading via yt-dlp...",
        }
    )

    def progress_cb(pct: float) -> None:
        on_progress(
            {
                "status": "downloading",
                "progress": min(round(pct), 98),
                "speed": "0 MB/s",
                "eta": f"{round(pct)}%",
                "videoId": video_id,
            }
        )

    try:
        await run_ytdlp(args, on_progress=progress_cb, download_id=download_id)
    except RuntimeError as err:
        if "cancelled" in str(err).lower():
            raise
        raise

    if not final_path.exists() and is_audio:
        alt = final_path.parent / f"{video_id}_Audio Only.mp3"
        if alt.exists():
            on_progress(
                {"status": "completed", "progress": 100, "speed": "0 MB/s", "eta": "0s", "videoId": video_id}
            )
            return str(alt)

    on_progress(
        {"status": "completed", "progress": 100, "speed": "0 MB/s", "eta": "0s", "videoId": video_id}
    )
    return str(final_path)
