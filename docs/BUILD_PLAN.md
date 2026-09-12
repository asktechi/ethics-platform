# Ethics Platform — Build Plan (Cursor Context)

## Purpose
A personal teaching platform for CFA Institute ethics instruction (Levels 1–3
now; expandable later to military, police, fire, senators). Owner is the sole
instructor-author. Students join live quizzes via open link + display name.

## Locked Decisions
1. Original uploads are IMMUTABLE. Soft-delete with restore only. No hard deletes.
2. PPTX/PDF conversion runs on a Fly.io worker (LibreOffice headless).
3. Background images: curated pool per concept, approved & locked by instructor.
   System can regenerate the pool on demand (button: "Regenerate image pool").
   Never auto-swap images mid-class.
4. Auth: instructor = email magic link. Students = open link + display name only.
5. CFA content model: Introduction → Concepts → Standards 1–7 (Code + Standards).
   Seed all of these at bootstrap.
6. Presentation is Qualtrics/Cortix-style: one point per screen, next-next-next.
7. Dynamic theming: professional palettes + concept-matched images. Shuffle
   must never repeat the last 5 used per class. Instructor can lock a theme.
8. Voice-driven advancement is a v2 goal — architect the presenter view so
   voice can be added without refactor (event-driven advance bus).

## Stack
- Next.js 14 App Router + TypeScript
- Tailwind + shadcn/ui + Framer Motion + dnd-kit
- Supabase (Postgres, Storage, Auth, Realtime)
- Fly.io worker (Node + LibreOffice headless) for PPTX→PDF
- OpenAI API (server-side) for tagging, curation, question generation
- Unsplash/Pexels for concept images (pool is curated + locked, not live)
- Recharts for analytics
- Deploy: Vercel (web) + Fly.io (worker)

## Brand
- Deep navy #0B1B2B
- CFA blue #003A70
- Gold #C9A227
- Ivory #F5F1E8
- Charcoal #1C1C1C
- Professional, CFA-institute-grade. Never playful.

## Non-negotiables
- Originals preserved forever (soft-delete + restore UI).
- Every slide = ONE idea. No paragraph dumps.
- Presenter view and Audience view stay in lockstep (Realtime channel).
- AI proposes, instructor approves. Nothing AI-generated goes live unapproved.
- Full CFA Standards seeded: Introduction, Concepts, Standards 1–7.

## Phase Roadmap
- Phase 0: Bootstrap repo, deps, theme, env, layout
- Phase 1: Supabase schema, RLS, auth, seed Levels 1–3 + CFA Standards
- Phase 2: Level → Class → Section → Concept navigation
- Phase 3: Materials ingestion (immutable uploads, Fly worker, reorder UI)
- Phase 4: Presentation engine (dual view, teleprompter, dynamic theming)
- Phase 5: Question bank + AI tagging + AI generation + pools
- Phase 6: Live quiz (Jeopardy-style, realtime leaderboard)
- Phase 7: Polish (shortcuts, offline cache, PDF export, expand-beyond-CFA)

## Data Model (summary — full SQL in Phase 1)
users, levels, classes, sections, concepts, standards, concept_standards,
materials (immutable + version_of), slides (derived, reorderable),
themes, theme_assignments, image_pools (per concept, approved_at),
questions, question_pools, question_pool_items,
quiz_sessions, quiz_participants, quiz_responses.

## Cursor Working Rules
- Work phase by phase. Do not skip ahead.
- After each phase, stop and wait for instructor confirmation.
- Prefer server components for fetch, client for interactivity.
- All AI calls are server-side API routes. Never expose keys to client.
- Write tests for: file hashing, slide extraction, theme shuffle no-repeat,
  realtime sync, quiz scoring.
