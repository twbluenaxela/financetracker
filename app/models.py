from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
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
