-- Create referral configuration table
CREATE TABLE public.referral_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 25.00,
  friend_discount_percentage INTEGER NOT NULL DEFAULT 50,
  max_earnings_per_referral DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  max_total_earnings DECIMAL(10,2) NOT NULL DEFAULT 10000.00,
  payment_processing_day INTEGER NOT NULL DEFAULT 5,
  payment_processing_delay_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referral codes table
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_user_id)
);

-- Create referral earnings table
CREATE TABLE public.referral_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  referral_count INTEGER NOT NULL DEFAULT 0,
  last_payout_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_configuration
CREATE POLICY "Admins can manage referral configuration"
ON public.referral_configuration FOR ALL
TO authenticated
USING (is_admin(auth.uid()));

-- RLS Policies for referral_codes
CREATE POLICY "Users can view their own referral code"
ON public.referral_codes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code"
ON public.referral_codes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral code"
ON public.referral_codes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policies for referrals
CREATE POLICY "Users can view referrals they're involved in"
ON public.referrals FOR SELECT
TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "System can create referrals"
ON public.referrals FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can update referrals"
ON public.referrals FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for referral_earnings
CREATE POLICY "Users can view their own earnings"
ON public.referral_earnings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own earnings record"
ON public.referral_earnings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update earnings"
ON public.referral_earnings FOR UPDATE
TO authenticated
USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_referral_configuration_updated_at
  BEFORE UPDATE ON public.referral_configuration
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referral_earnings_updated_at
  BEFORE UPDATE ON public.referral_earnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default configuration
INSERT INTO public.referral_configuration (
  referral_bonus_amount,
  friend_discount_percentage,
  max_earnings_per_referral,
  max_total_earnings,
  payment_processing_day,
  payment_processing_delay_days,
  is_active
) VALUES (
  25.00,
  50,
  500.00,
  10000.00,
  5,
  7,
  true
);

-- Create helper function to get active referral configuration
CREATE OR REPLACE FUNCTION get_active_referral_configuration()
RETURNS TABLE (
  id UUID,
  referral_bonus_amount DECIMAL(10,2),
  friend_discount_percentage INTEGER,
  max_earnings_per_referral DECIMAL(10,2),
  max_total_earnings DECIMAL(10,2),
  payment_processing_day INTEGER,
  payment_processing_delay_days INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    rc.id, rc.referral_bonus_amount, rc.friend_discount_percentage, 
    rc.max_earnings_per_referral, rc.max_total_earnings,
    rc.payment_processing_day, rc.payment_processing_delay_days,
    rc.is_active, rc.created_at, rc.updated_at
  FROM public.referral_configuration rc
  WHERE rc.is_active = true
  ORDER BY rc.updated_at DESC
  LIMIT 1;
$$;