from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.routers import auth, dashboard, months

settings = get_settings()

app = FastAPI(title="Finance Tracker")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=settings.secure_cookies,
    same_site="lax",
)

app.mount(
    "/static",
    StaticFiles(directory=str(Path(__file__).parent / "static")),
    name="static",
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(months.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
