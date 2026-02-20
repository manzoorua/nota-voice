-- Create audio-uploads storage bucket for temporary file storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'audio-uploads', 
  'audio-uploads', 
  false, 
  104857600, -- 100MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/webm']
);

-- Create RLS policies for audio-uploads bucket (premium/admin only)
CREATE POLICY "Premium users can upload audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'audio-uploads' 
  AND auth.uid() IS NOT NULL 
  AND (
    EXISTS (
      SELECT 1 FROM public.user_passes 
      WHERE user_id = auth.uid() 
      AND expires_at > now() 
      AND status = 'active'
    )
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY "Premium users can read their own audio files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (
    EXISTS (
      SELECT 1 FROM public.user_passes 
      WHERE user_id = auth.uid() 
      AND expires_at > now() 
      AND status = 'active'
    )
    OR public.is_admin(auth.uid())
  )
);

CREATE POLICY "Premium users can delete their own audio files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'audio-uploads' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND (
    EXISTS (
      SELECT 1 FROM public.user_passes 
      WHERE user_id = auth.uid() 
      AND expires_at > now() 
      AND status = 'active'
    )
    OR public.is_admin(auth.uid())
  )
);

-- Add upload_source column to voice_notes table to distinguish between recordings and uploads
ALTER TABLE public.voice_notes 
ADD COLUMN upload_source TEXT DEFAULT 'recording' CHECK (upload_source IN ('recording', 'upload'));

-- Add uploaded_file_path column to track the original file path
ALTER TABLE public.voice_notes 
ADD COLUMN uploaded_file_path TEXT;