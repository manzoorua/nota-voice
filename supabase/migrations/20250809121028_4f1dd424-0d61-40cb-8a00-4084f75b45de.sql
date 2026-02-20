-- Create orders and user_passes tables for one-time Pass purchases
-- and an RPC to check pass status

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stripe_session_id TEXT UNIQUE,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Users can view their own orders'
  ) THEN
    CREATE POLICY "Users can view their own orders"
    ON public.orders
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Users can insert their own orders'
  ) THEN
    CREATE POLICY "Users can insert their own orders"
    ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Users can update their own orders'
  ) THEN
    CREATE POLICY "Users can update their own orders"
    ON public.orders
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update trigger for orders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at'
  ) THEN
    CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- User passes table
CREATE TABLE IF NOT EXISTS public.user_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  source TEXT,
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_passes_user_expires ON public.user_passes (user_id, expires_at DESC);

ALTER TABLE public.user_passes ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_passes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_passes' AND policyname = 'Users can view their own passes'
  ) THEN
    CREATE POLICY "Users can view their own passes"
    ON public.user_passes
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_passes' AND policyname = 'Users can insert their own passes'
  ) THEN
    CREATE POLICY "Users can insert their own passes"
    ON public.user_passes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_passes' AND policyname = 'Users can update their own passes'
  ) THEN
    CREATE POLICY "Users can update their own passes"
    ON public.user_passes
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Update trigger for user_passes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_passes_updated_at'
  ) THEN
    CREATE TRIGGER update_user_passes_updated_at
    BEFORE UPDATE ON public.user_passes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RPC to check if user has an active pass
CREATE OR REPLACE FUNCTION public.check_pass_active(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  latest_expires_at TIMESTAMPTZ;
  latest_status TEXT;
BEGIN
  SELECT expires_at, status
  INTO latest_expires_at, latest_status
  FROM public.user_passes
  WHERE user_id = _user_id
  ORDER BY expires_at DESC
  LIMIT 1;

  IF latest_expires_at IS NULL THEN
    RETURN jsonb_build_object('active', false, 'expires_at', NULL);
  END IF;

  RETURN jsonb_build_object(
    'active', (latest_expires_at > now() AND COALESCE(latest_status, 'active') = 'active'),
    'expires_at', latest_expires_at
  );
END;
$$;