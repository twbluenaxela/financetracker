from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import MonthlySummary, User
from app.security import current_user
from app.templating import templates

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def dashboard(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)

    recent = db.execute(
        select(MonthlySummary)
        .order_by(MonthlySummary.year.desc(), MonthlySummary.month.desc())
        .limit(6)
    ).scalars().all()

    return templates.TemplateResponse(
        request, "dashboard.html", {"user": user, "recent": recent}
    )
