# PPTX converter worker

Fly.io worker (Node + LibreOffice headless) for PPTX → PDF conversion.

This folder is a placeholder. Implementation starts in Phase 3.

- Original uploads stay immutable in Supabase Storage.
- The worker converts copies only. It never overwrites an original.
- Called from the Next.js app with `FLY_WORKER_URL` and `FLY_WORKER_SECRET`.
