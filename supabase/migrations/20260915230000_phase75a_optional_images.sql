-- Phase 7.5a: images are optional. Gradient is the default visual.
-- Stock photos live on the slide. AI images attach only after explicit "Use this image".

alter table public.slides
  add column if not exists stock_image_url text,
  add column if not exists stock_attribution text;

alter table public.slides
  alter column image_preference set default 'none';

comment on column public.slides.stock_image_url is
  'Per-slide Unsplash (or other stock) URL. Used only when image_preference = pool.';
comment on column public.slides.stock_attribution is
  'Photographer / source line for stock_image_url.';
