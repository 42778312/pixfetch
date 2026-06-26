from fastapi import Request

from app.config import get_settings
from app.services.google_oauth import SESSION_COOKIE, decode_session, get_valid_token_data


async def get_session_token(request: Request) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    data = decode_session(token)
    if not data:
        return None
    return await get_valid_token_data(data)
