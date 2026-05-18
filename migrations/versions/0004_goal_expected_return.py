"""goal expected annual return

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "goals",
        sa.Column(
            "expected_annual_return",
            sa.Numeric(5, 4),
            nullable=False,
            server_default="0.05",
        ),
    )


def downgrade() -> None:
    op.drop_column("goals", "expected_annual_return")
