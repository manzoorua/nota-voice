import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendConfirmationRequest {
  email: string;
  redirectTo?: string;
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

    const { email, redirectTo } = await req.json() as ResendConfirmationRequest;
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0] || realIp || "unknown";

    console.log("Resending confirmation for:", { email, redirectTo, ipAddress });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({
          error: "Invalid email format",
          code: "INVALID_EMAIL_FORMAT",
          message: "Please enter a valid email address"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user exists and is unconfirmed
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (userError || !userData.user) {
      console.error("User lookup error:", userError);
      // Don't reveal if email exists for security
      return new Response(
        JSON.stringify({
          message: "If this email is registered and unconfirmed, you'll receive a confirmation link shortly.",
          success: true
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user is already confirmed
    if (userData.user.email_confirmed_at) {
      return new Response(
        JSON.stringify({
          message: "This email address is already confirmed. You can sign in now.",
          success: true,
          already_confirmed: true
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Simple rate limiting - check for recent confirmation emails
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentLogs, error: logError } = await supabase
      .from('password_reset_logs')
      .select('created_at')
      .eq('email', email)
      .eq('success', true)
      .gte('created_at', oneMinuteAgo)
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Please wait at least 1 minute between confirmation email requests",
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait a minute before trying again."
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Resend confirmation email using admin API
    const { error: resendError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: redirectTo || `${req.headers.get("origin")}/app`
      }
    });

    if (resendError) {
      console.error("Failed to resend confirmation:", resendError);
      
      let errorCode = "RESEND_FAILED";
      let userMessage = "Failed to resend confirmation email. Please try again.";

      if (resendError.message.includes("rate limit")) {
        errorCode = "RATE_LIMITED";
        userMessage = "Too many requests. Please wait a few minutes before trying again.";
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          code: errorCode,
          message: userMessage
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log successful resend (reuse password reset logs table)
    await supabase.rpc('log_password_reset_attempt', {
      user_email: email,
      user_ip: ipAddress,
      user_agent: userAgent,
      is_success: true,
      error_code: null,
      error_message: 'Confirmation email resent successfully'
    });

    console.log("Confirmation email resent successfully for:", email);

    return new Response(
      JSON.stringify({
        message: "Confirmation email sent! Please check your inbox and spam folder.",
        success: true
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Unexpected error in resend confirmation:", error);
    
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        code: "UNEXPECTED_ERROR",
        message: "Please try again later or contact support if the problem persists."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);