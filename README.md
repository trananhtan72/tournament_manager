# tournament_manager

Badminton tournament management app. See [SPEC.md](./SPEC.md) for requirements and [CLAUDE.md](./CLAUDE.md) for stack/conventions.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (Neon) and AUTH_SECRET
npx prisma migrate dev
npm run dev
```
