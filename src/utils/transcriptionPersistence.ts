export interface PendingTranscription {
  content: string;
  timestamp: number;
  sessionId: string;
}

const TRANSCRIPTION_KEY = 'pending_transcription';
const TRANSCRIPTION_EXPIRY_HOURS = 24;

export const saveTranscriptionForLater = (transcription: string): void => {
  const data: PendingTranscription = {
    content: transcription,
    timestamp: Date.now(),
    sessionId: Math.random().toString(36).substring(2, 15)
  };
  
  localStorage.setItem(TRANSCRIPTION_KEY, JSON.stringify(data));
};

export const getPendingTranscription = (): PendingTranscription | null => {
  try {
    const stored = localStorage.getItem(TRANSCRIPTION_KEY);
    if (!stored) return null;
    
    const data: PendingTranscription = JSON.parse(stored);
    
    // Check if expired (24 hours)
    const hoursElapsed = (Date.now() - data.timestamp) / (1000 * 60 * 60);
    if (hoursElapsed > TRANSCRIPTION_EXPIRY_HOURS) {
      clearPendingTranscription();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error retrieving pending transcription:', error);
    clearPendingTranscription();
    return null;
  }
};

export const clearPendingTranscription = (): void => {
  localStorage.removeItem(TRANSCRIPTION_KEY);
};

export const hasPendingTranscription = (): boolean => {
  return getPendingTranscription() !== null;
};