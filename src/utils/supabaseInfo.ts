
/**
 * Centralized Supabase project info for diagnostics and links.
 * Note: These values mirror the configured Supabase client settings.
 */
export const SUPABASE_PROJECT_URL = "https://ihnvrzwjxexdminrqivs.supabase.co";
export const SUPABASE_PROJECT_ID = "ihnvrzwjxexdminrqivs";

/** Build a Supabase Dashboard link to Edge Function logs */
export const functionLogsUrl = (functionName: string) =>
  `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/${functionName}/logs`;

/** Useful dashboard links */
export const dashboardLinks = {
  authProviders: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/auth/providers`,
  edgeFunctions: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions`,
  functionsSecrets: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/settings/functions`,
};
