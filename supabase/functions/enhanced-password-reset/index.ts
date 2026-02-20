import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
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

    const { email, redirectTo } = await req.json() as PasswordResetRequest;
    const userAgent = req.headers.get("user-agent") || "";
    const forwardedFor = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const ipAddress = forwardedFor?.split(",")[0] || realIp || "unknown";

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      await supabase.rpc('log_password_reset_attempt', {
        user_email: email || 'invalid',
        user_ip: ipAddress,
        user_agent: userAgent,
        is_success: false,
        error_code: 'INVALID_EMAIL_FORMAT',
        error_message: 'Invalid email format provided'
      });

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

    // Check rate limiting
    const { data: rateLimitData, error: rateLimitError } = await supabase.rpc('check_password_reset_rate_limit', {
      user_email: email,
      user_ip: ipAddress
    });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      await supabase.rpc('log_password_reset_attempt', {
        user_email: email,
        user_ip: ipAddress,
        user_agent: userAgent,
        is_success: false,
        error_code: 'RATE_LIMIT_CHECK_ERROR',
        error_message: rateLimitError.message
      });

      return new Response(
        JSON.stringify({
          error: "Rate limit check failed",
          code: "RATE_LIMIT_CHECK_ERROR",
          message: "Unable to process request at this time. Please try again later."
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!rateLimitData.allowed) {
      const lockedUntil = new Date(rateLimitData.locked_until);
      const timeRemaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);

      await supabase.rpc('log_password_reset_attempt', {
        user_email: email,
        user_ip: ipAddress,
        user_agent: userAgent,
        is_success: false,
        error_code: 'RATE_LIMITED',
        error_message: `Rate limit exceeded. Locked until ${lockedUntil.toISOString()}`
      });

      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          code: "RATE_LIMITED",
          message: `Too many password reset attempts. Please wait ${timeRemaining} minutes before trying again.`,
          lockedUntil: rateLimitData.locked_until,
          attemptsRemaining: 0
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Attempt password reset
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${req.headers.get("origin")}/reset-password`
    });

    if (resetError) {
      let errorCode = "RESET_FAILED";
      let userMessage = "Failed to send password reset email. Please try again.";

      // Categorize specific errors
      if (resetError.message.includes("rate limit")) {
        errorCode = "SUPABASE_RATE_LIMITED";
        userMessage = "Too many requests. Please wait a few minutes before trying again.";
      } else if (resetError.message.includes("invalid") || resetError.message.includes("not found")) {
        errorCode = "EMAIL_NOT_FOUND";
        userMessage = "If this email is registered with us, you'll receive a reset link shortly.";
      } else if (resetError.message.includes("network") || resetError.message.includes("timeout")) {
        errorCode = "NETWORK_ERROR";
        userMessage = "Network error. Please check your connection and try again.";
      }

      await supabase.rpc('log_password_reset_attempt', {
        user_email: email,
        user_ip: ipAddress,
        user_agent: userAgent,
        is_success: false,
        error_code: errorCode,
        error_message: resetError.message
      });

      return new Response(
        JSON.stringify({
          error: userMessage,
          code: errorCode,
          message: userMessage,
          attemptsRemaining: rateLimitData.attempts_remaining - 1
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Log successful attempt
    await supabase.rpc('log_password_reset_attempt', {
      user_email: email,
      user_ip: ipAddress,
      user_agent: userAgent,
      is_success: true,
      error_code: null,
      error_message: null
    });

    return new Response(
      JSON.stringify({
        message: "If this email is registered with us, you'll receive a password reset link shortly.",
        success: true,
        attemptsRemaining: rateLimitData.attempts_remaining - 1
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Unexpected error in password reset:", error);
    
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