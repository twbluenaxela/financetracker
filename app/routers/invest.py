from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import InvestmentPlan, User
from app.projection import (
    blended_return,
    lump_sum_schedule,
    periodic_schedule,
    recommend_allocation,
    years_to_target,
)
from app.security import current_user
from app.templating import templates

router = APIRouter()

_MILESTONES = [1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 50]


def _dec(raw, default="0") -> Decimal:
    try:
        v = Decimal(str(raw).strip().replace(",", ""))
    except (InvalidOperation, AttributeError):
        return Decimal(default)
    return v


def _get_plan(db: Session) -> InvestmentPlan:
    plan = db.get(InvestmentPlan, 1)
    if plan is None:
        plan = InvestmentPlan(id=1)
        db.add(plan)
        db.commit()
    return plan


def _ctx(user: User):
    d = user.email.split("@")[0]
    return {"user": user, "user_display": d, "user_initial": d[:1].upper()}


def _table(schedule, target: Decimal):
    """Milestone rows + the year the target is first reached."""
    last = schedule[-1].year
    years = sorted({y for y in _MILESTONES if y <= last})
    hit = None
    for row in schedule:
        if target > 0 and row.balance >= target:
            hit = row.year
            break
    if hit and hit not in years:
        years.append(hit)
        years.sort()
    rows = []
    for y in years:
        r = schedule[y]
        rows.append(
            {
                "year": y,
                "contribution": r.contribution,
                "balance": r.balance,
                "is_target": hit is not None and y == hit,
            }
        )
    return rows, hit


@router.get("/invest", response_class=HTMLResponse)
def invest(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    p = _get_plan(db)

    rate = blended_return(
        Decimal(p.tw_stock_pct),
        Decimal(p.us_stock_pct),
        Decimal(p.bond_pct),
        tw_stock_return=p.tw_stock_return,
        us_stock_return=p.us_stock_return,
        bond_return=p.bond_return,
    )
    annual_contrib = p.monthly_contribution * 12

    need_lump = years_to_target(
        p.target_amount, rate, principal=p.starting_capital
    )
    need_per = years_to_target(
        p.target_amount, rate, annual_contribution=annual_contrib
    )
    need = years_to_target(
        p.target_amount,
        rate,
        principal=p.starting_capital,
        annual_contribution=annual_contrib,
    )
    reached = [y for y in (need_lump, need_per, need) if y]
    span = min(80, max(reached, default=40) + 2)

    lump = lump_sum_schedule(p.starting_capital, rate, span)
    periodic = periodic_schedule(annual_contrib, rate, span)
    lump_rows, lump_hit = _table(lump, p.target_amount)
    per_rows, per_hit = _table(periodic, p.target_amount)

    rec = recommend_allocation(p.age or 35, p.risk, need or 20)
    pct_sum = p.tw_stock_pct + p.us_stock_pct + p.bond_pct

    return templates.TemplateResponse(
        request,
        "invest.html",
        {
            **_ctx(user),
            "p": p,
            "blended_pct": f"{float(rate) * 100:.2f}",
            "pct_sum": pct_sum,
            "annual_contrib": annual_contrib,
            "lump_rows": lump_rows,
            "lump_hit": lump_hit,
            "per_rows": per_rows,
            "per_hit": per_hit,
            "rec": rec,
        },
    )


@router.post("/invest")
async def save_invest(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    p = _get_plan(db)
    f = await request.form()
    p.starting_capital = _dec(f.get("starting_capital"))
    p.monthly_contribution = _dec(f.get("monthly_contribution"))
    p.target_amount = _dec(f.get("target_amount"))
    p.tw_stock_pct = int(_dec(f.get("tw_stock_pct")))
    p.us_stock_pct = int(_dec(f.get("us_stock_pct")))
    p.bond_pct = int(_dec(f.get("bond_pct")))
    p.tw_stock_return = _dec(f.get("tw_stock_return"), "0.06")
    p.us_stock_return = _dec(f.get("us_stock_return"), "0.07")
    p.bond_return = _dec(f.get("bond_return"), "0.03")
    age_raw = (f.get("age") or "").strip()
    p.age = int(age_raw) if age_raw.isdigit() else None
    risk = f.get("risk", "moderate")
    p.risk = risk if risk in ("conservative", "moderate", "aggressive") else "moderate"
    db.commit()
    return RedirectResponse("/invest", status_code=303)
