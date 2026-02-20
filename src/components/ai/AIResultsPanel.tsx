import React, { useState } from 'react';
import { Copy, Download, Share2, CheckCircle, Clock, BarChart3, Trash2, Mail, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAIResults, AIResult } from '@/hooks/useAIResults';
import { useUserLabels } from '@/hooks/useUserLabels';
import { useAuth } from '@/hooks/useAuth';

interface AIResultsPanelProps {
  onApplyResult?: (content: string) => void;
  onEmailResult?: (result: any) => void;
}

const AIResultsPanel: React.FC<AIResultsPanelProps> = ({ 
  onApplyResult, 
  onEmailResult
}) => {
  const { user } = useAuth();
  const { aiResults, deleteResult, updateLabels, isLoading } = useAIResults();
  const { labels: userLabels, predefinedLabels } = useUserLabels();
  
  const [selectedResult, setSelectedResult] = useState<AIResult | null>(
    aiResults.length > 0 ? aiResults[aiResults.length - 1] : null
  );
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  // Update selected result when results change
  React.useEffect(() => {
    if (aiResults.length > 0 && !selectedResult) {
      setSelectedResult(aiResults[aiResults.length - 1]);
    }
  }, [aiResults, selectedResult]);

  const handleDeleteResult = async (resultId: string) => {
    if (confirm('Are you sure you want to delete this result?')) {
      try {
        await deleteResult(resultId);
        if (selectedResult?.id === resultId) {
          setSelectedResult(aiResults.length > 1 ? aiResults[0] : null);
        }
        toast.success('AI result deleted');
      } catch (error) {
        console.error('Error deleting result:', error);
        toast.error('Failed to delete result');
      }
    }
  };

  const handleLabelResult = async (resultId: string, labels: string[]) => {
    try {
      await updateLabels({ id: resultId, labels });
      toast.success('Labels updated');
    } catch (error) {
      console.error('Error updating labels:', error);
      toast.error('Failed to update labels');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Content copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy content to clipboard");
    }
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'summary': return '📄';
      case 'translation': return '🌐';
      case 'enhancement': return '✨';
      default: return '🤖';
    }
  };

  if (aiResults.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>AI results will appear here after processing</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent AI Results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {aiResults.slice(-5).reverse().map((result) => (
            <div
              key={result.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedResult?.id === result.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => setSelectedResult(result)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getTypeIcon(result.type)}</span>
                  <Badge variant="outline">{result.type}</Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {result.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteResult(result.id);
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete this result</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              {result.labels && result.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {result.content.substring(0, 100)}...
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">{getTypeIcon(selectedResult.type)}</span>
                {selectedResult.type.charAt(0).toUpperCase() + selectedResult.type.slice(1)} Result
              </CardTitle>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(selectedResult.content)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy result to clipboard</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => downloadAsFile(selectedResult.content, `ai-${selectedResult.type}-${Date.now()}.txt`)}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download as text file</p>
                  </TooltipContent>
                </Tooltip>
                {onEmailResult && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => onEmailResult(selectedResult)}>
                        <Mail className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Email result to yourself</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setShowLabelModal(true)}>
                      <Tag className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add or manage labels</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={selectedResult.content} readOnly className="min-h-[200px] resize-none" />
            
            {onApplyResult && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => onApplyResult(selectedResult.content)} className="w-full">
                    Apply This Result
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Apply this result to your current work</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardContent>
        </Card>
      )}

      {showLabelModal && selectedResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Labels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Quick Labels:</p>
                <div className="flex flex-wrap gap-1">
                  {predefinedLabels.map((labelData) => (
                    <Button
                      key={labelData.name}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentLabels = selectedResult.labels || [];
                        if (!currentLabels.includes(labelData.name)) {
                          handleLabelResult(selectedResult.id, [...currentLabels, labelData.name]);
                        }
                      }}
                      disabled={selectedResult.labels?.includes(labelData.name)}
                      className="text-xs"
                    >
                      {labelData.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowLabelModal(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
};

export default AIResultsPanel;