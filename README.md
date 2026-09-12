# Ethics Platform

Personal teaching platform for CFA Institute ethics instruction (Levels I–III). The owner is the sole instructor-author. Students join live quizzes with an open link and a display name.

This repository is at **Phase 3**: immutable materials ingestion for `.txt`, `.md`, `.pdf`, `.docx`, `.csv`, and `.pptx` (JSZip text fallback). The Fly.io LibreOffice worker is deferred to Phase 3.5.

Never commit `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_DB_URL`.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

The default Next.js port is `3000`. In this environment the preview server uses a non-default port (see the preview card). Open `/` for the landing page, `/login` for the magic-link instructor sign-in, and `/dashboard` for the class builder.

Health check: `GET /api/health` returns `{ "ok": true }`.  
Database check: `GET /api/health/db` returns `{ "ok": true, "tables": 19 }`.

`npm` works the same way (`npm install`, `npm run dev`) if you prefer it over pnpm.

## Materials

Open a class and use the **Materials** tab, or go to `/class/{id}/materials`.

- Drag-and-drop `.txt`, `.md`, `.pdf`, `.docx`, `.csv`, or `.pptx`
- Originals are stored at `classes/{class_id}/originals/{sha256}.{ext}` and are never overwritten or hard-deleted
- Re-uploading the same bytes in the same class asks to create a new version (`version_of`) instead of silently duplicating
- Archive is a soft-delete (`deleted_at`) with restore
- Derived slides start as `draft`; **Approve all** marks them `approved`

Sample files for regression live in [`fixtures/samples`](fixtures/samples).

## Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / cookie client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin client |
| `SUPABASE_DB_URL` | Direct Postgres URI for CLI / seed |
| `SUPABASE_PROJECT_REF` | Cloud project ref |
| `OPENAI_API_KEY` | Server-side tagging and generation |
| `FLY_WORKER_URL` | PPTX → PDF worker (Phase 3.5) |
| `FLY_WORKER_SECRET` | Worker auth (Phase 3.5) |
| `UNSPLASH_ACCESS_KEY` | Curated concept image pools |

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, or `FLY_WORKER_SECRET` to the client.

## Stack

Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion, dnd-kit, Supabase, OpenAI (server-only), Recharts. Web app deploys to Vercel; the conversion worker deploys to Fly.io in Phase 3.5.

## Phase roadmap

0. **Bootstrap** — repo, deps, theme, env, instructor shell
1. **Data and auth** — Supabase schema, RLS, magic-link instructor auth, seed Levels I–III and Standards I–VII
2. **Navigation** — Level → Class → Section → Concept
3. **Materials** — immutable uploads, parsers, slide reorder *(this phase)*
3.5. **PPTX worker** — Fly.io LibreOffice high-fidelity conversion *(not started)*
4. **Presentation** — dual view, teleprompter, dynamic theming
5. **Questions** — bank, AI tagging/generation, instructor approval, pools
6. **Live quiz** — Jeopardy-style session, realtime leaderboard
7. **Polish** — shortcuts, offline cache, PDF export, expand beyond CFA

Work phase by phase. Do not start the next phase until the instructor confirms.

Full locked decisions, brand, and data-model notes: [PLAN.md](PLAN.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
