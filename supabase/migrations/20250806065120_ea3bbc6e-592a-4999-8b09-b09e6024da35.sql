-- First, let's check what voice notes table structure we have
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'voice_notes' AND table_schema = 'public';