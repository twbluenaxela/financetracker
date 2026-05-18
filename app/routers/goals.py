from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import GOAL_TIERS, Goal, User
from app.security import current_user
from app.templating import templates
from app.wealth import required_monthly_savings

router = APIRouter()


def _money(raw: str | None) -> Decimal:
    if not raw:
        return Decimal(0)
    try:
        v = Decimal(raw.strip().replace(",", ""))
    except InvalidOperation:
        return Decimal(0)
    return v if v >= 0 else Decimal(0)


def _pct(raw: str | None, default: str = "5") -> Decimal:
    if raw is None or not str(raw).strip():
        return Decimal(default) / Decimal(100)
    return _money(raw) / Decimal(100)


def _months_between(a: date, b: date) -> int:
    return max(1, (b.year - a.year) * 12 + (b.month - a.month))


def _ctx(user: User):
    d = user.email.split("@")[0]
    return {"user": user, "user_display": d, "user_initial": d[:1].upper()}


@router.get("/goals", response_class=HTMLResponse)
def list_goals(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
    edit: int | None = None,
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    goals = (
        db.execute(select(Goal).order_by(Goal.priority, Goal.id))
        .scalars()
        .all()
    )
    today = date.today()
    view = []
    for g in goals:
        required = None
        if g.target_date and g.remaining > 0:
            required = required_monthly_savings(
                target_amount=g.target_amount,
                current_amount=g.current_amount,
                annual_rate=g.expected_annual_return,
                months=_months_between(today, g.target_date),
            )
        view.append({"g": g, "required": required})
    editing = (
        db.get(Goal, edit) if edit else None
    )
    return templates.TemplateResponse(
        request,
        "goals.html",
        {
            **_ctx(user),
            "goals": view,
            "tiers": GOAL_TIERS,
            "editing": editing,
            "today": today.isoformat(),
        },
    )


@router.post("/goals")
async def create_goal(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    f = await request.form()
    tier = f.get("tier", "短期")
    if tier not in GOAL_TIERS:
        tier = "短期"
    label = (f.get("label") or "").strip()
    if not label:
        return RedirectResponse("/goals", status_code=303)
    td = (f.get("target_date") or "").strip()
    goal_id = f.get("goal_id")
    goal = db.get(Goal, int(goal_id)) if goal_id else None
    if goal is None:
        goal = Goal()
        db.add(goal)
    goal.tier = tier
    goal.label = label[:100]
    goal.target_amount = _money(f.get("target_amount"))
    goal.current_amount = _money(f.get("current_amount"))
    goal.expected_annual_return = _pct(f.get("expected_annual_return"))
    goal.target_date = date.fromisoformat(td) if td else None
    try:
        goal.priority = int(f.get("priority") or 0)
    except ValueError:
        goal.priority = 0
    db.commit()
    return RedirectResponse("/goals", status_code=303)


@router.post("/goals/{goal_id}/delete")
def delete_goal(
    goal_id: int,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    goal = db.get(Goal, goal_id)
    if goal:
        db.delete(goal)
        db.commit()
    return RedirectResponse("/goals", status_code=303)
