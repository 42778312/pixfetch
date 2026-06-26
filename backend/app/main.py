from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.core.storage import cleanup_old_downloads
from app.routers import auth, cloud, download, health, info


@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_old_downloads()
    yield


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="PIXFETCH API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url.rstrip("/"), "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SessionMiddleware, secret_key=settings.session_secret)

    app.include_router(health.router)
    app.include_router(info.router)
    app.include_router(download.router)
    app.include_router(auth.router)
    app.include_router(cloud.router)

    return app


app = create_app()
