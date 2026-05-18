"""Compound-growth projection engine.

Mirrors the Mr. Market (市場先生) retirement spreadsheet exactly:

* Lump sum (單筆投資):   B0 = principal;            Bn = B(n-1) * (1+r)
* Periodic (定期投資):   B0 = 0;                    Bn = B(n-1) * (1+r) + C
  where C is the annual contribution (monthly * 12); the first year is
  the bare contribution (no growth applied yet).

Money is kept precise with Decimal and only rounded for display.
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

MAX_YEARS = 100


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


@dataclass
class YearRow:
    year: int
    contribution: Decimal  # money added that year (0 for lump sum after y0)
    balance: Decimal


def lump_sum_schedule(
    principal: Decimal, annual_rate: Decimal, years: int
) -> list[YearRow]:
    rows = [YearRow(0, _q(principal), _q(principal))]
    balance = principal
    for year in range(1, years + 1):
        balance = balance * (Decimal(1) + annual_rate)
        rows.append(YearRow(year, Decimal(0), _q(balance)))
    return rows


def periodic_schedule(
    annual_contribution: Decimal, annual_rate: Decimal, years: int
) -> list[YearRow]:
    rows = [YearRow(0, Decimal(0), Decimal(0))]
    balance = Decimal(0)
    for year in range(1, years + 1):
        balance = balance * (Decimal(1) + annual_rate) + annual_contribution
        rows.append(YearRow(year, _q(annual_contribution), _q(balance)))
    return rows


def years_to_target(
    target: Decimal,
    annual_rate: Decimal,
    *,
    principal: Decimal = Decimal(0),
    annual_contribution: Decimal = Decimal(0),
) -> int | None:
    """Smallest whole year where the balance first reaches `target`.
    None if it can't be reached within MAX_YEARS."""
    if target <= 0:
        return 0
    balance = principal
    if balance >= target:
        return 0
    for year in range(1, MAX_YEARS + 1):
        balance = balance * (Decimal(1) + annual_rate) + annual_contribution
        if balance >= target:
            return year
    return None


def blended_return(
    tw_stock_pct: Decimal,
    us_stock_pct: Decimal,
    bond_pct: Decimal,
    *,
    tw_stock_return: Decimal,
    us_stock_return: Decimal,
    bond_return: Decimal,
) -> Decimal:
    total = tw_stock_pct + us_stock_pct + bond_pct
    if total == 0:
        return Decimal(0)
    return (
        tw_stock_pct * tw_stock_return
        + us_stock_pct * us_stock_return
        + bond_pct * bond_return
    ) / total


@dataclass
class Recommendation:
    bond_pct: int
    tw_stock_pct: int
    us_stock_pct: int
    rationale: list[str]


def recommend_allocation(
    age: int, risk: str, horizon_years: int
) -> Recommendation:
    """Transparent Bogleheads-style heuristic. Educational, not advice.

    Bond anchor follows the classic "bonds ≈ your age", shifted by risk
    appetite, then nudged by how long the money has to compound. The
    equity slice is split between 美股 (broad global core) and 台股
    (home market) — global-tilted, since US equity dominates world
    market cap and adds diversification beyond Taiwan.
    """
    base_bond = age
    if risk == "aggressive":
        base_bond = age - 20
    elif risk == "moderate":
        base_bond = age - 10

    if horizon_years >= 20:
        base_bond -= 5
    elif horizon_years < 7:
        base_bond += 10

    bond = max(10, min(80, base_bond))
    equity = 100 - bond
    us = round(equity * 0.6)
    tw = equity - us

    rationale = [
        f"債券 {bond}%：以「債券比例 ≈ 年齡」為基準，依風險偏好（{risk}）"
        f"與投資年限（{horizon_years} 年）調整，作為波動緩衝。",
        f"美股 {us}%：全球股市以美股市值為主，作為核心提供分散度。",
        f"台股 {tw}%：本土市場（如 0050），熟悉且免匯率與複委託成本。",
        "Bogleheads 原則：低成本指數型 ETF、廣泛分散、長期持有、"
        "每年再平衡一次、忽略短期雜訊。",
    ]
    return Recommendation(bond, tw, us, rationale)
