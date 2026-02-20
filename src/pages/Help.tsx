import * as React from "react";
import { useState } from 'react';
import Link from '@/components/navigation/Link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { 
  Search, 
  MessageCircle, 
  Mail, 
  Book, 
  Video, 
  ArrowLeft,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { toast } from "sonner";

const Help = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const quickHelp = [
    {
      title: "Getting Started",
      description: "Learn the basics of using NotaVoice",
      icon: Book,
      link: "/how-it-works"
    },
    {
      title: "Video Tutorials", 
      description: "Watch step-by-step video guides",
      icon: Video,
      link: "#tutorials"
    },
    {
      title: "Contact Support",
      description: "Get help from our team",
      icon: MessageCircle,
      link: "#contact"
    }
  ];

  const faqs = [
    {
      question: "How accurate is the voice transcription?",
      answer: "NotaVoice uses advanced AI technology to achieve industry-leading accuracy. The system automatically removes filler words and formats your speech into clear, readable text.",
      category: "Features"
    },
    {
      question: "What audio formats are supported?",
      answer: "NotaVoice works with any microphone input through your browser. You can also upload audio files in common formats like MP3, WAV, and M4A.",
      category: "Technical"
    },
    {
      question: "Is my data secure and private?",
      answer: "Yes, we take privacy seriously. Your audio is processed securely and not stored permanently. All transcriptions are encrypted and only accessible to you.",
      category: "Privacy"
    },
    {
      question: "Can I export my notes?",
      answer: "Absolutely! You can export your notes as text files, copy to clipboard, or share directly with others. Premium users get additional export formats.",
      category: "Features"
    },
    {
      question: "What's the difference between free and premium?",
      answer: "Free users can create up to 10 notes per month with 3-minute recordings. Premium offers unlimited notes, longer recordings, and advanced features.",
      category: "Pricing"
    },
    {
      question: "Does it work on mobile devices?",
      answer: "Yes! NotaVoice works perfectly on smartphones and tablets through your web browser. We also have dedicated mobile apps for iOS and Android.",
      category: "Technical"
    }
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the form data to your backend
    toast.success('Message sent! We\'ll get back to you within 24 hours.');
    setContactForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Help & Support</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find answers to your questions or get in touch with our support team
          </p>
        </div>

        {/* Quick Help Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {quickHelp.map((item, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all cursor-pointer">
              <Link to={item.link}>
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <ChevronRight className="w-4 h-4 text-primary mx-auto mt-3 group-hover:translate-x-1 transition-transform" />
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>

        {/* Search FAQs */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{faq.question}</h3>
                      <Badge variant="secondary">{faq.category}</Badge>
                    </div>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No FAQs match your search. Try different keywords or contact support.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card id="contact">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    placeholder="Your name"
                    value={contactForm.name}
                    onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Input
                  placeholder="Subject"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Textarea
                  placeholder="Describe your issue or question..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                  required
                  rows={5}
                />
              </div>
              <Button type="submit" className="w-full md:w-auto">
                Send Message
              </Button>
            </form>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">💬 Quick Response Times</h4>
              <p className="text-sm text-muted-foreground">
                We typically respond within 24 hours during business days. 
                For urgent issues, mention "URGENT" in your subject line.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional Resources */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-6">More Resources</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/privacy" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Privacy Policy
              <ExternalLink className="w-4 h-4 ml-2" />
            </Link>
            <Link to="/terms" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Terms of Service
              <ExternalLink className="w-4 h-4 ml-2" />
            </Link>
            <a href="mailto:support@notavoice.ai" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
              Email Support
              <Mail className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Help;