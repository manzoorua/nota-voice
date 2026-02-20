import React from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface VoiceRecorderHelpProps {
  showTooltip?: boolean;
  isAuthenticated?: boolean;
}

export const VoiceRecorderHelp: React.FC<VoiceRecorderHelpProps> = ({ 
  showTooltip = false,
  isAuthenticated = false 
}) => {
  const helpContent = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1 h-7">
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" side="bottom">
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">How to Record</h4>
          
          <div className="space-y-2">
            <h5 className="font-medium text-sm">Getting Started</h5>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Click the microphone button to start</li>
              <li>• Speak clearly into your device's microphone</li>
              <li>• Click the stop button when finished</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h5 className="font-medium text-sm">Browser Requirements</h5>
            <p className="text-sm text-muted-foreground">
              Works in Chrome, Firefox, Safari, and Edge. Microphone access required.
            </p>
          </div>
          
          <div className="space-y-2">
            <h5 className="font-medium text-sm">Audio Quality Tips</h5>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Speak in a quiet environment</li>
              <li>• Keep your device close to your mouth</li>
              <li>• Speak at a normal pace and volume</li>
            </ul>
          </div>
          
          {isAuthenticated && (
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Recording Modes</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <strong>New Note:</strong> Creates a new voice note</li>
                <li>• <strong>Append Mode:</strong> Adds to selected note</li>
                <li>• Toggle between modes using the switch</li>
              </ul>
            </div>
          )}
          
          <div className="space-y-2">
            <h5 className="font-medium text-sm">What Happens Next</h5>
            <p className="text-sm text-muted-foreground">
              Your audio is transcribed using AI and cleaned up automatically. The text appears {isAuthenticated ? 'in your notes' : 'below'} when ready.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (showTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {helpContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>Help</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return helpContent;
};