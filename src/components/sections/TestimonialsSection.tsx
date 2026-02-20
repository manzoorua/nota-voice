import * as React from "react";
import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Graduate Student",
      university: "Stanford University",
      content: "AudioPen has revolutionized how I take notes during lectures. I can focus on understanding rather than frantically typing. The transcriptions are incredibly accurate!",
      rating: 5,
      avatar: "S"
    },
    {
      name: "Marcus Rodriguez",
      role: "Product Manager",
      company: "TechFlow Inc.",
      content: "Our team meetings are so much more productive now. I record everything and get clean action items within minutes. The grammar correction is spot-on.",
      rating: 5,
      avatar: "M"
    },
    {
      name: "Emily Johnson",
      role: "Content Creator",
      company: "Digital Nomad Blog",
      content: "I use AudioPen for brainstorming blog posts during my morning walks. It turns my scattered thoughts into well-structured outlines. Absolutely love it!",
      rating: 5,
      avatar: "E"
    },
    {
      name: "David Kim",
      role: "Consultant",
      company: "Strategy Partners",
      content: "Client interviews used to take hours to transcribe. Now I can focus on the conversation and get professional transcripts automatically. It's a game-changer.",
      rating: 5,
      avatar: "D"
    },
    {
      name: "Lisa Thompson",
      role: "Journalist",
      company: "News Today",
      content: "As a journalist, accurate transcription is crucial. AudioPen delivers publication-ready text from my interviews. The multi-language support is fantastic too.",
      rating: 5,
      avatar: "L"
    },
    {
      name: "Alex Patel",
      role: "PhD Candidate",
      university: "MIT",
      content: "Research interviews are my specialty, and AudioPen makes the analysis phase so much smoother. I can focus on insights rather than transcription work.",
      rating: 5,
      avatar: "A"
    }
  ];

  return (
    <section className="py-20 gradient-hero">
      <div className="container max-w-screen-xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
            <Star className="mr-2 h-4 w-4" />
            Loved by 50,000+ Users
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            See What Our Users Are Saying
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From students to professionals, AudioPen is transforming how people work with voice notes.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-6 gradient-card hover:shadow-lg transition-smooth">
              {/* Quote Icon */}
              <Quote className="h-8 w-8 text-primary/20 mb-4" />
              
              {/* Rating */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold mr-3">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role}
                    {testimonial.company && ` • ${testimonial.company}`}
                    {testimonial.university && ` • ${testimonial.university}`}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-primary mb-2">50,000+</div>
            <p className="text-muted-foreground">Active Users</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">2M+</div>
            <p className="text-muted-foreground">Transcriptions Created</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">99.2%</div>
            <p className="text-muted-foreground">Accuracy Rate</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">4.9/5</div>
            <p className="text-muted-foreground">User Rating</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;