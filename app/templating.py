from decimal import Decimal
from pathlib import Path

from fastapi.templating import Jinja2Templates


def _round(n) -> int:
    return int(Decimal(str(n)).to_integral_value(rounding="ROUND_HALF_UP"))


def money(n) -> str:
    return "$" + f"{_round(n):,}"


def money_plain(n) -> str:
    return f"{_round(n):,}"


def compact(n) -> str:
    v = float(n)
    a = abs(v)
    if a >= 1_000_000:
        return f"${v / 1_000_000:.2f}M"
    if a >= 10_000:
        return f"${v / 1000:.0f}K"
    if a >= 1_000:
        return f"${v / 1000:.1f}K"
    return f"${v:.0f}"


templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
templates.env.filters["money"] = money
templates.env.filters["money_plain"] = money_plain
templates.env.filters["compact"] = compact
