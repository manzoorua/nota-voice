-- Add AI-specific columns to existing system_configuration table
ALTER TABLE system_configuration 
ADD COLUMN IF NOT EXISTS default_ai_model TEXT DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS max_audio_duration_seconds INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS max_monthly_notes_free INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_monthly_notes_premium INTEGER DEFAULT 1000;

-- Update the n8n_webhook_base_url column name to match our needs
UPDATE system_configuration 
SET n8n_webhook_base_url = 'https://your-n8n-instance.com/webhook'
WHERE n8n_webhook_base_url IS NULL;