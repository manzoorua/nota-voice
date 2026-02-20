-- Force a complete schema cache reload by making a small schema change
ALTER TABLE public.voice_notes ALTER COLUMN content SET DEFAULT '';
ALTER TABLE public.voice_notes ALTER COLUMN content DROP DEFAULT;