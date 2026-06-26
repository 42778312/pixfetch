from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.responses import Response

from app.config import get_settings
from app.dependencies import get_session_token
from app.services.google_oauth import (
    GOOGLE_SCOPES,
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    encode_session,
    session_to_response,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth = OAuth()


def _register_oauth() -> None:
    settings = get_settings()
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={
            "scope": GOOGLE_SCOPES,
            "prompt": "consent",
            "access_type": "offline",
        },
    )


_register_oauth()


def _set_session_cookie(response: Response, token_data: dict) -> None:
    settings = get_settings()
    token = encode_session(token_data, settings)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        domain=settings.cookie_domain,
        path="/",
    )


@router.get("/google")
async def auth_google(request: Request):
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        return JSONResponse(status_code=503, content={"error": "Google OAuth is not configured"})

    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback/google")
async def auth_callback(request: Request):
    settings = get_settings()
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as err:
        return RedirectResponse(url=f"{settings.frontend_url}/?auth_error=1")

    userinfo = token.get("userinfo")
    if not userinfo:
        async with oauth.google.get("https://openidconnect.googleapis.com/v1/userinfo", token=token) as resp:
            userinfo = await resp.json()

    expires_at = token.get("expires_at")
    if expires_at:
        expires_ms = int(expires_at * 1000)
    else:
        import time

        expires_ms = int(time.time() * 1000) + token.get("expires_in", 3600) * 1000

    session_data = {
        "sub": userinfo.get("sub"),
        "email": userinfo.get("email"),
        "name": userinfo.get("name"),
        "picture": userinfo.get("picture"),
        "access_token": token.get("access_token"),
        "refresh_token": token.get("refresh_token"),
        "expires_at": expires_ms,
        "granted_scopes": token.get("scope", ""),
    }

    response = RedirectResponse(url=settings.frontend_url, status_code=302)
    _set_session_cookie(response, session_data)
    return response


@router.get("/session")
async def auth_session(request: Request):
    token_data = await get_session_token(request)
    if not token_data:
        return JSONResponse(content={})

    return session_to_response(token_data)


@router.post("/signout")
async def auth_signout():
    settings = get_settings()
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        domain=settings.cookie_domain,
    )
    return response
