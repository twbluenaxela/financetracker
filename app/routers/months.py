from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CategoryLine, MonthlySummary, User
from app.security import current_user
from app.templating import templates

router = APIRouter()


def _ctx(user: User):
    d = user.email.split("@")[0]
    return {"user": user, "user_display": d, "user_initial": d[:1].upper()}


def _parse_money(raw: str | None) -> Decimal | None:
    if raw is None:
        return None
    cleaned = raw.strip().replace(",", "")
    if cleaned == "":
        return None
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return None
    return value if value >= 0 else None


@router.get("/months", response_class=HTMLResponse)
def list_months(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    summaries = db.execute(
        select(MonthlySummary).order_by(
            MonthlySummary.year.desc(), MonthlySummary.month.desc()
        )
    ).scalars().all()
    return templates.TemplateResponse(
        request,
        "months_list.html",
        {**_ctx(user), "summaries": summaries},
    )


@router.get("/months/new", response_class=HTMLResponse)
def new_month(request: Request, user: User | None = Depends(current_user)):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    today = date.today()
    return templates.TemplateResponse(
        request,
        "month_form.html",
        {
            **_ctx(user),
            "summary": None,
            "form": {"year": today.year, "month": today.month},
            "error": None,
        },
    )


@router.get("/months/{year}/{month}/edit", response_class=HTMLResponse)
def edit_month(
    year: int,
    month: int,
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    summary = db.execute(
        select(MonthlySummary).where(
            MonthlySummary.year == year, MonthlySummary.month == month
        )
    ).scalar_one_or_none()
    if summary is None:
        return RedirectResponse("/months/new", status_code=303)
    return templates.TemplateResponse(
        request,
        "month_form.html",
        {
            **_ctx(user),
            "summary": summary,
            "form": {
                "year": summary.year,
                "month": summary.month,
                "total_income": summary.total_income,
                "total_expense": summary.total_expense,
                "note": summary.note or "",
            },
            "error": None,
        },
    )


@router.post("/months")
async def upsert_month(
    request: Request,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)

    form = await request.form()

    def reject(message: str):
        return templates.TemplateResponse(
            request,
            "month_form.html",
            {
                **_ctx(user),
                "summary": None,
                "form": dict(form),
                "error": message,
            },
            status_code=400,
        )

    try:
        year = int(form.get("year", ""))
        month = int(form.get("month", ""))
    except ValueError:
        return reject("年和月必須是數字。")

    if not (2000 <= year <= 2100) or not (1 <= month <= 12):
        return reject("年須為 2000–2100，月須為 1–12。")

    income = _parse_money(form.get("total_income")) or Decimal(0)
    expense = _parse_money(form.get("total_expense")) or Decimal(0)

    names = form.getlist("cat_name")
    amounts = form.getlist("cat_amount")
    kinds = form.getlist("cat_kind")
    lines: list[CategoryLine] = []
    for i, name in enumerate(names):
        name = name.strip()
        if not name:
            continue
        amount = _parse_money(amounts[i] if i < len(amounts) else None)
        if amount is None:
            return reject(f"分類「{name}」需要有效的金額。")
        kind = kinds[i] if i < len(kinds) else "expense"
        if kind not in ("expense", "income"):
            kind = "expense"
        lines.append(CategoryLine(kind=kind, name=name, amount=amount))

    summary = db.execute(
        select(MonthlySummary).where(
            MonthlySummary.year == year, MonthlySummary.month == month
        )
    ).scalar_one_or_none()

    if summary is None:
        summary = MonthlySummary(year=year, month=month)
        db.add(summary)

    summary.total_income = income
    summary.total_expense = expense
    summary.note = (form.get("note") or "").strip() or None
    summary.lines = lines

    db.commit()
    return RedirectResponse("/months", status_code=303)


@router.post("/months/{year}/{month}/delete")
def delete_month(
    year: int,
    month: int,
    user: User | None = Depends(current_user),
    db: Session = Depends(get_db),
):
    if user is None:
        return RedirectResponse("/login", status_code=303)
    summary = db.execute(
        select(MonthlySummary).where(
            MonthlySummary.year == year, MonthlySummary.month == month
        )
    ).scalar_one_or_none()
    if summary is not None:
        db.delete(summary)
        db.commit()
    return RedirectResponse("/months", status_code=303)
