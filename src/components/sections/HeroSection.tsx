import * as React from "react";
import { Button } from "@/components/ui/button";
import PublicVoiceRecorder from "@/components/ui/PublicVoiceRecorder";
import { TranscriptionDisplay } from "@/components/sections/TranscriptionDisplay";
import { Play, Zap, Users } from "lucide-react";
import heroImage from "@/assets/hero-microphone-blue.jpg";

// Safe auth hook for public routes
const useSafeAuth = () => {
  // For public routes, we don't need auth context
  return { user: null };
};

const HeroSection = () => {
  const [transcription, setTranscription] = React.useState<string>("");
  const { user } = useSafeAuth();

  return (
    <section className="relative py-12 sm:py-16 md:py-20 gradient-hero overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid" />
      
      <div className="container max-w-screen-xl mx-auto px-4 sm:px-6">
        <div className="grid gap-8 md:gap-12 lg:grid-cols-2 items-center">
          {/* Left Column - Content */}
          <div className="space-y-6 sm:space-y-8 text-center lg:text-left">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Zap className="mr-2 h-4 w-4" />
                AI-Powered Transcription
              </div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-gradient">Capture Ideas</span>{" "}
                at the Speed of Speech.
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Turn messy voice notes into polished, structured text in seconds. 
                Perfect for students, professionals, and content creators who think faster than they type.
              </p>
            </div>

            {/* Features */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-6 text-sm justify-center lg:justify-start">
              <div className="flex items-center text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-2" />
                No signup required to try
              </div>
              <div className="flex items-center text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-2" />
                Grammar correction included
              </div>
              <div className="flex items-center text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-2" />
                Multiple output styles
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button 
                variant="hero" 
                size="xl" 
                className="group w-full sm:w-auto"
                onClick={() => window.location.href = '/app'}
              >
                Start Recording Free
                <div className="ml-2 transition-transform group-hover:translate-x-1">
                  →
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                size="xl" 
                className="group w-full sm:w-auto"
                onClick={() => window.location.href = '/pricing'}
              >
                <Play className="mr-2 h-5 w-5" />
                View Pricing
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pt-4 justify-center lg:justify-start">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4" />
                <span>Join 50,000+ users</span>
              </div>
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Interactive Demo */}
          <div className="space-y-6 order-first lg:order-last">
            {/* Hero Image - Mobile First */}
            <div className="lg:hidden mb-6">
              <img 
                src={heroImage} 
                alt="AI Voice Transcription" 
                className="w-full h-auto rounded-xl shadow-md bg-primary/5 p-3 sm:p-4 max-w-sm mx-auto"
              />
            </div>
            
            <div className="w-full lg:max-w-xl mx-auto space-y-6">
              <PublicVoiceRecorder onTranscription={setTranscription} showHomePageHelp={true} />
              <TranscriptionDisplay 
                transcription={transcription}
                isUserLoggedIn={!!user}
              />
              {/* Hero Image - Desktop */}
              <div className="hidden lg:block">
                <img 
                  src={heroImage} 
                  alt="AI Voice Transcription" 
                  className="w-full h-auto rounded-xl shadow-md bg-primary/5 p-4"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;