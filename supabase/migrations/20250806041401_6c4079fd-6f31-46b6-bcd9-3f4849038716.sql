-- Create voice notes table
CREATE TABLE IF NOT EXISTS public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audio_url TEXT,
  audio_duration INTEGER DEFAULT 0,
  transcription_status TEXT DEFAULT 'completed' CHECK (transcription_status IN ('processing', 'completed', 'failed')),
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for voice notes
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for voice notes
CREATE POLICY "Users can view their own notes"
  ON public.voice_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes"
  ON public.voice_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.voice_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.voice_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Create usage analytics table
CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('note_created', 'note_transcribed', 'note_exported', 'note_shared')),
  note_id UUID REFERENCES public.voice_notes(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for analytics
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy for analytics
CREATE POLICY "Users can view their own analytics"
  ON public.usage_analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert analytics"
  ON public.usage_analytics FOR INSERT
  WITH CHECK (true);

-- Create trigger for voice notes updated_at
CREATE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();