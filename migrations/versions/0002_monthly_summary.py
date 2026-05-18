"""monthly summaries + category lines

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "monthly_summaries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column(
            "total_income",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "total_expense",
            sa.Numeric(12, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "currency", sa.String(length=3), nullable=False, server_default="TWD"
        ),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("year", "month", name="uq_year_month"),
    )
    op.create_table(
        "category_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "summary_id",
            sa.Integer(),
            sa.ForeignKey("monthly_summaries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kind", sa.String(length=10), nullable=False, server_default="expense"
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "amount", sa.Numeric(12, 2), nullable=False, server_default="0"
        ),
    )
    op.create_index(
        "ix_category_lines_summary_id", "category_lines", ["summary_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_category_lines_summary_id", table_name="category_lines")
    op.drop_table("category_lines")
    op.drop_table("monthly_summaries")
