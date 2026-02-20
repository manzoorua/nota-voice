import * as React from 'react';
const { useState } = React;
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Smartphone, 
  Globe, 
  Download, 
  Zap, 
  Mic, 
  FileText,
  Share2,
  Settings,
  Cloud,
  Lock,
  X,
  ChevronRight,
  Play
} from 'lucide-react';
import { MobileNotification, useMobileInstallPrompt } from '@/components/ui/mobile-utils';

const MobileOptimizedFeatures = () => {
  const [activeFeature, setActiveFeature] = useState('recording');
  const { showInstallPrompt, handleInstall, handleDismiss } = useMobileInstallPrompt();

  const features = [
    {
      id: 'recording',
      icon: Mic,
      title: 'One-Tap Recording',
      description: 'Start recording with a single tap. Optimized for mobile microphones.',
      demo: (
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg p-6 text-center">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Mic className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Tap to start recording</p>
        </div>
      )
    },
    {
      id: 'instant',
      icon: Zap,
      title: 'Instant Results',
      description: 'Get transcribed notes in seconds, even on slower connections.',
      demo: (
        <div className="space-y-3">
          <div className="bg-muted rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span className="text-xs text-muted-foreground">Processing...</span>
            </div>
            <div className="space-y-1">
              <div className="h-2 bg-primary/20 rounded"></div>
              <div className="h-2 bg-primary/20 rounded w-3/4"></div>
            </div>
          </div>
          <div className="bg-accent rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Ready!</span>
            </div>
            <p className="text-xs">Your perfectly formatted note is ready to use.</p>
          </div>
        </div>
      )
    },
    {
      id: 'offline',
      icon: Cloud,
      title: 'Offline Ready',
      description: 'Record notes offline, sync when connected. Never lose an idea.',
      demo: (
        <div className="space-y-3">
          <Badge variant="secondary" className="w-full justify-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            Offline Mode
          </Badge>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">3</div>
            <div className="text-xs text-muted-foreground">Notes waiting to sync</div>
          </div>
        </div>
      )
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      {/* Mobile Install Prompt */}
      {showInstallPrompt && (
        <MobileNotification
          message="Install NotaVoice for the best mobile experience!"
          action={{ label: "Install", onClick: handleInstall }}
          onDismiss={handleDismiss}
          variant="info"
        />
      )}

      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">
            <Smartphone className="w-4 h-4 mr-2" />
            Mobile Optimized
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Perfect for <span className="text-gradient">Mobile</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Designed from the ground up for mobile devices. Fast, responsive, and works great on any screen size.
          </p>
        </div>

        {/* Mobile Feature Showcase */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeFeature} onValueChange={setActiveFeature} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {features.map((feature) => (
                <TabsTrigger key={feature.id} value={feature.id} className="flex items-center gap-2">
                  <feature.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{feature.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {features.map((feature) => (
              <TabsContent key={feature.id} value={feature.id} className="mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-2xl font-bold">{feature.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-lg mb-6">{feature.description}</p>
                    <Button variant="outline" className="group">
                      Try it now
                      <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                  <Card className="overflow-hidden">
                    <CardContent className="p-6">
                      {feature.demo}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Mobile Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">98%</div>
            <div className="text-sm text-muted-foreground">Mobile Users</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">2.1s</div>
            <div className="text-sm text-muted-foreground">Avg Load Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">4.9★</div>
            <div className="text-sm text-muted-foreground">Mobile Rating</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary mb-1">500MB</div>
            <div className="text-sm text-muted-foreground">Data Saved</div>
          </div>
        </div>

        {/* Mobile CTA */}
        <div className="text-center mt-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold mb-2">Get the Mobile Experience</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Access NotaVoice on any device, anywhere
              </p>
              <div className="space-y-2">
                <Button className="w-full" variant="hero">
                  <Globe className="w-4 h-4 mr-2" />
                  Open Web App
                </Button>
                <Button className="w-full" variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  Watch Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default MobileOptimizedFeatures;