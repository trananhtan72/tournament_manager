# 🏸 Tournament Manager

A web app for running badminton tournaments end to end — organizers create a
tournament and its events, players register, draws are generated and seeded,
and scores are entered live, point by point, with a scoreboard screen for
the court. Everything is viewable by the public without an account.

Built with Next.js (App Router), Prisma, and PostgreSQL, deployed on Vercel.

## What you can do

The app is organized around five roles. Browsing needs no account at all;
organizer and admin access, unlike the rest, are granted rather than self-serve.

| Role | Can do |
|---|---|
| **Public** | Browse tournaments, brackets, schedules, and results — no sign-in needed |
| **Player** | Register for events (solo or with a doubles partner), withdraw before the deadline, track your own upcoming matches and results |
| **Referee** | Score the matches an organizer assigns you, from a phone or tablet |
| **Organizer**¹ | Create tournaments, manage entries and seeding, generate and publish draws, assign referees, enter and edit results |
| **Administrator** | Approve or revoke organizer access for any account |

¹ Creating a tournament requires organizer access, granted by an administrator.

### Highlights

- **Three draw formats** — single elimination, round robin, and pools + knockout — with standard seeding and auto-assigned byes.
- **Live, point-by-point scoring.** An organizer or referee taps out rallies on a phone; the score is derived from a full point log, not just typed in, so undo is always safe.
- **A scoreboard for the court.** Each court gets a public, chrome-less link — open it on a TV or a landscape iPad and it updates itself as points are scored, then shows the final score, then what's next.
- **Everyone sees it live.** No websockets, no server to keep running — public pages poll for updates, so a live match shows up everywhere (the draw, the schedule, the dashboard) within seconds.
- **Built for a phone.** Registration, refereeing, and live scoring are all designed court-side first; brackets scroll horizontally rather than break.

For the full feature spec — every page, every rule (scoring format, seeding, the doubles partner flow, etc.) — see [SPEC.md](./SPEC.md).

## Tech stack

- **[Next.js](https://nextjs.org)** (App Router) + TypeScript — Server Components by default, Server Actions for all mutations
- **Tailwind CSS v4** — CSS-first theme in `app/globals.css`
- **PostgreSQL** on **[Neon](https://neon.tech)**, via **[Prisma](https://www.prisma.io)**
- **[Auth.js](https://authjs.dev)** (NextAuth v5) — email + password
- **[Zod](https://zod.dev)** for input validation
- **[Vitest](https://vitest.dev)** for unit tests
- Deployed on **[Vercel](https://vercel.com)** — no long-lived server processes

## Getting started

**Prerequisites:** Node 22.x and a PostgreSQL database (a free [Neon](https://neon.tech) project works well).

```bash
git clone git@github.com:trananhtan72/tournament_manager.git
cd tournament_manager
npm install

cp .env.example .env
# then fill in .env:
#   DATABASE_URL   your Neon connection string (use the pooled one)
#   AUTH_SECRET    generate with: npx auth secret

npx prisma migrate dev
npm run dev
```

Open [localhost:3000](http://localhost:3000), sign up, and you're in as a
regular player. To explore the organizer console locally, sign up with the
administrator email configured in [`lib/roles.ts`](./lib/roles.ts) — that
account is always an administrator and can grant itself (or anyone else)
organizer access from `/admin`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build — run this to verify changes compile |
| `npm start` | Serve a production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit tests |
| `npx prisma migrate dev` | Create and apply a migration after a schema change |
| `npx prisma studio` | Browse the database in a GUI |

## Project structure

```
app/                 Pages and layouts (App Router), grouped by role/section
app/actions/         Server Actions — every mutation goes through here
components/          Shared UI components (one per file)
lib/                 Server-side helpers: auth, notifications, formatting, roles
lib/tournament/      Pure draw/scoring logic — seeding, brackets, standings,
                     live-scoring rules — unit-tested independently of React/DB
lib/*/__tests__/     Vitest unit tests
prisma/schema.prisma Database schema (see SPEC.md for the concepts it models)
```

See [CLAUDE.md](./CLAUDE.md) for the full set of coding conventions this
project follows.

## Status

This is a v1 feature set — built to the milestones in [SPEC.md](./SPEC.md).
Deliberately out of scope for now: payments/entry fees, email or push
notifications, cross-tournament rankings, multi-organizer permissions per
tournament, and internationalization.

## Learn more

- [SPEC.md](./SPEC.md) — full requirements: every page, role, and badminton-specific rule
- [CLAUDE.md](./CLAUDE.md) — stack details and coding conventions
