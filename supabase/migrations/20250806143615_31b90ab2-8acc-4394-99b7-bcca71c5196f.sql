-- Refresh the schema cache and ensure proper setup
NOTIFY pgrst, 'reload schema';

-- Create a trigger for updated_at on voice_notes
CREATE OR REPLACE TRIGGER update_voice_notes_updated_at
  BEFORE UPDATE ON public.voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();