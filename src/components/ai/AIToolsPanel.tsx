import React, { useState } from 'react';
import { Bot, Languages, Sparkles, FileText, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AIToolsPanelProps {
  selectedText: string;
  onResult: (result: string, type: string) => void;
}

const AIToolsPanel: React.FC<AIToolsPanelProps> = ({ selectedText, onResult }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<{ [key: string]: any }>({});

  // Summary settings
  const [summaryType, setSummaryType] = useState('brief');
  const [maxWords, setMaxWords] = useState('');
  const [summaryLanguage, setSummaryLanguage] = useState('en');

  // Translation settings
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [preserveFormatting, setPreserveFormatting] = useState(true);

  // Enhancement settings
  const [enhancementType, setEnhancementType] = useState('grammar');
  const [targetAudience, setTargetAudience] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [preserveLength, setPreserveLength] = useState(false);

  const summaryTypes = [
    { value: 'brief', label: 'Brief Summary' },
    { value: 'detailed', label: 'Detailed Summary' },
    { value: 'bullets', label: 'Bullet Points' },
    { value: 'executive', label: 'Executive Summary' },
    { value: 'technical', label: 'Technical Summary' },
    { value: 'abstract', label: 'Academic Abstract' }
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ar', label: 'Arabic' },
    { value: 'hi', label: 'Hindi' }
  ];

  const enhancementTypes = [
    { value: 'grammar', label: 'Grammar & Spelling' },
    { value: 'clarity', label: 'Clarity & Readability' },
    { value: 'tone_professional', label: 'Professional Tone' },
    { value: 'tone_friendly', label: 'Friendly Tone' },
    { value: 'tone_academic', label: 'Academic Tone' },
    { value: 'expand', label: 'Expand Content' },
    { value: 'condense', label: 'Condense Content' },
    { value: 'structure', label: 'Improve Structure' },
    { value: 'engaging', label: 'Make Engaging' },
    { value: 'seo', label: 'SEO Optimization' }
  ];

  const generateSummary = async () => {
    if (!selectedText.trim()) {
      toast.error("Please select some text to summarize.");
      return;
    }

    setLoading('summary');
    try {
      const { data, error } = await supabase.functions.invoke('generate-summary', {
        body: {
          text: selectedText,
          summaryType,
          maxLength: maxWords ? parseInt(maxWords) : undefined,
          language: summaryLanguage
        }
      });

      if (error) throw error;

      setResults(prev => ({ ...prev, summary: data }));
      onResult(data.summary, 'summary');
      
      toast.success(`${data.summaryType} summary created in ${data.processingTime.toFixed(1)}s`);
    } catch (error) {
      console.error('Summary error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to generate summary");
    } finally {
      setLoading(null);
    }
  };

  const translateText = async () => {
    if (!selectedText.trim()) {
      toast.error("Please select some text to translate.");
      return;
    }

    setLoading('translation');
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: {
          text: selectedText,
          targetLanguage,
          sourceLanguage,
          preserveFormatting
        }
      });

      if (error) throw error;

      setResults(prev => ({ ...prev, translation: data }));
      onResult(data.translatedText, 'translation');
      
      toast.success(`Translated to ${data.targetLanguageName} in ${data.processingTime.toFixed(1)}s`);
    } catch (error) {
      console.error('Translation error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to translate text");
    } finally {
      setLoading(null);
    }
  };

  const enhanceContent = async () => {
    if (!selectedText.trim()) {
      toast.error("Please select some text to enhance.");
      return;
    }

    setLoading('enhancement');
    try {
      const { data, error } = await supabase.functions.invoke('enhance-content', {
        body: {
          text: selectedText,
          enhancementType,
          targetAudience: targetAudience || undefined,
          customInstructions: customInstructions || undefined,
          preserveLength
        }
      });

      if (error) throw error;

      setResults(prev => ({ ...prev, enhancement: data }));
      onResult(data.enhancedContent, 'enhancement');
      
      toast.success(`${enhancementType.replace('_', ' ')} enhancement completed in ${data.processingTime.toFixed(1)}s`);
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to enhance content");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            AI Tools
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-red-500/70 text-white hover:bg-red-500/80 transition-colors h-5 w-5 rounded-full p-0">
                <HelpCircle className="h-2.5 w-2.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-left">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-xs mb-2">How to Use AI Tools</h4>
                  <p className="text-xs text-muted-foreground">
                    First select text from a note by highlighting it • Then choose an AI tool to process the selected text
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-xs mb-2">Available Tools</h4>
                  <p className="text-xs text-muted-foreground">
                    Summary: Create concise summaries • Enhancement: Improve clarity and style • Translation: Convert to different languages
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-xs mb-2">Text Selection</h4>
                  <p className="text-xs text-muted-foreground">
                    Highlight any text in your notes to activate AI tools • Selected text will be shown in the character counter
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-xs mb-2">Results Application</h4>
                  <p className="text-xs text-muted-foreground">
                    AI results appear in the results panel • Click "Apply" to replace the original text with processed results
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {selectedText ? (
            <Badge variant="secondary">{selectedText.length} characters selected</Badge>
          ) : (
            "Select text to use AI tools"
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="translation" className="flex items-center gap-1">
              <Languages className="w-4 h-4" />
              Translation
            </TabsTrigger>
            <TabsTrigger value="enhancement" className="flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Enhancement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="summaryType">Summary Type</Label>
                <Select value={summaryType} onValueChange={setSummaryType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select summary type" />
                  </SelectTrigger>
                  <SelectContent>
                    {summaryTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="summaryLanguage">Language</Label>
                <Select value={summaryLanguage} onValueChange={setSummaryLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="maxWords">Max Words (optional)</Label>
              <Input 
                id="maxWords"
                type="number" 
                placeholder="e.g. 100" 
                value={maxWords}
                onChange={(e) => setMaxWords(e.target.value)}
              />
            </div>
            <Button 
              onClick={generateSummary} 
              disabled={loading === 'summary' || !selectedText}
              className="w-full"
            >
              {loading === 'summary' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                'Generate Summary'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="translation" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sourceLanguage">From</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {languages.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetLanguage">To</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="preserveFormatting"
                checked={preserveFormatting}
                onCheckedChange={setPreserveFormatting}
              />
              <Label htmlFor="preserveFormatting">Preserve formatting</Label>
            </div>
            <Button 
              onClick={translateText} 
              disabled={loading === 'translation' || !selectedText}
              className="w-full"
            >
              {loading === 'translation' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                'Translate Text'
              )}
            </Button>
          </TabsContent>

          <TabsContent value="enhancement" className="space-y-4">
            <div>
              <Label htmlFor="enhancementType">Enhancement Type</Label>
              <Select value={enhancementType} onValueChange={setEnhancementType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select enhancement type" />
                </SelectTrigger>
                <SelectContent>
                  {enhancementTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="targetAudience">Target Audience (optional)</Label>
              <Input 
                id="targetAudience"
                placeholder="e.g. business professionals, students, general public"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="customInstructions">Custom Instructions (optional)</Label>
              <Textarea 
                id="customInstructions"
                placeholder="Any specific requirements or style preferences..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="preserveLength"
                checked={preserveLength}
                onCheckedChange={setPreserveLength}
              />
              <Label htmlFor="preserveLength">Preserve original length</Label>
            </div>
            <Button 
              onClick={enhanceContent} 
              disabled={loading === 'enhancement' || !selectedText}
              className="w-full"
            >
              {loading === 'enhancement' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enhancing...
                </>
              ) : (
                'Enhance Content'
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default AIToolsPanel;