-- Create voice_notes table for storing voice recordings and transcriptions
CREATE TABLE public.voice_notes (
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

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_voice_notes_updated_at
BEFORE UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for voice note webhooks
CREATE TRIGGER trigger_voice_note_webhooks_on_voice_notes
AFTER INSERT OR UPDATE ON public.voice_notes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_voice_note_webhooks();