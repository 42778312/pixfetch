import re

ALLOWED_QUALITIES = ["1080p", "720p", "480p", "360p", "Audio Only"]
VIDEO_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def is_valid_video_id(video_id: str | None) -> bool:
    return bool(video_id and VIDEO_ID_REGEX.match(video_id))


def is_valid_quality(quality: str | None) -> bool:
    return quality in ALLOWED_QUALITIES


def sanitize_filename(title: str | None) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|]', "", title or "video").strip()
    return cleaned or "video"
