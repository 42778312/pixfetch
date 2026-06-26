import time
from typing import Any

import httpx
from jose import JWTError, jwt

from app.config import Settings, get_settings

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
GOOGLE_SCOPES = f"openid email profile {DRIVE_SCOPE}"
SESSION_COOKIE = "pixfetch_session"
ALGORITHM = "HS256"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


def encode_session(payload: dict[str, Any], settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    return jwt.encode(payload, settings.session_secret, algorithm=ALGORITHM)


def decode_session(token: str, settings: Settings | None = None) -> dict[str, Any] | None:
    settings = settings or get_settings()
    try:
        return jwt.decode(token, settings.session_secret, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def refresh_google_access_token(token_data: dict[str, Any], settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        return {**token_data, "error": "RefreshAccessTokenError"}

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )

    data = res.json()
    if not res.is_success:
        return {**token_data, "error": "RefreshAccessTokenError"}

    return {
        **token_data,
        "access_token": data["access_token"],
        "expires_at": int(time.time() * 1000) + data.get("expires_in", 3600) * 1000,
        "refresh_token": data.get("refresh_token", refresh_token),
        "error": None,
    }


async def get_valid_token_data(token_data: dict[str, Any] | None) -> dict[str, Any] | None:
    if not token_data or not token_data.get("access_token"):
        return None

    if token_data.get("error") == "RefreshAccessTokenError":
        return None

    expires_at = token_data.get("expires_at", 0)
    if expires_at and time.time() * 1000 < expires_at - 60_000:
        return token_data

    if token_data.get("refresh_token"):
        return await refresh_google_access_token(token_data)

    return token_data


async def fetch_token_scopes(access_token: str) -> tuple[str | None, str | None]:
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"access_token": access_token},
            )
        if not res.is_success:
            return None, f"tokeninfo_{res.status_code}"
        data = res.json()
        return data.get("scope", ""), None
    except Exception:
        return None, "tokeninfo_fetch_failed"


def has_drive_file_scope(scope_string: str | None) -> bool:
    if not scope_string:
        return False
    return "drive.file" in scope_string or DRIVE_SCOPE in scope_string


async def get_google_access_token(token_data: dict[str, Any] | None) -> str | dict[str, Any] | None:
    valid = await get_valid_token_data(token_data)
    if not valid or not valid.get("access_token"):
        return None

    if valid.get("error") == "RefreshAccessTokenError":
        return None

    live_scopes, _ = await fetch_token_scopes(valid["access_token"])
    jwt_scopes = valid.get("granted_scopes", "")
    if not has_drive_file_scope(live_scopes) and not has_drive_file_scope(jwt_scopes):
        return {"error": "drive_scope_missing", "reauthRequired": True}

    return valid["access_token"]


def session_to_response(token_data: dict[str, Any]) -> dict[str, Any]:
    from datetime import datetime, timedelta, timezone

    expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    payload: dict[str, Any] = {
        "user": {
            "name": token_data.get("name"),
            "email": token_data.get("email"),
            "image": token_data.get("picture"),
        },
        "expires": expires.isoformat(),
    }
    if token_data.get("error"):
        payload["error"] = token_data["error"]
    return payload
