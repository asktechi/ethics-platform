# Ethics Platform

Personal teaching platform for CFA Institute ethics instruction (Levels I–III). The owner is the sole instructor-author. Students join live quizzes with an open link and a display name.

This repository is at **Phase 0**: app shell, brand theme, and project structure. Schema, auth, and seed data start in Phase 1.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

The default Next.js port is `3000`. In this environment the preview server uses a non-default port (see the preview card). Open `/` for the landing page, `/login` for the magic-link stub, and `/dashboard` for the instructor shell.

Health check: `GET /api/health` returns `{ "ok": true }`.

`npm` works the same way (`npm install`, `npm run dev`) if you prefer it over pnpm.

## Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local`. Phase 0 does not require keys — the shell loads without Supabase or OpenAI. Fill these in before Phase 1:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / cookie client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client |
| `OPENAI_API_KEY` | Server-side tagging and generation |
| `FLY_WORKER_URL` | PPTX → PDF worker (Phase 3) |
| `FLY_WORKER_SECRET` | Worker auth (Phase 3) |
| `UNSPLASH_ACCESS_KEY` | Curated concept image pools |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `FLY_WORKER_SECRET` to the client.

## Stack

Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion, dnd-kit, Supabase, OpenAI (server-only), Recharts. Web app deploys to Vercel; the conversion worker deploys to Fly.io.

## Phase roadmap

0. **Bootstrap** — repo, deps, theme, env, instructor shell *(this phase)*
1. **Data and auth** — Supabase schema, RLS, magic-link instructor auth, seed Levels I–III and Standards I–VII
2. **Navigation** — Level → Class → Section → Concept
3. **Materials** — immutable uploads, Fly worker, slide reorder
4. **Presentation** — dual view, teleprompter, dynamic theming
5. **Questions** — bank, AI tagging/generation, instructor approval, pools
6. **Live quiz** — Jeopardy-style session, realtime leaderboard
7. **Polish** — shortcuts, offline cache, PDF export, expand beyond CFA

Work phase by phase. Do not start the next phase until the instructor confirms.

Full locked decisions, brand, and data-model notes: [PLAN.md](PLAN.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
