# Ethics Platform

Personal teaching platform for CFA Institute ethics instruction (Levels I–III). The owner is the sole instructor-author. Students join live quizzes with an open link and a display name.

This repository is at **Phase 7.5**: slides can use a curated pool image, an AI-generated background (OpenAI Images, cached in Supabase Storage), or the theme gradient. Generation is opt-in from Present setup. The Phase 7.4 audience stage (viewport fill, clamp type, host ↔ audience lock) is unchanged.

Never commit `.env.local`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_DB_URL`.

## Run locally

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

The default Next.js port is `3000`. In this environment the preview server uses a non-default port (see the preview card). Open `/` for the landing page, `/login` for the magic-link instructor sign-in, and `/dashboard` for the class builder.

Health check: `GET /api/health` returns `{ "ok": true }`.  
Database check: `GET /api/health/db` returns `{ "ok": true, "tables": 31 }`.

## Present a class

From a class, open **Present**, review the reel, then **Start presentation**.

- Host (signed-in): `/class/{classId}/present/{runId}/host`
- Audience (open): `/present/{runId}/audience`
- Join QR: `/present/{runId}/audience/join`

Keyboard on the host: Space / → / PageDown next slide (skips leftover beats), ← / PageUp previous beat then previous slide, **B** next beat, **I** generate an AI image for the current slide, G jump grid, P teleprompter pause, F fullscreen, R rehearsal (does not broadcast), Cmd/Ctrl+E end. Voice input should call `dispatch({ type: "NEXT" })` from `lib/presentation/bus.ts`.

On Present setup, the **Slide visuals** card can generate backgrounds for slides without a curated pool photo (default off; ~$0.04 per 1536×1024 image, 100/class/day cap). The audience stage uses the generated image when present, then the pool image, then the gradient.

Typography fixtures (Phase 4.6): open `/dev/phase46`.  
Audience stage fixtures (Phase 7.4): open `/dev/phase74` (`?view=short|long|host`, `?aspect=16x9|21x9|4x3|9x16|3x2`, `?scroll=mid`, `?sync=debug`).

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

- **Upload questions** — `/class/{id}/questions/import`. Drop PPTX, DOCX, DOC, XLSX, XLS, CSV, TSV, TXT, MD, or PDF. The importer auto-detects the pattern, you review and edit every row, then **Confirm and import**. Nothing is written before confirm.
- **Prose grammar (DOCX / TXT / MD)** — start each item with `Q1.` (or `Question 1:` / `1.`), then the stem, then `A) B) C)` choices, then optional `Standard:`, `Answer:`, and `Explanation:` lines. Decorative separators (`===START===`, `=====`, `---`, page numbers) are ignored. AI-generated items are serialized through the same grammar before they are saved.
- Imports land as `approved=false`, untagged. Auto-tag proposes a Standard, optional Concept, and difficulty. Nothing goes live until you approve.
- **Generate new** — `/class/{id}/questions/generate` uses gpt-4o. Paste source text or pick approved slides. Drafts stay pending.
- **Approve** — check questions in the bank, then **Approve**. Live games only load approved items.
- **Add to pool** — the gold button stays visible. Check questions, pick an existing pool or create one. From `/class/{id}/questions/pools` you can also **Add from bank**.
- **Pools** — `/class/{id}/questions/pools` groups questions, shuffle-on-play, seconds per question, and a dry-run preview
- Soft-delete hides a question; **Show archived** restores it
- AI spend for the class is the footer total from `ai_usage_log`

Sample ethics CSV: [`fixtures/samples/questions-1.csv`](fixtures/samples/questions-1.csv).

Phase 6: from a pool, **Launch live quiz** → `/quiz/host/{sessionId}` (ready room, live dashboard, keyboard controls). Students play on `/quiz/play/{sessionId}`. On phones (< 768px) the question fills leftover height and scrolls if needed; the four answers stay pinned at the bottom. Desktop player layout is unchanged. Append `?layout=debug` to outline the header / question / answer zones.

Host keys: Space / → / PageDown next, ← / PageUp previous, **R** reveal, **P** pause, **E** end (confirm), **F** fullscreen, **G** leaderboard overlay.

Pacing (Phase 7.1): when the last expected player submits (or has been disconnected for 3s), the host auto-reveals within 500ms instead of waiting out the timer. The top bar shows `3 of 5 answered`, then `All answered — revealing…`. Rapid Fire and Adaptive are unchanged. Wizard **Rehearsal mode** (manual pacing, no auto-reveal) is separate from **Rehearse** (Phase 7.2 bots). Wizard Step 4 → **Pacing** exposes **Allow students to advance the question** (`allow_audience_advance`, default off). When ON, players get **Ready for next** after answering; if ≥51% press it, the host reveals (still does not skip the reveal step).

End screens: host summary, player final, session detail, Boss victory/defeat, and case-complete all have navy/gold return-home buttons. Players never see Dashboard.

## Rehearse a game (instructor)

Practice any of the six modes with simulated students before class. Rehearsal never writes Sessions, play counts, or `student_performance`.

1. Open a saved game → Overview.
2. Click **Rehearse** (outline button between Start Game and Schedule).
3. Choose 1 / 3 / 5 / 10 simulated students (default 3), bot behavior (Perfect / Mixed / Struggler / Random), fast-forward timers (on by default), and which questions to run.
4. Click **Start rehearsal**. The host dashboard shows a persistent amber banner: **REHEARSAL MODE — no data will be saved.**
5. Bots join automatically and answer after a delay. Watch the leaderboard and reveal.
6. Use **⏩ Speed: 1x → 4x** on the banner to speed timers, bot delays, and reveal pauses. **Add bot** (top-right of the participant list) adds a mixed-profile bot mid-session. **Skip →** advances without scoring.
7. **Restart** discards this rehearsal and opens a fresh one with the same settings.
8. **End rehearsal** → confirm. The instance is hard-deleted and you return to the game with the toast **Rehearsal complete — nothing was saved.**

Verify locally: `npm run test:phase72`.

Scoring: 100 base + time bonus (max 100) + 20 per consecutive correct after the first. Wrong or skipped = 0.

## Games library

Open **Games** in the sidebar (`/games`). Save a template once, then launch or schedule it without rebuilding the rules.

- **New Game** — 5-step wizard (basics, pool or filter, mode, rules, preview). All six modes are playable, including Boss Battle.
- **Cases** — `/class/{id}/cases` builds vignettes and attaches bank questions. Hidden in the sidebar when the class has 0 questions.
- A game cannot be saved or launched with 0 playable (approved) questions. Overview, wizard preview, and launch all call `resolveGameQuestions`.
- Troubleshoot a template at `/games/{id}/diagnose`.
- **Start Game** — creates a `game_instances` row with a frozen settings snapshot, then opens the existing host dashboard.
- **Rehearse** — outline button next to Start Game. Opens a practice session with simulated students (`is_rehearsal`). Nothing is written to Sessions, play counts, or student analytics. Click **End rehearsal** to hard-delete the instance.
- **Sessions** — `/sessions/{instanceId}` replays the snapshot (not the current template). Export CSV responses, CSV scores, or a PDF report.
- Players may enter an optional **student code** (`AX7-9K2`) on join. It is remembered in `localStorage` and linked to `student_profiles`.

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
| `NEXT_PUBLIC_QUIZ_TEST_PANEL` | Unused leftover from the Session A host stub |

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
5. **Questions** — bank, AI tagging/generation, instructor approval, pools
5.6. **Universal importer** — parse any common file, review table, confirm before DB *(this slice)*
6. **Live quiz** — join/play, host dashboard, Jeopardy scoring
6C. **Game library** — templates, instances, replay, student profiles *(this slice)*
6D. **Additional game modes** — Rapid Fire, Case Study, Team Battle, Adaptive, Boss Battle
6E. **Student analytics + CFA linkage**
7.1 **Quiz UX** — auto-reveal when all answered, audience advance, end-screen navigation
7.2 **Rehearsal mode** — practice any of the six games with bots before class; data is discarded
7.3 **Mobile player** — fill the phone stage; answers pinned; desktop unchanged
7. **Polish** — shortcuts, offline cache, expand beyond CFA

Work phase by phase. Do not start the next phase until the instructor confirms.

Full locked decisions, brand, and data-model notes: [PLAN.md](PLAN.md) and [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
