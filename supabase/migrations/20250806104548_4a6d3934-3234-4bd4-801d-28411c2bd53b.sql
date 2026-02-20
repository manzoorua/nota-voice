-- Create voice_notes table for storing transcribed voice notes
CREATE TABLE public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT, -- Allow null initially as content is added after processing
  audio_url TEXT,
  audio_duration INTEGER, -- Duration in seconds
  transcription_status TEXT DEFAULT 'processing' CHECK (transcription_status IN ('processing', 'completed', 'failed')),
  language TEXT DEFAULT 'en',
  summary TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processing_metadata JSONB DEFAULT '{}',
  duration_seconds INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for voice_notes
CREATE POLICY "Users can view their own voice notes" 
ON public.voice_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own voice notes" 
ON public.voice_notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice notes" 
ON public.voice_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice notes" 
ON public.voice_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_created 
ON public.voice_notes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voice_notes_status 
ON public.voice_notes(status);

CREATE INDEX IF NOT EXISTS idx_voice_notes_tags 
ON public.voice_notes USING GIN(tags);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_voice_notes_updated_at
BEFORE UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();