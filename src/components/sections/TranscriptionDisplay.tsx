import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { useTranscriptionActions } from "@/hooks/useTranscriptionActions";

interface TranscriptionDisplayProps {
  transcription: string;
  isUserLoggedIn: boolean;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  transcription,
  isUserLoggedIn
}) => {
  const { copyToClipboard, exportToFile } = useTranscriptionActions();

  if (!transcription) return null;

  return (
    <Card className="p-4 sm:p-6 animate-fade-in">
      <h3 className="font-semibold mb-3 text-foreground">
        Your Transcription:
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        {transcription}
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => copyToClipboard(transcription)}
          >
            Copy Text
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => exportToFile(transcription)}
          >
            Export
          </Button>
        </div>
        {!isUserLoggedIn && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground text-center">
              Sign up to save notes, unlock unlimited recording time, and access premium features
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};