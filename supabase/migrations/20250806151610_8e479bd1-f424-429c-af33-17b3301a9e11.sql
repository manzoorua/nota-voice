-- Create voice_notes table
CREATE TABLE public.voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  enhanced_content TEXT,
  raw_transcript TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'enhancing', 'completed', 'error')),
  language TEXT DEFAULT 'en',
  style TEXT DEFAULT 'clean',
  audio_duration INTEGER,
  processing_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_voice_notes_user_id ON public.voice_notes(user_id);
CREATE INDEX idx_voice_notes_created_at ON public.voice_notes(created_at DESC);
CREATE INDEX idx_voice_notes_status ON public.voice_notes(status);
CREATE INDEX idx_voice_notes_is_favorite ON public.voice_notes(is_favorite);

-- Enable Row Level Security
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_voice_notes_updated_at();