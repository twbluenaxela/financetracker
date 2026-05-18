# Finance Tracker

A private finances app for two people: set short/medium/long-term goals,
analyze cash flow (imported from 快速記帳), and get a savings plan that
recomputes from your real numbers.

**Stack:** FastAPI + Jinja (server-rendered), Postgres (Neon, managed),
Alembic migrations, deployed on Fly.io.

---

## Status

- [x] Phase 1 — scaffold: app, Postgres, migrations, two-user auth, Fly config
- [x] Phase 2 — monthly-summary entry (income/expense + optional categories),
      manually keyed from 快速記帳 screenshots (CSV export is paywalled)
- [x] Phase 3 — dark dashboard (12-month cashflow chart, 支出分類, 近期月份),
      self-hosted fonts (no CDN)
- [x] Phase 4 — goals (短期 / 中期 / 長期) with auto-allocation from
      trailing-average surplus
- [x] Phase 5 — investment engine: adjustable 台股/美股/債券 portfolio,
      blended return, Bogleheads heuristic, compound projection (lump +
      periodic) matching the Mr. Market spreadsheet exactly
- [ ] Phase 6 — polish (interactive chart, monthly review, fine-tuning)

There is **no public signup**. The only accounts are the two you create
with `scripts/seed_users.py`.

---

## Local development

Requires Python 3.11 and Docker (for the local Postgres).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # then edit SESSION_SECRET
docker compose up -d db       # local Postgres on :5432

alembic upgrade head          # create tables
python -m scripts.seed_users you@example.com 'your-password'
python -m scripts.seed_users wife@example.com 'her-password'

uvicorn app.main:app --reload
```

Open http://localhost:8000 — you'll be sent to `/login`.

### Database migrations

After changing models in `app/models.py`:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

---

## Deploying to Fly.io with Neon

### 1. Create the Neon database (you do this once, in the browser)

1. Sign up at https://neon.tech and create a project.
2. Copy the connection string (looks like
   `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`).

Neon handles automated backups and **point-in-time restore** for you —
that is your data-safety story. No backup code lives in this repo.

### 2. Launch the Fly app

```bash
fly launch --no-deploy        # accept/edit the app name; keep fly.toml

fly secrets set \
  DATABASE_URL='postgresql://USER:PASSWORD@HOST/DB?sslmode=require' \
  SESSION_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"

fly deploy
```

`fly deploy` runs `alembic upgrade head` automatically (see `[deploy]`
in `fly.toml`) before the new version goes live.

### 3. Create the two accounts (once)

```bash
fly ssh console -C "python -m scripts.seed_users you@example.com 'pw'"
fly ssh console -C "python -m scripts.seed_users wife@example.com 'pw'"
```

---

## Data safety summary

- **Backups / restore:** handled by Neon (automated + point-in-time).
  Periodically test a restore — an untested backup is not a backup.
- **In transit:** HTTPS enforced by Fly (`force_https`); Neon requires
  TLS (`sslmode=require`).
- **Auth:** Argon2-hashed passwords, signed `Secure` session cookies,
  no public signup route.
- **Secrets:** `DATABASE_URL` and `SESSION_SECRET` live in `fly secrets`,
  never in git (`.env` is gitignored).
