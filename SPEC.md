# SPEC.md — Badminton Tournament Manager (v1)

## Overview

A web app for running badminton tournaments. An organizer creates a tournament with one or more
events, players register, the organizer generates draws, and scores are entered as matches finish.
Public visitors can view brackets, schedules, and results without logging in.

## Roles

| Role          | Can do                                                                 |
|---------------|------------------------------------------------------------------------|
| Public        | View tournaments, brackets, schedules, results (read-only, no login)   |
| Player        | Sign up, register/withdraw for events before the deadline, view own matches |
| Referee       | Enter scores for the matches the organizer has assigned to them, from a phone or tablet |
| Organizer     | Once approved: create tournaments/events, manage entries, seed, generate draws, assign referees, enter scores, edit results |
| Administrator | Grants or revokes an account's ability to create tournaments, from an Admin page (`/admin`) |

The user who creates a tournament is its organizer. (v1: one organizer per tournament.)

**Creating a tournament requires organizer access, granted by the administrator.** Every account can
sign up, register for events, and referee, but the "Create a tournament" form only appears once an
administrator has approved the account (or it's the administrator's own). The tournament-manager
administrator is a fixed account (`tea@gmail.com`); an account with that email is always an administrator.
Granting/revoking access notifies the account. Revoking access doesn't touch tournaments already created.

## Core concepts & rules (badminton-specific)

- A **tournament** has a name, venue, dates, registration deadline, and one or more **events**. It can
  also have an "entries open" date (default: open straight away), a withdrawal deadline (default: the
  registration deadline; players can't withdraw after it) and a rich-text regulations document, written
  by the organizer in a popup editor and read by players in a popup.
- Event types: Men's Singles (MS), Women's Singles (WS), Men's Doubles (MD), Women's Doubles (WD), Mixed Doubles (XD).
- Doubles entries are **pairs**: a player registers and either names a partner (who must confirm) or
  registers as "needs partner" so the organizer can pair them.
- A player may enter multiple events but only once per event.
- **Registrations need organizer approval.** A player's self-registration (for doubles: once the partner
  has accepted) goes into a "Pending approval" list showing each player's name and email; the organizer
  approves it into the confirmed entries or rejects it. Only confirmed entries are drawn. Entries the
  organizer adds (quick add) or pairs from "needs partner" are confirmed directly. The organizer gets an
  in-app notification whenever a player registers (including "needs partner" and partner invites, and
  again when an invited partner accepts), linking to that event's entries page.
- **Scoring**: best of 3 games, rally scoring to 21. A game must be won by 2 points, capped at 30
  (i.e. 30–29 is a valid final score). Validate all entered scores against these rules.
- **Game format is per event**: chosen from a dropdown when the event is created (and editable until
  results exist). Default is the BWF standard (best of 3 to 21); presets for 1 game to 21 and best of 3
  to 15; or Custom (1/3/5/7 games, 5–50 points). The win-by-2 rule and cap (target + 9) scale with the
  target. For pools + knockout, the pool stage and the knockout stage each have their own game format.
- Match result records game-by-game scores, winner, and optional status: completed / walkover / retired.
  Every played result (completed or retired) also records **when the match started** — a venue-local
  wall-clock time, like scheduled times. Live scoring captures it automatically (from the organizer's
  device clock, correctable when confirming); manual entry has a required "Match started" field that
  defaults to the scheduled time, else the current time. A walkover was never played, so it has none.
- **Referees**: the organizer keeps a list of referees per tournament — existing accounts added by email —
  and can assign one to each match, picking from the list or typing an email (which adds that person). A
  referee can't be a player in the match they officiate. An assigned referee scores that match live or
  enters its result (a walkover or retirement too), but only until a result exists; only the organizer
  can change a saved result. Removing a referee, or reassigning the match, ends their access at once.
  Referees get an in-app notification when they're added, assigned, unassigned or removed.
- A tournament has a number of **courts** (default 12, up to 50), named "Court 1" … "Court N".
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
    (per-event registration), regulations (opens in a popup), organizer name, venue
  - **Events** (`/t/[slug]/events`): name, draws, entries
  - **Draws** (`/t/[slug]/draws`): draw, size, type, stage (e.g. Semifinals, Pool stage, Completed)
  - **Matches** (`/t/[slug]/matches`): every match of the published draws — timed ones grouped by
    day/court (v1: simple ordered list per day, courts optional), the rest under "Not yet scheduled";
    times are venue-local wall-clock times (no time-zone conversion)
  - **Players** (`/t/[slug]/players`): everyone with a confirmed entry, A–Z, with a quick search box
    (names only — emails are organizer-only)
