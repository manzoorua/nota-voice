-- Force PostgREST schema cache refresh by sending a notification
NOTIFY pgrst, 'reload schema';