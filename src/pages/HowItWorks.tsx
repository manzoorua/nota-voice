import * as React from "react";
import Link from '@/components/navigation/Link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Mic, Wand2, FileText, Download, ArrowRight } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      icon: Mic,
      title: "Click & Speak",
      description: "Simply click the microphone button and start speaking. No complicated setup required.",
      tip: "Speak naturally - our AI understands conversational speech perfectly."
    },
    {
      icon: Wand2,
      title: "AI Magic Happens",
      description: "Our advanced AI transcribes and polishes your speech, removing filler words and organizing ideas.",
      tip: "The AI automatically formats your thoughts into clear, readable text."
    },
    {
      icon: FileText,
      title: "Perfect Text Ready",
      description: "Get clean, well-structured notes instantly. No editing needed - just clear, professional text.",
      tip: "Your notes are automatically saved and organized for easy access."
    },
    {
      icon: Download,
      title: "Export & Share",
      description: "Download your notes, share them, or copy to clipboard. Your ideas, perfectly formatted.",
      tip: "Export as text files or share directly with colleagues and friends."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            How <span className="text-gradient">NotaVoice</span> Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Transform your voice into polished notes in four simple steps. 
            No technical knowledge required - just speak and watch the magic happen.
          </p>
          <Link to="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-lg font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gradient-primary text-primary-foreground hover:shadow-glow transition-bounce h-14 rounded-lg px-10">
            Try It Now - Free
          </Link>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {steps.map((step, index) => (
            <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute top-4 right-4 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground mb-4">{step.description}</p>
                <div className="bg-accent/50 rounded-lg p-3">
                  <p className="text-sm text-accent-foreground font-medium">💡 {step.tip}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Interactive Demo */}
        <div className="bg-gradient-hero rounded-2xl p-8 mb-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">See It In Action</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience the power of voice-to-text transformation. Click the button below to try our demo with sample audio.
            </p>
            <Link to="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-lg font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gradient-primary text-primary-foreground hover:shadow-glow transition-bounce h-14 rounded-lg px-10">
              Try Live Demo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Why Users Love NotaVoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">⚡ Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Get your transcribed notes in seconds, not minutes. Our AI processes speech faster than you can type.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">🎯 Accuracy That Matters</h3>
                <p className="text-muted-foreground">
                  Industry-leading accuracy that understands context, removes filler words, and formats properly.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-3">🌍 Works Everywhere</h3>
                <p className="text-muted-foreground">
                  Use it on any device, in any browser. Your notes sync across all your devices automatically.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Preview */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
          <p className="text-muted-foreground mb-6">
            Check out our comprehensive FAQ section for answers to common questions.
          </p>
          <Link to="/#faq" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
            View FAQ
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;