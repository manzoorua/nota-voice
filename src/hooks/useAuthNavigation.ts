import { useAuth } from './useAuth';
import { 
  saveTranscriptionForLater, 
  getPendingTranscription, 
  clearPendingTranscription 
} from '@/utils/transcriptionPersistence';

// Safe auth hook for public routes
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (error) {
    // Return default state for public routes
    return {
      user: null,
      isPremium: false,
      isAdmin: false
    };
  }
};

export const useAuthNavigation = () => {
  const { user } = useSafeAuth();

  const navigateToSignup = (transcription?: string) => {
    // Save any current transcription before navigating
    if (transcription) {
      saveTranscriptionForLater(transcription);
    }
    
    window.location.href = '/signup';
  };

  const navigateToSignin = () => {
    window.location.href = '/signin';
  };

  const handleAuthenticatedTranscription = () => {
    // Check for pending transcription after authentication
    const pending = getPendingTranscription();
    if (pending && user) {
      // Process the transcription now that user is authenticated
      console.log('Processing pending transcription for authenticated user:', pending);
      clearPendingTranscription();
      return pending;
    }
    return null;
  };

  return {
    navigateToSignup,
    navigateToSignin,
    handleAuthenticatedTranscription,
    isAuthenticated: !!user
  };
};