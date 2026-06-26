import re


def map_youtube_error(error: Exception | str) -> str:
    message = str(error)

    if re.search(r"private|unavailable|Video unavailable", message, re.I):
        return "This video is unavailable or private."
    if re.search(r"age|sign in|login|confirm your age", message, re.I):
        return "This video is age-restricted or requires sign-in."
    if re.search(r"copyright|blocked|region", message, re.I):
        return "This video is blocked in your region or for copyright reasons."
    if re.search(r"playlist|not found", message, re.I):
        return "Playlist not found or is private."
    if re.search(r"invalid|could not extract", message, re.I):
        return "Invalid YouTube URL. Please check the link and try again."
    if re.search(r"no playable formats|sign in to confirm|bot", message, re.I):
        return (
            "YouTube blocked this request from the server. "
            "Try again, or run PIXFETCH locally for better compatibility."
        )

    return message
