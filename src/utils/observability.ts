
import { supabase } from "@/integrations/supabase/client";

export type EdgeFunctionCheckResult = {
  name: string;
  ms: number;
  ok: boolean;
  error?: string;
};

/**
 * Measure an Edge Function round-trip time using supabase.functions.invoke.
 * We consider network reachability "ok" if we got any response (data or structured error),
 * and only mark it false when we hit a transport-level failure.
 */
export async function measureEdgeFunction(
  name: string,
  body: Record<string, any> = {}
): Promise<EdgeFunctionCheckResult> {
  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    const ms = Math.round(performance.now() - start);
    // If we got a structured response (even with error), connectivity is OK.
    if (error) {
      return { name, ms, ok: true, error: error.message };
    }
    return { name, ms, ok: true };
  } catch (e: any) {
    const ms = Math.round(performance.now() - start);
    return {
      name,
      ms,
      ok: false,
      error: e?.message || "Unknown network error",
    };
  }
}
