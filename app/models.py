from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

Money = Numeric(12, 2)

UNCATEGORIZED = "未分類"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MonthlySummary(Base):
    """One shared row per calendar month (共享帳本 is joint, not per-user)."""

    __tablename__ = "monthly_summaries"
    __table_args__ = (UniqueConstraint("year", "month", name="uq_year_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column()
    month: Mapped[int] = mapped_column()
    total_income: Mapped[Decimal] = mapped_column(Money, default=0)
    total_expense: Mapped[Decimal] = mapped_column(Money, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="TWD")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lines: Mapped[list["CategoryLine"]] = relationship(
        back_populates="summary",
        cascade="all, delete-orphan",
        order_by="CategoryLine.id",
    )

    @property
    def surplus(self) -> Decimal:
        return self.total_income - self.total_expense

    def _line_total(self, kind: str) -> Decimal:
        return sum(
            (line.amount for line in self.lines if line.kind == kind),
            Decimal(0),
        )

    def _breakdown(self, kind: str, total: Decimal) -> list[dict]:
        """Category lines for `kind`, plus a 未分類 row for whatever the
        lines don't cover. Skipping categories entirely just yields one
        all-未分類 row."""
        rows = [
            {"name": line.name, "amount": line.amount}
            for line in self.lines
            if line.kind == kind
        ]
        remainder = total - self._line_total(kind)
        if remainder > 0:
            rows.append({"name": UNCATEGORIZED, "amount": remainder})
        return rows

    @property
    def expense_breakdown(self) -> list[dict]:
        return self._breakdown("expense", self.total_expense)

    @property
    def income_breakdown(self) -> list[dict]:
        return self._breakdown("income", self.total_income)

    @property
    def expense_over_entered(self) -> bool:
        return self._line_total("expense") > self.total_expense

    @property
    def income_over_entered(self) -> bool:
        return self._line_total("income") > self.total_income


class CategoryLine(Base):
    """Optional per-category breakdown for a month (購物, 晚餐, …)."""

    __tablename__ = "category_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    summary_id: Mapped[int] = mapped_column(
        ForeignKey("monthly_summaries.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(10), default="expense")
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Money, default=0)

    summary: Mapped[MonthlySummary] = relationship(back_populates="lines")


GOAL_TIERS = ("短期", "中期", "長期")


class Goal(Base):
    """A shared savings goal (短期 / 中期 / 長期)."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    tier: Mapped[str] = mapped_column(String(4), default="短期")
    label: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    current_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def progress_pct(self) -> float:
        if self.target_amount <= 0:
            return 0.0
        return min(
            100.0, float(self.current_amount) / float(self.target_amount) * 100
        )

    @property
    def remaining(self) -> Decimal:
        return max(Decimal(0), self.target_amount - self.current_amount)


class InvestmentPlan(Base):
    """Single shared investment plan (one row, id=1)."""

    __tablename__ = "investment_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    starting_capital: Mapped[Decimal] = mapped_column(Money, default=0)
    monthly_contribution: Mapped[Decimal] = mapped_column(Money, default=0)
    target_amount: Mapped[Decimal] = mapped_column(Money, default=0)
    tw_stock_pct: Mapped[int] = mapped_column(default=30)
    us_stock_pct: Mapped[int] = mapped_column(default=40)
    bond_pct: Mapped[int] = mapped_column(default=30)
    tw_stock_return: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.06")
    )
    us_stock_return: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.07")
    )
    bond_return: Mapped[Decimal] = mapped_column(
        Numeric(5, 4), default=Decimal("0.03")
    )
    age: Mapped[int | None] = mapped_column(nullable=True)
    risk: Mapped[str] = mapped_column(String(12), default="moderate")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
