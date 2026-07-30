# Telecaller Performance Tracking System

Manual call logging for teams working from keypad phones, with per-caller performance
tracking. Built so telephony integrations can be added later without reshaping the data model.

Stack: Next.js 16 (App Router, server actions), PostgreSQL, Prisma 7, Tailwind CSS 4,
Playwright for end-to-end tests.

## Getting started

```bash
npm install
cp .env.example .env          # set DATABASE_URL and SESSION_SECRET
npm run db:migrate            # create the schema
npm run db:seed               # demo admin, two telecallers, six customers
npm run dev
```

Seeded accounts (password `password123` for all):

| Role       | Email                 |
| ---------- | --------------------- |
| Admin      | `admin@example.com`   |
| Telecaller | `lakshmi@example.com` |
| Telecaller | `arjun@example.com`   |

`SESSION_SECRET` signs the session JWT — use a long random string in production.

## What works today

The first vertical slice is complete and covered by end-to-end tests:

- **Authentication** — email/password login, bcrypt hashes, signed httpOnly session
  cookie with an 8-hour timeout, and role-based routing (admins to `/admin`,
  telecallers to `/caller`; each is redirected away from the other's pages).
- **Customer management** — create, edit, search (name, phone, company, city), filter
  by status/priority/assigned caller, paginate, single and bulk assignment, tags, and
  CSV export that respects the active filters.
- **CSV import** — preview before importing, case-insensitive header matching,
  duplicate detection both within the file and against the database, and per-row error
  reporting. Duplicates are skipped, never overwritten.
- **Calling screen** — customer details, previous notes, previous call responses and
  follow-up history on one screen; Start/End call stamps the times and derives the
  duration so nothing is typed by hand; call status, response type, comments,
  follow-up date and priority are saved together, and the caller is advanced to the
  next customer. Skip passes over a customer without recording anything.
- **Call logging** — each saved call writes the call record, moves the customer's own
  status to match the outcome, and optionally creates a follow-up, all in one transaction.
- **Dashboards** — admin totals (callers, calls today/week/month, pending follow-ups,
  interested and closed leads, average duration, conversion rate, calls per caller,
  status distribution) and the telecaller's daily view (target, completed, remaining,
  next customer, follow-ups due today, recent activity, daily summary).
- **Activity log** — logins, logouts, customer creates and updates, assignment
  changes, CSV imports and call entries are all recorded.

### Queue order

The calling screen picks the next customer as: follow-ups that are due now first, then
by priority, then least recently contacted. A customer with a follow-up scheduled in
the future is held back until it is due, and a customer already called today does not
reappear the same day. Customers marked Not Interested, Closed or Invalid leave the
queue entirely.

## Not built yet

From the feature list, these are still to come: follow-up management screens (calendar
and missed/completed views), caller profiles with weekly/monthly trends, the reports
module (Excel and PDF export), leaderboard, notifications, settings, password reset,
and Excel (`.xlsx`) import — the importer currently accepts CSV only. The schema
already models the data these need.

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run test:e2e     # Playwright end-to-end tests (builds and starts on port 3210)
npm run db:migrate   # apply schema changes
npm run db:seed      # demo data
npm run db:studio    # browse the database
```

Note that `npm run test:e2e` writes to the database configured in `.env` — point it at
a scratch database rather than real data.
