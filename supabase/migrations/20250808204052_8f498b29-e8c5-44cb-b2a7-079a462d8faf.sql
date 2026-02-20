
-- 1) Ensure authoritative voice_notes schema, RLS, trigger, and indexes

-- Create table if it doesn't exist (safe no-op if already present)
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  transcription TEXT,
  enhanced_content TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  language TEXT,
  processing_metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'processing',
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add any missing columns (idempotent)
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS enhanced_content TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make sure user_id and title are present and non-null (if column exists but allows nulls, we keep as-is to avoid breaking existing rows)
ALTER TABLE public.voice_notes
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- RLS
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create non-conflicting RLS policies (unique names to avoid collisions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'voice_notes' AND policyname = 'voice_notes_select_own_v2'
  ) THEN
    CREATE POLICY "voice_notes_select_own_v2"
      ON public.voice_notes FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'voice_notes' AND policyname = 'voice_notes_insert_own_v2'
  ) THEN
    CREATE POLICY "voice_notes_insert_own_v2"
      ON public.voice_notes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'voice_notes' AND policyname = 'voice_notes_update_own_v2'
  ) THEN
    CREATE POLICY "voice_notes_update_own_v2"
      ON public.voice_notes FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'voice_notes' AND policyname = 'voice_notes_delete_own_v2'
  ) THEN
    CREATE POLICY "voice_notes_delete_own_v2"
      ON public.voice_notes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_voice_notes_updated_at ON public.voice_notes;

CREATE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_voice_notes_updated_at();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id ON public.voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON public.voice_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON public.voice_notes(status);
CREATE INDEX IF NOT EXISTS idx_voice_notes_is_favorite_true ON public.voice_notes(is_favorite) WHERE is_favorite = true;

-- 2) One-time backfill from clean_voice_notes into voice_notes (if clean_voice_notes exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'clean_voice_notes'
  ) THEN
    INSERT INTO public.voice_notes (
      id,
      user_id,
      title,
      transcription,
      enhanced_content,
      audio_url,
      duration_seconds,
      tags,
      created_at,
      updated_at,
      status,
      content
    )
    SELECT
      cvn.id,
      cvn.user_id,
      cvn.title,
      cvn.transcription,
      cvn.enhanced_content,
      cvn.audio_url,
      cvn.duration_seconds,
      cvn.tags,
      COALESCE(cvn.created_at, now()),
      COALESCE(cvn.updated_at, now()),
      cvn.status::text,
      COALESCE(cvn.enhanced_content, cvn.transcription)
    FROM public.clean_voice_notes AS cvn
    ON CONFLICT (id) DO NOTHING;
  END IF;
END
$$;
