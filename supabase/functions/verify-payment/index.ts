
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  try {
    if (!stripeSecret) {
      throw new Error("Stripe secret key not configured");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) throw new Error("Unauthorized");
    const user = userData.user;

    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) throw new Error("Missing session_id");

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    console.log("[verify-payment] retrieved session", session.id, session.payment_status, session.status);

    // Ensure the session belongs to this user
    if (session.client_reference_id && session.client_reference_id !== user.id) {
      throw new Error("Session does not belong to the authenticated user");
    }

    // Only activate if payment is completed/paid
    const paid = session.payment_status === "paid";
    if (!paid) {
      return new Response(JSON.stringify({ activePass: false, paymentStatus: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Avoid duplicate insert for the same session
    const { data: existing, error: existingErr } = await supabase
      .from("user_passes")
      .select("id, expires_at, status")
      .eq("stripe_session_id", session_id)
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.warn("[verify-payment] select existing error", existingErr);
    }

    if (existing) {
      const active = (existing.status === "active") && existing.expires_at && new Date(existing.expires_at) > new Date();
      return new Response(JSON.stringify({ activePass: active, expiresAt: existing.expires_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Compute 1-year expiration
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    // Insert new active pass for this user
    const { error: insertErr } = await supabase.from("user_passes").insert({
      user_id: user.id,
      purchased_at: new Date().toISOString(),
      expires_at: expires.toISOString(),
      status: "active",
      source: "stripe",
      stripe_session_id: session_id,
    });

    if (insertErr) {
      console.error("[verify-payment] insert error", insertErr);
      throw insertErr;
    }

    return new Response(JSON.stringify({ activePass: true, expiresAt: expires.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[verify-payment] error", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
