from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.routers import auth, dashboard

settings = get_settings()

app = FastAPI(title="Finance Tracker")

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    https_only=settings.secure_cookies,
    same_site="lax",
)

app.include_router(auth.router)
app.include_router(dashboard.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
