from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal


def _q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def monthly_rate_from_annual(annual_rate: Decimal) -> Decimal:
    if annual_rate <= 0:
        return Decimal(0)
    return annual_rate / Decimal(12)


def required_monthly_savings(
    *,
    target_amount: Decimal,
    current_amount: Decimal,
    annual_rate: Decimal,
    months: int,
) -> Decimal:
    """PMT for a future-value goal using end-of-month contributions."""
    if months <= 0:
        return Decimal(0)
    if current_amount >= target_amount:
        return Decimal(0)

    remaining_target = max(Decimal(0), target_amount)
    principal = max(Decimal(0), current_amount)
    monthly_rate = monthly_rate_from_annual(max(Decimal(0), annual_rate))

    if monthly_rate == 0:
        return _q((remaining_target - principal) / Decimal(months))

    growth = (Decimal(1) + monthly_rate) ** months
    future_gap = remaining_target - (principal * growth)
    if future_gap <= 0:
        return Decimal("0.00")

    payment = future_gap * monthly_rate / (growth - Decimal(1))
    return _q(max(Decimal(0), payment))


@dataclass
class GoalAllocationInput:
    goal_id: int
    label: str
    priority: int
    target_amount: Decimal
    current_amount: Decimal
    target_date: date | None
    expected_annual_return: Decimal
    monthly_required: Decimal


@dataclass
class GoalAllocationResult:
    goal_id: int
    label: str
    suggested_amount: Decimal
    priority_score: Decimal
    urgency_score: Decimal
    shortfall_score: Decimal
    composite_score: Decimal


def allocate_monthly_budget(
    *, available_cash: Decimal, goals: list[GoalAllocationInput], today: date
) -> list[GoalAllocationResult]:
    """Allocate limited monthly cash to goals without overriding the long-term
    plan. Priority drives the ranking, urgency tightens deadlines, and
    shortfall keeps underfunded goals from drifting too far off track.
    """
    investable = max(Decimal(0), available_cash)
    active_goals = [
        goal
        for goal in goals
        if goal.monthly_required > 0 and goal.current_amount < goal.target_amount
    ]
    if investable == 0 or not active_goals:
        return []

    ranked: list[GoalAllocationResult] = []
    for goal in active_goals:
        months_left = 360
        if goal.target_date:
            months_left = max(
                1,
                (goal.target_date.year - today.year) * 12
                + (goal.target_date.month - today.month),
            )

        priority_score = Decimal(1) / Decimal(max(1, goal.priority + 1))
        urgency_score = min(Decimal(3), Decimal(24) / Decimal(months_left))
        shortfall_ratio = (
            max(Decimal(0), goal.target_amount - goal.current_amount)
            / max(Decimal(1), goal.target_amount)
        )
        shortfall_score = min(Decimal(1), shortfall_ratio)
        composite_score = (
            priority_score * Decimal("0.45")
            + urgency_score * Decimal("0.35")
            + shortfall_score * Decimal("0.20")
        )
        ranked.append(
            GoalAllocationResult(
                goal_id=goal.goal_id,
                label=goal.label,
                suggested_amount=Decimal(0),
                priority_score=priority_score,
                urgency_score=urgency_score,
                shortfall_score=shortfall_score,
                composite_score=composite_score,
            )
        )

    score_total = sum((goal.composite_score for goal in ranked), Decimal(0))
    remaining = investable
    for goal in ranked:
        if score_total == 0:
            break
        raw = investable * goal.composite_score / score_total
        capped = min(
            _q(raw),
            next(
                src.monthly_required
                for src in active_goals
                if src.goal_id == goal.goal_id
            ),
        )
        goal.suggested_amount = capped
        remaining -= capped

    if remaining > 0:
        for goal in sorted(ranked, key=lambda item: item.composite_score, reverse=True):
            source = next(src for src in active_goals if src.goal_id == goal.goal_id)
            room = max(Decimal(0), source.monthly_required - goal.suggested_amount)
            top_up = min(room, remaining)
            goal.suggested_amount = _q(goal.suggested_amount + top_up)
            remaining -= top_up
            if remaining <= 0:
                break

    return ranked
