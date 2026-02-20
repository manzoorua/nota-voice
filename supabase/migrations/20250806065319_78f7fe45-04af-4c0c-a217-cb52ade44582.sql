-- Insert default system configuration with correct column name
INSERT INTO system_configuration (default_ai_model, max_audio_duration_seconds, max_monthly_notes_free, max_monthly_notes_premium)
VALUES ('gpt-4o-mini', 300, 10, 1000)
ON CONFLICT DO NOTHING;