- `/t/[slug]/[event]` — bracket or pool tables for that event, clickable matches showing scores
- `/t/[slug]/court/[n]` — a court's live scoreboard screen for a TV / iPad (see Live scoring)
- `/referee` and `/referee/matches/[matchId]` — a referee's own pages: the matches assigned to them,
  and the touch-friendly scoring screen for each (same live scorer as the organizer's). A "Referee"
  link appears in the menu for anyone on a referee list.
- `/dashboard` — player: my registrations, my matches (upcoming with time/court, then results)
- `/organizer/[slug]/...` — organizer console for one tournament, as tabs (each its own page):
  - **Overview**: totals (events, confirmed entries, pending approval), tournament details, the
    regulations (edited in a rich-text popup), delete tournament
  - **Events**: create/edit/delete events (name, draw format, game format)
  - **Manage entries**: one sub-tab per event — pending approval, confirmed entries (seeds), partner
    pairing, quick add; badges show what's waiting for approval
  - **Match center**: upcoming matches on the left half (enter results here, or score them live at
    `/organizer/[slug]/matches/[matchId]`), played matches on the right half (edit results); a link to
    the schedule page, where each match gets a time and an
    optional court (must fall on a tournament day; a court needs a time)
  - **Draws**: every event's draw — generate, publish, swap/move entries, knockout stage, print
  - **Referees**: the referee list — add by email, remove — with each referee's match counts; matches
    are assigned to referees from the Match center or the schedule page
- Auth pages: sign up / sign in (email + password for v1)

## Score entry flow

Organizer opens a match, enters per-game scores, submits → winner auto-computed, bracket advances
the winner (or standings recompute for round robin). Editable afterward with recomputation downstream.

### Live point-by-point scoring (milestone 7)

As an alternative to entering finished scores, the organizer can score a match live from the Match
center ("Score this match live") on a phone-friendly screen:

- The start screen has the **referee assignment** at the top (pick from the list or enter an email).
  Who serves first is the referee's call after the toss, so once a referee is assigned the organizer's
  start screen hands it over — "Waiting for {referee} to start the match" — and the referee picks the
  court and first server on their own device; the organizer can still "start it here on their behalf".
  With no referee assigned the organizer scores the match themselves and chooses. The court is a
  required dropdown of the tournament's courts (one live match per court); then tap the side that wins
  each rally. The score is never stored — every
  rally is a row in a point log and the state (games, current game, server, game point / match point)
  is replayed from it by pure, unit-tested rules for the event's game format (win by 2, cap, best of N).
  Undo removes the last rally. Taps update the screen instantly and are saved in the background; a
  second device or a lost connection is detected and the screen is resynced to the saved score.
- When the deciding rally is played the organizer confirms the result; that saves the games and winner
  and advances the bracket through the same code as manual entry. Walkovers/retirements are entered
  manually. Entering a result manually, or discarding, throws away an in-progress live score. Bracket
  swaps are refused while a match involved is live.
- Each court has a **scoreboard screen** for a TV or iPad at the court: `/t/[slug]/court/[n]`, public,
  chrome-less and high-contrast, sized for any TV or iPad. It's a two-row scoreboard — a row per player,
  a column per game: each finished game's score with the game's winner in bold, then the game in
  progress in light type with the score of the player who just won the rally (the server) enclosed in a
  green square (`Ann  21  19  [7]` / `Bob  19  21  4`),
  plus game/match point, then the final score for ten minutes, then the
  next scheduled match. It refreshes by itself every few seconds and asks the device to stay awake.
  The scorer and the Match center list each court's link (with a copy button).
- Everyone else sees it live: a "Live now" section on the Matches tab, a LIVE badge with the current
  game score and server on match cards (draw pages, dashboard), and a banner on the tournament
  Overview. Pages refresh by polling (about every 6 seconds while something is live) since the app
  runs serverless, without websockets.

## Non-functional

- Mobile-first: brackets must be usable on a phone (horizontal scroll for large brackets is fine)
- No page should require login for read-only viewing
- Reasonable empty/error states everywhere; no crashes on empty draws

## Out of scope for v1 (do NOT build)

- Payments/entry fees, email or push notifications,
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
