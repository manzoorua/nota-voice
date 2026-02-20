import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Brain, 
  FileText, 
  Globe, 
  Sparkles, 
  Clock,
  GraduationCap,
  Briefcase,
  PenTool 
} from "lucide-react";

const FeaturesSection = () => {
  const mainFeatures = [
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "Lightning Fast",
      description: "Get your transcription in under 60 seconds, no matter how long your recording."
    },
    {
      icon: <Brain className="h-8 w-8 text-primary" />,
      title: "AI Grammar Correction",
      description: "Automatically fixes grammar, punctuation, and sentence structure for professional results."
    },
    {
      icon: <FileText className="h-8 w-8 text-primary" />,
      title: "Multiple Output Styles",
      description: "Choose from emails, articles, lists, summaries, and more formatting options."
    },
    {
      icon: <Globe className="h-8 w-8 text-primary" />,
      title: "Multi-Language Support",
      description: "Transcribe in 50+ languages with accent recognition and dialect support."
    },
    {
      icon: <Sparkles className="h-8 w-8 text-primary" />,
      title: "Smart Summarization",
      description: "Automatically extract key points and create concise summaries from long recordings."
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "No Time Limits",
      description: "Record up to 15 minutes with Premium. Perfect for lectures, meetings, and interviews."
    }
  ];

  const audienceFeatures = [
    {
      icon: <GraduationCap className="h-6 w-6 text-primary" />,
      title: "For Students",
      description: "Turn lecture recordings into study notes, capture brainstorming sessions, and transcribe interviews.",
      benefits: ["Lecture transcription", "Study note generation", "Research interview notes"]
    },
    {
      icon: <Briefcase className="h-6 w-6 text-primary" />,
      title: "For Professionals", 
      description: "Transform meeting recordings into action items, draft emails from voice memos, and create reports.",
      benefits: ["Meeting summaries", "Email drafting", "Report creation"]
    },
    {
      icon: <PenTool className="h-6 w-6 text-primary" />,
      title: "For Creators",
      description: "Convert podcast ideas to scripts, transcribe interviews, and turn thoughts into blog posts.",
      benefits: ["Content ideation", "Script writing", "Blog post drafts"]
    }
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-accent/30">
      <div className="container max-w-screen-xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
            Powerful Features for Every Use Case
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            From simple voice memos to complex transcription tasks, AudioPen has the tools you need to work smarter.
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-16 sm:mb-20">
          {mainFeatures.map((feature, index) => (
            <Card key={index} className="p-4 sm:p-6 hover:shadow-md transition-smooth">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>

        {/* Audience-Specific Features */}
        <div className="space-y-8 sm:space-y-12">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
              Built for Your Workflow
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Tailored features for students, professionals, and content creators
            </p>
          </div>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {audienceFeatures.map((audience, index) => (
              <Card key={index} className="p-6 sm:p-8 gradient-card hover:shadow-lg transition-smooth">
                <div className="flex items-center mb-4">
                  {audience.icon}
                  <h4 className="text-lg sm:text-xl font-semibold ml-3">{audience.title}</h4>
                </div>
                <p className="text-muted-foreground mb-6">{audience.description}</p>
                <ul className="space-y-2">
                  {audience.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center text-sm">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12 sm:mt-16">
          <Button variant="hero" size="xl" className="w-full sm:w-auto">
            Try All Features Free
          </Button>
          <p className="text-sm text-muted-foreground mt-3 px-4">
            No credit card required • 10 free transcriptions
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;