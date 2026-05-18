from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Neon / Postgres connection string. Locally this points at the
    # docker-compose Postgres; on Fly it comes from `fly secrets`.
    database_url: str = "postgresql://finance:finance@localhost:5432/finance"

    # Signs the session cookie. MUST be set to a long random value in prod.
    session_secret: str = "dev-only-insecure-change-me"

    # Marks the session cookie Secure so it is only sent over HTTPS.
    # True in production (Fly serves HTTPS), False for local http dev.
    secure_cookies: bool = False

    @property
    def sqlalchemy_url(self) -> str:
        # SQLAlchemy needs the psycopg3 driver spelled out. Neon hands you a
        # plain postgresql:// URL, so normalize it here.
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
