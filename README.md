# Ethics Platform

Personal teaching platform for CFA Institute ethics instruction (Levels I–III). The owner is the sole instructor-author. Students join live quizzes with an open link and a display name.

This repository is at **Phase 5**: a full question bank with file import, AI tagging, AI generation, instructor approval, and question pools.

Never commit `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_DB_URL`.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

The default Next.js port is `3000`. In this environment the preview server uses a non-default port (see the preview card). Open `/` for the landing page, `/login` for the magic-link instructor sign-in, and `/dashboard` for the class builder.

Health check: `GET /api/health` returns `{ "ok": true }`.  
Database check: `GET /api/health/db` returns `{ "ok": true, "tables": 22 }`.

## Present a class

From a class, open **Present**, review the reel, then **Start presentation**.

- Host (signed-in): `/class/{classId}/present/{runId}/host`
- Audience (open): `/present/{runId}/audience`
- Join QR: `/present/{runId}/audience/join`

Keyboard on the host: Space / → / PageDown next slide (skips leftover beats), ← / PageUp previous beat then previous slide, **B** next beat, G jump grid, P teleprompter pause, F fullscreen, R rehearsal (does not broadcast), Cmd/Ctrl+E end. Voice input should call `dispatch({ type: "NEXT" })` from `lib/presentation/bus.ts`.

Typography fixtures (Phase 4.6): open `/dev/phase46`.

`npm` works the same way (`npm install`, `npm run dev`) if you prefer it over pnpm.

## Materials

Open a class and use the **Materials** tab, or go to `/class/{id}/materials`.

- Drag-and-drop `.txt`, `.md`, `.pdf`, `.docx`, `.csv`, or `.pptx`
- Originals are stored at `classes/{class_id}/originals/{sha256}.{ext}` and are never overwritten or hard-deleted
- Re-uploading the same bytes in the same class asks to create a new version (`version_of`) instead of silently duplicating
- Archive is a soft-delete (`deleted_at`) with restore
- Derived slides start as `draft`; **Approve all** marks them `approved`

Sample files for regression live in [`fixtures/samples`](fixtures/samples).

## Question bank

Open a class and use the **Questions** tab, or go to `/class/{id}/questions`.

- **Upload questions** — CSV, DOCX, PDF, PPTX, TXT. CSV headers: `stem`, `choice_a`–`d`, `answer`, `explanation` (also `question`, `correct_answer`, `rationale`)
- Imports land as `approved=false`, untagged. Auto-tag proposes a Standard, optional Concept, and difficulty. Nothing goes live until you approve.
- **Generate new** — `/class/{id}/questions/generate` uses gpt-4o. Paste source text or pick approved slides. Drafts stay pending.
- **Pools** — `/class/{id}/questions/pools` groups questions, shuffle-on-play, seconds per question, and a dry-run preview
- Soft-delete hides a question; **Show archived** restores it
- AI spend for the class is the footer total from `ai_usage_log`

Sample ethics CSV: [`fixtures/samples/questions-1.csv`](fixtures/samples/questions-1.csv).

Phase 6 (live quiz) will load a pool with table `question_pools` / `question_pool_items` and RPC `load_pool_questions(p_pool_id)`.

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
3. **Materials** — immutable uploads, parsers, slide reorder
3.5. **PPTX worker** — Fly.io LibreOffice high-fidelity conversion *(not started)*
4A. **Presentation foundations** — theme shuffle, image pools, setup screen
4B. **Presenter + audience** — dual view and realtime lockstep
4.5. **Teleprompter sync** — line-by-line audience reveal + background polish
4.6. **Audience mirror + typography** — one renderer, auto-scale, beat pagination
5. **Questions** — bank, AI tagging/generation, instructor approval, pools *(this phase)*
6. **Live quiz** — Jeopardy-style session, realtime leaderboard
7. **Polish** — shortcuts, offline cache, PDF export, expand beyond CFA

Work phase by phase. Do not start the next phase until the instructor confirms.

Full locked decisions, brand, and data-model notes: [PLAN.md](PLAN.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
