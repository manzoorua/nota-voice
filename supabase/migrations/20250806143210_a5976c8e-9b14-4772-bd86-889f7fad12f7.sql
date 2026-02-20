-- Ensure voice_notes table exists with proper schema
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  transcription TEXT,
  enhanced_content TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'processing',
  audio_url TEXT,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'en',
  processing_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notes" ON public.voice_notes;
DROP POLICY IF EXISTS "Users can create their own notes" ON public.voice_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.voice_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.voice_notes;

-- Create policies for user access
CREATE POLICY "Users can view their own notes" 
ON public.voice_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" 
ON public.voice_notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
ON public.voice_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
ON public.voice_notes 
FOR DELETE 
USING (auth.uid() = user_id);