from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_client_id: str = Field(default="", validation_alias="GOOGLE_CLIENT_ID")
    google_client_secret: str = Field(default="", validation_alias="GOOGLE_CLIENT_SECRET")
    session_secret: str = Field(default="change-me-in-production", validation_alias="SESSION_SECRET")
    frontend_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"
    downloads_dir: str = Field(default="/data/downloads", validation_alias="DOWNLOADS_DIR")
    ytdlp_path: str = Field(default="", validation_alias="YT_DLP_PATH")
    cookie_secure: bool = False
    cookie_domain: str | None = None

    @property
    def google_redirect_uri(self) -> str:
        return f"{self.api_base_url.rstrip('/')}/api/auth/callback/google"


@lru_cache
def get_settings() -> Settings:
    return Settings()
