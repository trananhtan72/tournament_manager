# SPEC.md — Badminton Tournament Manager (v1)

## Overview

A web app for running badminton tournaments. An organizer creates a tournament with one or more
events, players register, the organizer generates draws, and scores are entered as matches finish.
Public visitors can view brackets, schedules, and results without logging in.

## Roles

| Role      | Can do                                                                 |
|-----------|------------------------------------------------------------------------|
| Public    | View tournaments, brackets, schedules, results (read-only, no login)   |
| Player    | Sign up, register/withdraw for events before the deadline, view own matches |
| Organizer | Everything: create tournaments/events, manage entries, seed, generate draws, enter scores, edit results |

The user who creates a tournament is its organizer. (v1: one organizer per tournament.)

## Core concepts & rules (badminton-specific)

- A **tournament** has a name, venue, dates, registration deadline, and one or more **events**. It can
  also have an "entries open" date (default: open straight away), a withdrawal deadline (default: the
  registration deadline; players can't withdraw after it) and a link to a regulations document.
- Event types: Men's Singles (MS), Women's Singles (WS), Men's Doubles (MD), Women's Doubles (WD), Mixed Doubles (XD).
- Doubles entries are **pairs**: a player registers and either names a partner (who must confirm) or
  registers as "needs partner" so the organizer can pair them.
- A player may enter multiple events but only once per event.
- **Registrations need organizer approval.** A player's self-registration (for doubles: once the partner
  has accepted) goes into a "Pending approval" list showing each player's name and email; the organizer
  approves it into the confirmed entries or rejects it. Only confirmed entries are drawn. Entries the
  organizer adds (quick add) or pairs from "needs partner" are confirmed directly.
- **Scoring**: best of 3 games, rally scoring to 21. A game must be won by 2 points, capped at 30
  (i.e. 30–29 is a valid final score). Validate all entered scores against these rules.
- **Game format is per event**: chosen from a dropdown when the event is created (and editable until
  results exist). Default is the BWF standard (best of 3 to 21); presets for 1 game to 21 and best of 3
  to 15; or Custom (1/3/5/7 games, 5–50 points). The win-by-2 rule and cap (target + 9) scale with the
  target. For pools + knockout, the pool stage and the knockout stage each have their own game format.
- Match result records game-by-game scores, winner, and optional status: completed / walkover / retired.
- Live point-by-point scoring: a organizer can start a game with option: start live game - One person is assigned as the head referee and provided with an interface to enter the match's live scores. Simultaneously, a link is generated to display the scores on a TV screen or a landscape-oriented iPad; the live score display updates automatically whenever the referee enters a new score.
## Draw formats (per event, chosen by organizer)

1. **Single elimination** — sizes 4–64; byes auto-assigned to top seeds when entries aren't a power of two.
2. **Round robin** — one group, everyone plays everyone; standings by match wins, then head-to-head,
   then game difference, then point difference.
3. **Pools + knockout** — entries split into pools of 3–5 (snake-seeded); top 1 or 2 per pool
   (organizer's choice) advance to a single-elimination stage.

**Seeding**: organizer manually assigns seeds 1–8 per event. Seeds are placed per standard convention
(1 and 2 in opposite halves; 3/4 drawn into the remaining quarters). Unseeded entries are placed randomly.
Draws are regenerable until the organizer "publishes" the draw; after publishing, only manual swaps
(with a warning) are allowed.

## Pages

- `/` — list of tournaments (upcoming / ongoing / past)
- `/t/[slug]` — tournament home, split into tabs (each its own page):
  - **Overview** (`/t/[slug]`): sign-up status (open / not open yet / closed), entries-open date, entry
    deadline, withdrawal deadline, start and end dates, number of events and entries, the register area
    (per-event registration), regulations link, organizer name, venue
  - **Events** (`/t/[slug]/events`): name, draws, entries
  - **Draws** (`/t/[slug]/draws`): draw, size, type, stage (e.g. Semifinals, Pool stage, Completed)
  - **Matches** (`/t/[slug]/matches`): every match of the published draws — timed ones grouped by
    day/court (v1: simple ordered list per day, courts optional), the rest under "Not yet scheduled";
    times are venue-local wall-clock times (no time-zone conversion)
  - **Players** (`/t/[slug]/players`): everyone with a confirmed entry, A–Z, with a quick search box
    (names only — emails are organizer-only)
- `/t/[slug]/[event]` — bracket or pool tables for that event, clickable matches showing scores
- `/dashboard` — player: my registrations, my matches (upcoming with time/court, then results)
- `/organizer/...` — organizer console: create/edit tournament, manage entries & partners, seed,
  generate/publish draws, enter scores, `/organizer/[slug]/schedule` to give each match a time and an
  optional court (must fall on a tournament day; a court needs a time)
- Auth pages: sign up / sign in (email + password for v1)

## Score entry flow

Organizer opens a match, enters per-game scores, submits → winner auto-computed, bracket advances
the winner (or standings recompute for round robin). Editable afterward with recomputation downstream.

## Non-functional

- Mobile-first: brackets must be usable on a phone (horizontal scroll for large brackets is fine)
- No page should require login for read-only viewing
- Reasonable empty/error states everywhere; no crashes on empty draws

## Out of scope for v1 (do NOT build)

- Payments/entry fees, email or push notifications, live point-by-point scoring,
  rankings across tournaments, multi-organizer permissions, court-level realtime scheduling,
  photo uploads, i18n.

## Milestones (build in this order)

1. Auth + data model + tournament/event CRUD (organizer console skeleton)
2. Player registration incl. doubles partner flow
3. Draw generation for single elimination + bracket view
4. Score entry + advancement
5. Round robin and pools+knockout
6. Public pages polish + schedule view
7. Live point-by-point scoring