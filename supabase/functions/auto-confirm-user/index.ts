import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutoConfirmRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email } = await req.json() as AutoConfirmRequest;
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0] || realIp || "unknown";

    console.log("Auto-confirming user for development:", { email, ipAddress });

    // Check if this is a development/staging environment
    const origin = req.headers.get("origin") || "";
    const isDevelopment = origin.includes("localhost") || 
                         origin.includes("lovableproject.com") || 
                         origin.startsWith("http:");

    if (!isDevelopment) {
      return new Response(
        JSON.stringify({
          error: "Auto-confirm is only available in development environments",
          code: "NOT_DEVELOPMENT"
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          error: "Invalid email format",
          code: "INVALID_EMAIL_FORMAT"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get user by email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({
          error: "User not found",
          code: "USER_NOT_FOUND"
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if already confirmed
    if (userData.user.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          message: "User already confirmed",
          success: true,
          already_confirmed: true
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Auto-confirm the user (development only)
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      {
        email_confirm: true
      }
    );

    if (confirmError) {
      console.error("Failed to auto-confirm user:", confirmError);
      return new Response(
        JSON.stringify({
          error: "Failed to confirm user",
          code: "CONFIRMATION_FAILED"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log the auto-confirmation
    await supabase.rpc('log_security_event', {
      _event_type: 'development_auto_confirm',
      _severity: 'low',
      _details: {
        email: email,
        user_id: userData.user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        reason: 'development_environment_auto_confirm'
      },
      _user_id: userData.user.id,
      _ip_address: ipAddress,
      _user_agent: userAgent
    });

    console.log("User auto-confirmed successfully:", email);

    return new Response(
      JSON.stringify({
        message: "User confirmed successfully (development mode)",
        success: true,
        user_id: userData.user.id
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Unexpected error in auto-confirm:", error);
    
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        code: "UNEXPECTED_ERROR"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);