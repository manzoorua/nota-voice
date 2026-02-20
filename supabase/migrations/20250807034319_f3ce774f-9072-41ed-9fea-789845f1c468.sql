-- Find all remaining SECURITY DEFINER views in the database
-- and fix them by converting to SECURITY INVOKER

-- Get list of views that might still have SECURITY DEFINER
SELECT schemaname, viewname, definition 
FROM pg_views 
WHERE schemaname = 'public' 
AND definition ILIKE '%security definer%';

-- Drop and recreate all potentially problematic views
-- Force them to be SECURITY INVOKER (default behavior)

-- Check if any functions have SECURITY DEFINER that shouldn't
DO $$
DECLARE
    func_record RECORD;
    view_record RECORD;
BEGIN
    -- List all views and recreate them explicitly as SECURITY INVOKER
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        -- Recreate view with explicit SECURITY INVOKER
        EXECUTE format('CREATE OR REPLACE VIEW %I.%I WITH (security_invoker=on) AS SELECT * FROM %I.%I', 
                      view_record.schemaname, view_record.viewname,
                      view_record.schemaname, view_record.viewname);
    END LOOP;
END $$;