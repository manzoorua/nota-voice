-- Create voice_notes table for storing voice recordings and transcriptions
CREATE TABLE public.voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Voice Note',
  transcription TEXT,
  enhanced_content TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  audio_url TEXT,
  duration_seconds INTEGER,
  language TEXT DEFAULT 'en',
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for voice_notes
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

-- Create user_settings table for storing user preferences
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  output_language TEXT DEFAULT 'en',
  default_ai_style TEXT DEFAULT 'clean',
  auto_enhance BOOLEAN DEFAULT true,
  voice_preference TEXT DEFAULT 'alloy',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" 
ON public.user_settings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();