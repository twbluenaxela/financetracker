"""goals + investment plan

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tier", sa.String(length=4), nullable=False, server_default="短期"),
        sa.Column("label", sa.String(length=100), nullable=False),
        sa.Column("target_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("current_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "investment_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("starting_capital", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("monthly_contribution", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("target_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tw_stock_pct", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("us_stock_pct", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("bond_pct", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("tw_stock_return", sa.Numeric(5, 4), nullable=False, server_default="0.06"),
        sa.Column("us_stock_return", sa.Numeric(5, 4), nullable=False, server_default="0.07"),
        sa.Column("bond_return", sa.Numeric(5, 4), nullable=False, server_default="0.03"),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("risk", sa.String(length=12), nullable=False, server_default="moderate"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("investment_plans")
    op.drop_table("goals")
