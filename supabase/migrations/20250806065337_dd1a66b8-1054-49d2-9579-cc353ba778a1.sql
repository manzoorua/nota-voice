-- Check system_configuration table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'system_configuration' AND table_schema = 'public';