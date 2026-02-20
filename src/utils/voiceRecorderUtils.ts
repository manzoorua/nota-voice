// Shared utilities for voice recording components

// Constants
export const MAX_RECORDING_TIME = 180; // 3 minutes for free tier

// Time formatting utility
export const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Audio format detection utilities
export const getSupportedMimeType = (): string => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mpeg',
    'audio/wav'
  ];
  
  const isSupported = (type: string) => 
    typeof MediaRecorder !== 'undefined' && 
    (MediaRecorder as any).isTypeSupported?.(type);
  
  for (const type of candidates) {
    if (isSupported(type)) return type;
  }
  
  // Fallback based on platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS ? 'audio/mp4' : 'audio/webm';
};

export const getExtFromMime = (type: string): string => {
  if (!type) return 'webm';
  if (type.includes('webm')) return 'webm';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('m4a') || type.includes('aac')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  return 'webm';
};

// Environment detection utilities
export const isIframe = (): boolean => 
  typeof window !== 'undefined' && window.top !== window.self;

export const isIOS = (): boolean => 
  /iPad|iPhone|iPod/.test(navigator.userAgent);

// Permission and compatibility checks
export const preflightChecks = async (): Promise<boolean> => {
  if (!window.isSecureContext) {
    return false;
  }
  
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    return false;
  }
  
  try {
    const anyNav: any = navigator as any;
    if (anyNav.permissions?.query) {
      const status = await anyNav.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'denied') {
        return false;
      }
    }
  } catch (_) {
    // ignore permission query errors
  }
  
  return true;
};