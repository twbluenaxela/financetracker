"""Create or update a user. Run once for you and once for your wife.

Usage:
    python -m scripts.seed_users <email> <password>

On Fly:
    fly ssh console -C "python -m scripts.seed_users you@example.com 'pw'"

There is intentionally no public signup route. Accounts only exist
because they were created here.
"""
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.security import hash_password


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 1

    email = argv[1].strip().lower()
    password = argv[2]

    with SessionLocal() as db:
        user = db.execute(
            select(User).where(User.email == email)
        ).scalar_one_or_none()

        if user is None:
            db.add(User(email=email, password_hash=hash_password(password)))
            action = "created"
        else:
            user.password_hash = hash_password(password)
            action = "updated"

        db.commit()

    print(f"User {email} {action}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
