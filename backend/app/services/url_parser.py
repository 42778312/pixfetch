import re
from dataclasses import dataclass
from typing import Literal

VIDEO_ID_PATTERN = re.compile(r"[a-zA-Z0-9_-]{11}")

URL_PATTERNS = [
    re.compile(
        r"(?:youtube\.com/watch\?.*v=|youtu\.be/|youtube\.com/embed/|"
        r"youtube\.com/v/|youtube\.com/shorts/|music\.youtube\.com/watch\?.*v=)"
        r"([a-zA-Z0-9_-]{11})"
    ),
    re.compile(r"youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})"),
]

PLAYLIST_PATTERN = re.compile(r"[?&]list=([a-zA-Z0-9_-]+)")

Mode = Literal["video", "playlist", "ambiguous"] | None


@dataclass
class ParsedYoutubeInput:
    video_id: str | None
    playlist_id: str | None
    normalized_url: str | None
    mode: Mode


def parse_youtube_input(input_str: str | None) -> ParsedYoutubeInput:
    if not input_str or not isinstance(input_str, str):
        return ParsedYoutubeInput(None, None, None, None)

    trimmed = input_str.strip()
    if not trimmed:
        return ParsedYoutubeInput(None, None, None, None)

    video_id = None
    playlist_id = None

    playlist_match = PLAYLIST_PATTERN.search(trimmed)
    if playlist_match:
        playlist_id = playlist_match.group(1)

    for pattern in URL_PATTERNS:
        match = pattern.search(trimmed)
        if match and len(match.group(1)) == 11:
            video_id = match.group(1)
            break

    if not video_id:
        bare = re.match(r"^[a-zA-Z0-9_-]{11}$", trimmed)
        if bare:
            video_id = bare.group(0)

    if not video_id:
        all_ids = VIDEO_ID_PATTERN.findall(trimmed)
        unique_ids = list(dict.fromkeys(all_ids))
        if len(unique_ids) == 1:
            video_id = unique_ids[0]

    mode: Mode = None
    if video_id and playlist_id:
        mode = "ambiguous"
    elif playlist_id:
        mode = "playlist"
    elif video_id:
        mode = "video"

    normalized_url = None
    if video_id and mode == "video":
        normalized_url = f"https://www.youtube.com/watch?v={video_id}"
    elif playlist_id and mode == "playlist":
        normalized_url = f"https://www.youtube.com/playlist?list={playlist_id}"
    elif video_id and playlist_id:
        normalized_url = f"https://www.youtube.com/watch?v={video_id}&list={playlist_id}"

    return ParsedYoutubeInput(video_id, playlist_id, normalized_url, mode)


def build_video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def build_playlist_url(playlist_id: str) -> str:
    return f"https://www.youtube.com/playlist?list={playlist_id}"
