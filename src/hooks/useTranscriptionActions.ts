import { useCallback } from 'react';

interface UseTranscriptionActionsReturn {
  copyToClipboard: (text: string) => void;
  exportToFile: (text: string) => void;
}

export const useTranscriptionActions = (): UseTranscriptionActionsReturn => {
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const exportToFile = useCallback((text: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    copyToClipboard,
    exportToFile
  };
};