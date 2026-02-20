import * as React from "react";
import { Button } from '@/components/ui/button';
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

const FAQSection = () => {
  const [openItems, setOpenItems] = React.useState<{ [key: number]: boolean }>({});

  const faqs = [
    {
      question: "How accurate is the transcription?",
      answer: "AudioPen achieves 99.2% accuracy on average. Our AI technology combines advanced speech recognition with context-aware processing to ensure high-quality transcriptions, even with accents or background noise."
    },
    {
      question: "What file formats are supported?",
      answer: "AudioPen supports all major audio formats including MP3, WAV, M4A, and FLAC. You can also record directly in the app or upload existing audio files up to 100MB in size."
    },
    {
      question: "How long does processing take?",
      answer: "Most audio files are processed in real-time or faster. A 5-minute recording typically takes 30-60 seconds to transcribe and clean up, depending on audio quality and length."
    },
    {
      question: "Is my audio data secure?",
      answer: "Absolutely. All audio files are encrypted during upload and processing. We don't store your recordings permanently - they're automatically deleted after processing unless you explicitly save them to your account."
    },
    {
      question: "Can I edit the transcriptions?",
      answer: "Yes! AudioPen provides an intuitive editor where you can make corrections, add formatting, and refine your text. The AI learns from your edits to improve future transcriptions."
    },
    {
      question: "What languages are supported?",
      answer: "AudioPen supports over 50 languages including English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Chinese, Japanese, and many more. Language detection is automatic."
    },
    {
      question: "Do you offer team accounts?",
      answer: "Yes! We offer team plans with shared workspaces, collaboration features, and centralized billing. Contact our sales team for custom enterprise solutions with enhanced security and admin controls."
    },
    {
      question: "Can I integrate AudioPen with other tools?",
      answer: "AudioPen integrates with popular productivity tools like Notion, Google Docs, Slack, and Zapier. Our API also allows custom integrations for enterprise customers."
    },
    {
      question: "What's your refund policy?",
      answer: "We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied, contact support for a full refund, no questions asked."
    }
  ];

  const toggleItem = (index: number) => {
    setOpenItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <MessageCircle className="w-4 h-4" />
            Frequently Asked Questions
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Everything you need to know
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get instant answers to common questions about AudioPen's features, pricing, and capabilities.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-border rounded-lg overflow-hidden bg-card"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-6 py-4 text-left hover:bg-accent transition-colors flex items-center justify-between"
              >
                <span className="font-medium text-foreground pr-4">
                  {faq.question}
                </span>
                {openItems[index] ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
              </button>
              {openItems[index] && (
                <div className="px-6 pb-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-6">
            Still have questions? We're here to help.
          </p>
          <Button variant="outline" size="lg">
            Contact Support
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;