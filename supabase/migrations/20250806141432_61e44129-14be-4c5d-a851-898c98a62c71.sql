-- Ensure voice_notes table exists with correct structure
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  transcription TEXT,
  enhanced_content TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  audio_url TEXT,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'en',
  processing_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for voice_notes (will skip if they exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_notes' AND policyname = 'Users can view their own voice notes'
  ) THEN
    CREATE POLICY "Users can view their own voice notes" 
    ON public.voice_notes 
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_notes' AND policyname = 'Users can create their own voice notes'
  ) THEN
    CREATE POLICY "Users can create their own voice notes" 
    ON public.voice_notes 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_notes' AND policyname = 'Users can update their own voice notes'
  ) THEN
    CREATE POLICY "Users can update their own voice notes" 
    ON public.voice_notes 
    FOR UPDATE 
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_notes' AND policyname = 'Users can delete their own voice notes'
  ) THEN
    CREATE POLICY "Users can delete their own voice notes" 
    ON public.voice_notes 
    FOR DELETE 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add table to realtime publication
DO $$
BEGIN
  -- Add to publication if not already added
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'voice_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_notes;
  END IF;
END $$;