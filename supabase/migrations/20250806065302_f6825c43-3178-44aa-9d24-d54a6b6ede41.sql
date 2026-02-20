-- Enhance voice_notes table with AI processing fields
ALTER TABLE voice_notes 
ADD COLUMN IF NOT EXISTS processing_time_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS ai_processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS raw_transcript TEXT,
ADD COLUMN IF NOT EXISTS ai_style TEXT DEFAULT 'clean',
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Create user_settings table for preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_language TEXT DEFAULT 'en',
  default_ai_style TEXT DEFAULT 'clean',
  dark_mode_preference BOOLEAN DEFAULT false,
  auto_transcribe BOOLEAN DEFAULT true,
  auto_enhance BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own settings
CREATE POLICY "Users can manage their own settings" ON user_settings
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create system_configuration table for admin settings
CREATE TABLE IF NOT EXISTS system_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_api_key_encrypted TEXT,
  default_ai_model TEXT DEFAULT 'gpt-4o-mini',
  n8n_webhook_url TEXT,
  max_audio_duration_seconds INTEGER DEFAULT 300,
  max_monthly_notes_free INTEGER DEFAULT 10,
  max_monthly_notes_premium INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on system_configuration
ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;

-- Only system admins can manage system configuration
CREATE POLICY "System admins can manage configuration" ON system_configuration
FOR ALL USING (is_admin(auth.uid(), 'system_admin'::admin_role))
WITH CHECK (is_admin(auth.uid(), 'system_admin'::admin_role));

-- Create audio storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-notes', 'voice-notes', false, 52428800, ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/m4a'])
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for voice notes
CREATE POLICY "Users can upload their own voice notes" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'voice-notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own voice notes" ON storage.objects
FOR SELECT USING (
  bucket_id = 'voice-notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own voice notes" ON storage.objects
FOR DELETE USING (
  bucket_id = 'voice-notes' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configuration_updated_at
  BEFORE UPDATE ON system_configuration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id_created_at ON voice_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_tags_gin ON voice_notes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_voice_notes_ai_processing_status ON voice_notes(ai_processing_status);
CREATE INDEX IF NOT EXISTS idx_voice_notes_content_search ON voice_notes USING gin(to_tsvector('english', content));

-- Insert default system configuration
INSERT INTO system_configuration (default_ai_model, max_audio_duration_seconds, max_monthly_notes_free, max_monthly_notes_premium)
VALUES ('gpt-4o-mini', 300, 10, 1000)
ON CONFLICT DO NOTHING;