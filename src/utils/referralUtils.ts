/**
 * Referral utility functions for tracking and managing referral codes
 * Minimal impact on main codebase with localStorage persistence
 */

const REFERRAL_CODE_KEY = 'pending_referral_code';
const REFERRAL_EXPIRY_KEY = 'referral_code_expiry';
const REFERRAL_CODE_EXPIRY_DAYS = 30; // Referral codes expire after 30 days

export interface ReferralInfo {
  code: string;
  timestamp: number;
  source?: string;
}

/**
 * Detect referral code from URL parameters and persist it
 * Should be called on app initialization
 */
export const detectAndStoreReferralCode = (): ReferralInfo | null => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref') || urlParams.get('referral');
    
    if (referralCode && isValidReferralCode(referralCode)) {
      const referralInfo: ReferralInfo = {
        code: referralCode.toUpperCase(),
        timestamp: Date.now(),
        source: urlParams.get('utm_source') || 'direct'
      };
      
      // Store in localStorage with expiry
      localStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify(referralInfo));
      localStorage.setItem(REFERRAL_EXPIRY_KEY, String(Date.now() + (REFERRAL_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)));
      
      console.log('Referral code detected and stored:', referralCode);
      return referralInfo;
    }
  } catch (error) {
    console.warn('Error detecting referral code:', error);
  }
  
  return null;
};

/**
 * Get stored referral code if it exists and hasn't expired
 */
export const getStoredReferralCode = (): ReferralInfo | null => {
  try {
    const expiry = localStorage.getItem(REFERRAL_EXPIRY_KEY);
    const now = Date.now();
    
    // Check if referral code has expired
    if (!expiry || now > parseInt(expiry)) {
      clearStoredReferralCode();
      return null;
    }
    
    const storedInfo = localStorage.getItem(REFERRAL_CODE_KEY);
    if (!storedInfo) return null;
    
    return JSON.parse(storedInfo) as ReferralInfo;
  } catch (error) {
    console.warn('Error getting stored referral code:', error);
    clearStoredReferralCode();
    return null;
  }
};

/**
 * Clear stored referral code (called after successful signup)
 */
export const clearStoredReferralCode = (): void => {
  try {
    localStorage.removeItem(REFERRAL_CODE_KEY);
    localStorage.removeItem(REFERRAL_EXPIRY_KEY);
  } catch (error) {
    console.warn('Error clearing referral code:', error);
  }
};

/**
 * Validate referral code format (8 characters, alphanumeric)
 */
export const isValidReferralCode = (code: string): boolean => {
  return /^[A-Z0-9]{8}$/.test(code.toUpperCase());
};

/**
 * Generate referral tracking URL
 */
export const generateReferralUrl = (referralCode: string, baseUrl?: string): string => {
  const base = baseUrl || window.location.origin;
  return `${base}?ref=${referralCode}`;
};

/**
 * Track referral code usage (called after successful signup)
 */
export const trackReferralUsage = async (userId: string): Promise<boolean> => {
  try {
    const referralInfo = getStoredReferralCode();
    if (!referralInfo) {
      console.log('No referral code to track for user:', userId);
      return true; // No referral code is fine
    }
    
    console.log('Tracking referral usage:', { userId, referralCode: referralInfo.code });
    
    // Call the tracking edge function
    const { supabase } = await import('@/integrations/supabase/client');
    const { error } = await supabase.functions.invoke('track-referral', {
      body: {
        userId,
        referralCode: referralInfo.code
      }
    });
    
    if (error) {
      console.error('Failed to track referral:', error);
      return false;
    }
    
    // Clear the referral code after successful tracking
    clearStoredReferralCode();
    console.log('Referral tracked successfully');
    return true;
    
  } catch (error) {
    console.error('Error tracking referral usage:', error);
    return false;
  }
};