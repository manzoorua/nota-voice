import * as React from "react";
import { useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Quote, 
  Star, 
  Users, 
  TrendingUp, 
  Award,
  Play,
  ArrowRight,
  Filter,
  Building,
  GraduationCap,
  Briefcase,
  Pen
} from 'lucide-react';
import Link from '@/components/navigation/Link';

const SuccessStories = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All Stories', icon: Users },
    { id: 'students', label: 'Students', icon: GraduationCap },
    { id: 'professionals', label: 'Professionals', icon: Briefcase },
    { id: 'creators', label: 'Creators', icon: Pen },
    { id: 'enterprise', label: 'Enterprise', icon: Building },
  ];

  const stories = [
    {
      id: 1,
      category: 'students',
      name: 'Sarah Chen',
      role: 'Medical Student, Stanford University',
      avatar: 'SC',
      story: 'NotaVoice transformed how I study. I can record lecture summaries while walking between classes and get perfectly formatted notes instantly. My GPA improved by 0.4 points since I started using it.',
      impact: 'Saved 10+ hours per week on note-taking',
      rating: 5,
      timeUsing: '8 months',
      notesCreated: 450,
      featured: true
    },
    {
      id: 2,
      category: 'professionals',
      name: 'Marcus Johnson',
      role: 'Product Manager, TechCorp',
      avatar: 'MJ',
      story: 'I use NotaVoice for all my meeting follow-ups. Instead of typing lengthy emails, I just speak my thoughts and get professional, well-structured summaries. My team loves the clarity.',
      impact: '3x faster meeting documentation',
      rating: 5,
      timeUsing: '1 year',
      notesCreated: 680,
      featured: true
    },
    {
      id: 3,
      category: 'creators',
      name: 'Emma Rodriguez',
      role: 'Content Creator & Blogger',
      avatar: 'ER',
      story: 'As someone with dyslexia, writing has always been challenging. NotaVoice lets me speak my ideas naturally and turns them into polished blog posts. I\'ve doubled my content output.',
      impact: 'Doubled content creation speed',
      rating: 5,
      timeUsing: '6 months',
      notesCreated: 320,
      featured: true
    },
    {
      id: 4,
      category: 'enterprise',
      name: 'David Park',
      role: 'Training Director, Global Solutions Inc.',
      avatar: 'DP',
      story: 'We rolled out NotaVoice across our training department. Trainers can now create course materials by simply explaining concepts aloud. It\'s revolutionized our content creation process.',
      impact: '60% faster training material creation',
      rating: 5,
      timeUsing: '1.5 years',
      notesCreated: 1200,
      featured: false
    },
    {
      id: 5,
      category: 'students',
      name: 'Alex Thompson',
      role: 'PhD Candidate, MIT',
      avatar: 'AT',
      story: 'Research note-taking used to be my biggest bottleneck. Now I record observations during experiments and get organized notes instantly. My advisor is amazed at my documentation quality.',
      impact: 'Improved research documentation by 200%',
      rating: 5,
      timeUsing: '10 months',
      notesCreated: 380,
      featured: false
    },
    {
      id: 6,
      category: 'professionals',
      name: 'Lisa Chen',
      role: 'Consultant, Strategy Partners',
      avatar: 'LC',
      story: 'Client calls, strategy sessions, brainstorming - I record everything with NotaVoice. The AI removes all the "ums" and creates executive-ready summaries. My clients are impressed.',
      impact: 'Professional presentation quality improved',
      rating: 5,
      timeUsing: '2 years',
      notesCreated: 890,
      featured: false
    }
  ];

  const filteredStories = selectedFilter === 'all' 
    ? stories 
    : stories.filter(story => story.category === selectedFilter);

  const stats = [
    { label: 'Success Stories', value: '2,500+', icon: Users },
    { label: 'Average Rating', value: '4.9/5', icon: Star },
    { label: 'Time Saved Weekly', value: '8.5 hrs', icon: TrendingUp },
    { label: 'Productivity Increase', value: '150%', icon: Award },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge className="mb-4" variant="secondary">Real User Stories</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            See How <span className="text-gradient">NotaVoice</span> Changed Lives
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            From students acing exams to professionals streamlining workflows, 
            discover how thousands of users are achieving more with voice-powered note-taking.
          </p>
          <Link to="/signup" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-lg font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gradient-primary text-primary-foreground hover:shadow-glow transition-bounce h-14 rounded-lg px-10">
            Start Your Success Story
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => (
            <Card key={index} className="text-center hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={selectedFilter === filter.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter(filter.id)}
              className="flex items-center gap-2"
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Featured Stories */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Featured Success Stories</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {filteredStories.filter(story => story.featured).map((story) => (
              <Card key={story.id} className="relative overflow-hidden group hover:shadow-lg transition-all">
                <div className="absolute top-4 right-4">
                  <Badge variant="default" className="bg-primary">Featured</Badge>
                </div>
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${story.name}`} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {story.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{story.name}</h3>
                      <p className="text-sm text-muted-foreground">{story.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(story.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Quote className="absolute -top-2 -left-2 w-8 h-8 text-primary/20" />
                    <p className="text-muted-foreground italic pl-6">"{story.story}"</p>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-accent/50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-accent-foreground">
                        💡 {story.impact}
                      </p>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Using for {story.timeUsing}</span>
                      <span>{story.notesCreated} notes created</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* All Stories Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">More Success Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStories.filter(story => !story.featured).map((story) => (
              <Card key={story.id} className="hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${story.name}`} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {story.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-sm">{story.name}</h3>
                      <p className="text-xs text-muted-foreground">{story.role}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                      {[...Array(story.rating)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">"{story.story}"</p>
                  <div className="bg-accent/30 rounded-lg p-2 mb-3">
                    <p className="text-xs font-medium text-accent-foreground">
                      {story.impact}
                    </p>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{story.timeUsing}</span>
                    <span>{story.notesCreated} notes</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-hero rounded-2xl p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Write Your Success Story?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied users who have transformed their productivity with NotaVoice. 
            Start your free trial today and experience the difference.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gradient-primary text-primary-foreground hover:shadow-glow transition-bounce h-11 rounded-md px-8">
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link to="/how-it-works" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8">
              <Play className="w-4 h-4 mr-2" />
              See How It Works
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SuccessStories;