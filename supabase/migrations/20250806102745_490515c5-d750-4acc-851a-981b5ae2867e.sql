-- Fix voice_notes table structure to match expected schema
ALTER TABLE public.voice_notes 
ALTER COLUMN content DROP NOT NULL;

-- Add missing columns that might be expected by the app
ALTER TABLE public.voice_notes 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Update the status column constraint if needed
ALTER TABLE public.voice_notes 
DROP CONSTRAINT IF EXISTS voice_notes_status_check;

ALTER TABLE public.voice_notes 
ADD CONSTRAINT voice_notes_status_check 
CHECK (status IN ('processing', 'completed', 'failed'));

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_created 
ON public.voice_notes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_notes_status 
ON public.voice_notes(status);

CREATE INDEX IF NOT EXISTS idx_voice_notes_tags 
ON public.voice_notes USING GIN(tags);