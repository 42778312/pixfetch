from app.services.url_parser import build_playlist_url
from app.services.ytdlp import map_ytdlp_to_playlist_info, map_ytdlp_to_video_info, run_ytdlp_json


async def fetch_video_info(url: str) -> dict:
    data = await run_ytdlp_json(["-j", "--no-playlist", "--no-warnings", url])
    return map_ytdlp_to_video_info(data)


async def fetch_playlist_info(playlist_id: str) -> dict:
    playlist_url = build_playlist_url(playlist_id)
    data = await run_ytdlp_json(["-J", "--flat-playlist", "--no-warnings", playlist_url], timeout_ms=180_000)
    return map_ytdlp_to_playlist_info(data, playlist_id)
