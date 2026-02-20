-- Create voice_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on voice_notes
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for voice_notes
CREATE POLICY "Users can view their own voice notes" 
ON public.voice_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice notes" 
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

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_voice_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_notes_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id ON public.voice_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON public.voice_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_is_favorite ON public.voice_notes(is_favorite) WHERE is_favorite = true;