from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import GOAL_TIERS, UNCATEGORIZED, Goal, MonthlySummary, User

_TIER_WEIGHT = {"短期": Decimal("0.5"), "中期": Decimal("0.3"), "長期": Decimal("0.2")}
from app.security import current_user
from app.templating import templates

router = APIRouter()

_CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]


def _month_cn(m: int) -> str:
    return _CN_NUM[m - 1] + "月"


def _chart_label(year: int, month: int) -> str:
    return f"{str(year)[2:]}'1月" if month == 1 else f"{month}月"


def _pct(numer: Decimal, denom: Decimal) -> float | None:
    if not denom:
        return None
    return float(numer) / float(denom) * 100


@router.get("/", response_class=HTMLResponse)
def dashboard(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)

    months = list(
        reversed(
            db.execute(
                select(MonthlySummary)
                .order_by(
                    MonthlySummary.year.desc(), MonthlySummary.month.desc()
                )
                .limit(12)
            )
            .scalars()
            .all()
        )
    )

    display = user.email.split("@")[0]
    base = {
        "user": user,
        "user_display": display,
        "user_initial": display[:1].upper(),
        "generated_at": datetime.now().strftime("%Y/%m/%d %H:%M"),
    }

    if not months:
        return templates.TemplateResponse(
            request, "dashboard.html", {**base, "has_data": False}
        )

    current = months[-1]
    prev = months[-2] if len(months) >= 2 else None

    surplus = current.surplus
    prev_surplus = prev.surplus if prev else Decimal(0)
    surplus_delta = surplus - prev_surplus
    savings_rate = _pct(surplus, current.total_income)
    income_delta = _pct(
        current.total_income - prev.total_income, prev.total_income
    ) if prev else None
    expense_delta = _pct(
        current.total_expense - prev.total_expense, prev.total_expense
    ) if prev else None

    exp_lines = [r for r in current.expense_breakdown]
    exp_cat_count = len(
        [line for line in current.lines if line.kind == "expense"]
    )
    uncat_count = 1 if any(r["name"] == UNCATEGORIZED for r in exp_lines) else 0

    # ---- 12-month twin-bar chart geometry (matches the prototype) ----
    chart_h, half = 220, 110.0
    n = len(months)
    slot_w = 100.0 / n
    bar_w = slot_w * 0.32
    raw_max = max(
        (max(m.total_income, m.total_expense) for m in months),
        default=Decimal(0),
    )
    cap = float(raw_max) or 1.0

    bars, labels = [], []
    for i, m in enumerate(months):
        cx = slot_w * i + slot_w / 2
        ih = float(m.total_income) / cap * (half - 6)
        eh = float(m.total_expense) / cap * (half - 6)
        active = i == n - 1
        bars.append(
            {
                "active": active,
                "ix": round(cx - bar_w, 3),
                "iy": round(half - ih, 3),
                "iw": round(bar_w, 3),
                "ih": round(ih, 3),
                "ex": round(cx, 3),
                "ey": round(half, 3),
                "ew": round(bar_w, 3),
                "eh": round(eh, 3),
                "cx": round(cx, 3),
                "hitx": round(cx - slot_w / 2, 3),
                "hitw": round(slot_w, 3),
            }
        )
        labels.append(
            {
                "text": _chart_label(m.year, m.month),
                "active": active,
                "w": round(slot_w, 4),
            }
        )

    # ---- category breakdown (sorted, top 7 + 其他) ----
    cat_total = sum((Decimal(str(r["amount"])) for r in exp_lines), Decimal(0))
    ordered = sorted(exp_lines, key=lambda r: r["amount"], reverse=True)
    top = ordered[:7]
    rest = ordered[7:]
    rest_amount = sum((Decimal(str(r["amount"])) for r in rest), Decimal(0))
    cat_rows = []
    for i, r in enumerate(top):
        amt = Decimal(str(r["amount"]))
        cat_rows.append(
            {
                "i": i,
                "name": r["name"],
                "amount": amt,
                "pct": _pct(amt, cat_total) or 0,
                "is_uncat": r["name"] == UNCATEGORIZED,
            }
        )
    if rest_amount > 0:
        cat_rows.append(
            {
                "i": len(top),
                "name": f"其他 {len(rest)} 項",
                "amount": rest_amount,
                "pct": _pct(rest_amount, cat_total) or 0,
                "is_uncat": False,
            }
        )

    # ---- recent table (newest first) ----
    recent = []
    for idx in range(n - 1, -1, -1):
        m = months[idx]
        s = m.surplus
        smax = float(max(m.total_income, m.total_expense)) or 1.0
        recent.append(
            {
                "year": m.year,
                "month": m.month,
                "label": f"{m.year}-{m.month:02d}",
                "month_cn": _month_cn(m.month),
                "is_current": idx == n - 1,
                "income": m.total_income,
                "expense": m.total_expense,
                "surplus": s,
                "rate": _pct(s, m.total_income),
                "spark_ih": round(float(m.total_income) / smax * 14, 2),
                "spark_eh": round(float(m.total_expense) / smax * 14, 2),
            }
        )

    # ---- goals + auto-allocation from trailing-average surplus ----
    window = months[-6:]
    trailing = (
        sum((m.surplus for m in window), Decimal(0)) / len(window)
        if window
        else Decimal(0)
    )
    all_goals = (
        db.execute(select(Goal).order_by(Goal.priority, Goal.id))
        .scalars()
        .all()
    )
    active_by_tier = {t: 0 for t in GOAL_TIERS}
    for g in all_goals:
        if g.remaining > 0:
            active_by_tier[g.tier] += 1

    goals_view = []
    for g in all_goals:
        cnt = active_by_tier.get(g.tier, 0)
        if trailing > 0 and cnt and g.remaining > 0:
            alloc = _TIER_WEIGHT[g.tier] * trailing / cnt
        else:
            alloc = Decimal(0)
        if g.target_date:
            eta = f"{g.target_date.year} 年 {g.target_date.month} 月"
        elif alloc > 0 and g.remaining > 0:
            mths = int(-(-g.remaining // alloc))
            ey, em = current.year + (current.month - 1 + mths) // 12, (
                current.month - 1 + mths
            ) % 12 + 1
            eta = f"約 {ey} 年 {em} 月"
        else:
            eta = "—"
        goals_view.append(
            {
                "tier": g.tier,
                "label": g.label,
                "current": g.current_amount,
                "target": g.target_amount,
                "pct": g.progress_pct,
                "eta": eta,
                "alloc": alloc,
            }
        )

    js_day = (date(current.year, current.month, 18).weekday() + 1) % 7
    week_no = -(-(js_day + 18) // 7)  # ceil

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            **base,
            "has_data": True,
            "year": current.year,
            "month_cn": _month_cn(current.month),
            "week_no": week_no,
            "surplus": surplus,
            "surplus_neg": surplus < 0,
            "surplus_delta": surplus_delta,
            "surplus_delta_pos": surplus_delta >= 0,
            "savings_rate": savings_rate,
            "daily_avg": current.total_expense / 30,
            "income": current.total_income,
            "expense": current.total_expense,
            "income_delta": income_delta,
            "expense_delta": expense_delta,
            "income_lines_count": len(current.income_breakdown),
            "exp_cat_count": exp_cat_count,
            "uncat_count": uncat_count,
            "chart_max_lbl": templates.env.filters["compact"](cap),
            "chart_half_lbl": templates.env.filters["compact"](cap / 2),
            "bars": bars,
            "labels": labels,
            "cat_count": len(exp_lines),
            "cat_total": cat_total,
            "cat_rows": cat_rows,
            "recent": recent,
            "goals": goals_view,
            "trailing_surplus": trailing,
        },
    )
