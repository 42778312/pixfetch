import os
import time
from pathlib import Path

from app.config import get_settings

CLEANUP_MAX_AGE_SEC = 24 * 60 * 60


def get_downloads_dir() -> Path:
    settings = get_settings()
    downloads = Path(settings.downloads_dir)
    downloads.mkdir(parents=True, exist_ok=True)
    return downloads


def get_final_path(video_id: str, quality: str) -> Path:
    is_audio = quality in ("Audio Only", "mp3")
    ext = "mp3" if is_audio else "mp4"
    label = "Audio Only" if is_audio else quality
    return get_downloads_dir() / f"{video_id}_{label}.{ext}"


def get_temp_paths(video_id: str) -> list[Path]:
    downloads = get_downloads_dir()
    return [
        downloads / f"temp_{video_id}_video.mp4",
        downloads / f"temp_{video_id}_audio.webm",
    ]


def parse_size_to_bytes(size_str: str | None) -> int:
    if not size_str or size_str in ("Auto", "Unknown size", "—"):
        return 0
    import re

    match = re.match(r"^([\d.]+)\s*(B|KB|MB|GB)$", str(size_str), re.I)
    if not match:
        return 0
    value = float(match.group(1))
    unit = match.group(2).upper()
    multipliers = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}
    return round(value * multipliers.get(unit, 1))


def get_download_status(video_id: str, quality: str, expected_size_str: str | None = None) -> dict:
    final_path = get_final_path(video_id, quality)
    expected_bytes = parse_size_to_bytes(expected_size_str)

    if final_path.exists():
        size = final_path.stat().st_size
        if size > 0:
            return {
                "status": "complete",
                "bytesDownloaded": size,
                "totalBytes": size,
                "progress": 100,
            }

    partial_bytes = 0
    seen: set[str] = set()
    for temp_path in get_temp_paths(video_id):
        key = str(temp_path)
        if key in seen or not temp_path.exists():
            continue
        seen.add(key)
        partial_bytes += temp_path.stat().st_size

    if partial_bytes > 0:
        progress = (
            min(round((partial_bytes / expected_bytes) * 100), 99)
            if expected_bytes > 0
            else 0
        )
        return {
            "status": "partial",
            "bytesDownloaded": partial_bytes,
            "totalBytes": expected_bytes or None,
            "progress": progress,
        }

    return {
        "status": "none",
        "bytesDownloaded": 0,
        "totalBytes": expected_bytes or None,
        "progress": 0,
    }


def cleanup_old_downloads() -> None:
    downloads = get_downloads_dir()
    if not downloads.exists():
        return
    now = time.time()
    try:
        for entry in downloads.iterdir():
            if not entry.is_file():
                continue
            if now - entry.stat().st_mtime > CLEANUP_MAX_AGE_SEC:
                entry.unlink(missing_ok=True)
    except OSError:
        pass
