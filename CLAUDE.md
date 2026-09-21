# CLAUDE.md

## Project

Badminton tournament management website. Organizers create tournaments, players register,
the app generates draws/brackets, and scores are entered live. See SPEC.md for full requirements.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS **v4** (CSS-first config via `@theme` in `app/globals.css` — do NOT create a `tailwind.config.js` unless a plugin requires it)
- PostgreSQL on Neon, accessed via Prisma
- Auth.js (NextAuth v5) for authentication
- Deployed on Vercel via GitHub (no long-lived server processes; use serverless-friendly patterns)

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (run this to verify changes compile)
- `npm run lint` — ESLint
- `npx prisma migrate dev` — create/apply DB migrations after schema changes
- `npx prisma studio` — inspect the database

## Conventions

- Server Components by default; add `"use client"` only where interactivity is needed
- All mutations go through Server Actions in `app/actions/` — no ad-hoc API routes unless needed for webhooks
- Database schema lives in `prisma/schema.prisma`; never write raw SQL migrations by hand
- Shared UI components in `components/`, one component per file, PascalCase filenames
- Tournament/draw logic (seeding, bracket generation, standings) lives in `lib/tournament/` as pure,
  unit-testable functions — keep it separate from React and from the DB layer
- Use Zod to validate all form input and Server Action arguments
- Environment variables: `DATABASE_URL`, `AUTH_SECRET` — read only via a typed `lib/env.ts`, never `process.env` scattered in code

## Verification

After any change: `npm run build` must pass. After schema changes: run the migration and confirm
`prisma generate` succeeds. For draw-generation logic, add/update unit tests in `lib/tournament/__tests__/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
