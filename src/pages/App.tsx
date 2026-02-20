import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useNoteLimit } from '@/hooks/useNoteLimit';
import { useAIResults } from '@/hooks/useAIResults';
import { useUserLabels } from '@/hooks/useUserLabels';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PremiumFeature from '@/components/auth/PremiumFeature';
import FeatureGate from '@/components/auth/FeatureGate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import VoiceRecorder from '@/components/ui/VoiceRecorder';
import AudioFileUpload from '@/components/ui/AudioFileUpload';
import AIToolsPanel from '@/components/ai/AIToolsPanel';
import AIResultsPanel from '@/components/ai/AIResultsPanel';
import { NoteEditorDialog } from '@/components/notes/NoteEditorDialog';
import { Mic, Search, Star, Trash2, Download, Share2, Plus, LogOut, Settings, Home, Bot, HelpCircle, Upload, Edit3, Check, X } from 'lucide-react';
import { toast } from "sonner";
// Import the AIResult type from the hook to ensure consistency
import { AIResult } from '@/hooks/useAIResults';
interface VoiceNote {
  id: string;
  title: string;
  content: string;
  transcription?: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  upload_source?: string;
  uploaded_file_path?: string;
}
const AppPage = () => {
  const {
    user,
    loading,
    userRole,
    isAdmin,
    isManager,
    isPremium,
    hasRole
  } = useAuth();
  const usageLimits = useUsageLimits();
  const { currentCount, limit, remaining, canCreateNote, loading: limitLoading } = useNoteLimit();
  const { aiResults, refetch: refetchAIResults, updateLabels, deleteResult, toggleFavorite: toggleAIResultFavorite } = useAIResults();
  const { labels: userLabels } = useUserLabels();
  
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [showAITools, setShowAITools] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  // Auto-select first note when dashboard loads
  useEffect(() => {
    if (notes.length > 0 && !selectedNote) {
      setSelectedNote(notes[0]);
    }
  }, [notes, selectedNote]);
  const fetchNotes = async () => {
    try {
      console.log('Fetching notes for user:', user?.id);
      const {
        data,
        error
      } = await supabase.from('voice_notes').select('*').order('created_at', {
        ascending: false
      });
      if (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }
      console.log('Fetched notes:', data);
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
    }
  };
  const handleTranscription = async (text: string, appendMode: boolean = false) => {
    if (!user || !text.trim()) return;

    if (appendMode && selectedNote) {
      try {
        // Append to existing note
        const updatedContent = selectedNote.content + `\n\n${text}`;
        
        const { error } = await supabase
          .from('voice_notes')
          .update({ 
            content: updatedContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedNote.id);
        
        if (error) throw error;
        
        // Update local state
        const updatedNote = { ...selectedNote, content: updatedContent };
        setSelectedNote(updatedNote);
        setNotes(prev => prev.map(note => 
          note.id === selectedNote.id ? updatedNote : note
        ));
        
        toast.success('Content added to your note!');
      } catch (error) {
        console.error('Error updating note:', error);
        toast.error('Failed to update note');
      }
    } else {
      // Refresh notes list since the note was created by the edge function
      fetchNotes();
      toast.success('Voice note processed successfully!');
    }
  };
  const toggleNoteFavorite = async (noteId: string, currentFavorite: boolean) => {
    try {
      const {
        error
      } = await supabase.from('voice_notes').update({
        is_favorite: !currentFavorite
      }).eq('id', noteId);
      if (error) throw error;
      setNotes(prev => prev.map(note => note.id === noteId ? {
        ...note,
        is_favorite: !currentFavorite
      } : note));
      if (selectedNote?.id === noteId) {
        setSelectedNote(prev => prev ? {
          ...prev,
          is_favorite: !currentFavorite
        } : null);
      }
    } catch (error) {
      toast.error('Failed to update favorite status');
    }
  };
  const deleteNote = async (noteId: string) => {
    try {
      const {
        error
      } = await supabase.from('voice_notes').delete().eq('id', noteId);
      if (error) throw error;
      setNotes(prev => prev.filter(note => note.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
      toast.success('Note deleted');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };
  const exportNote = (note: VoiceNote) => {
    const content = `${note.title}\n\n${note.content}`;
    const blob = new Blob([content], {
      type: 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const shareNote = async (note: VoiceNote) => {
    if (navigator.share) {
      await navigator.share({
        title: note.title,
        text: note.content
      });
    } else {
      await navigator.clipboard.writeText(note.content);
      toast.success('Note copied to clipboard');
    }
  };
  const handleTextSelection = () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.trim()) {
      setSelectedText(selection.trim());
      setShowAITools(true);
    }
  };
  const handleAIResult = async (result: string, type: string) => {
    // AI results are now automatically saved by the edge functions
    // We just need to trigger a refetch to update the UI
    await refetchAIResults();
    toast.success('AI result generated and saved!');
  };

  const handleDeleteResult = async (resultId: string) => {
    try {
      await deleteResult(resultId);
      toast.success('AI result deleted');
    } catch (error) {
      console.error('Error deleting result:', error);
      toast.error('Failed to delete result');
    }
  };

  const handleEmailResult = async (result: any) => {
    const userEmail = user?.email;
    const userFullName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'User';
    
    if (!userEmail) {
      toast.error('User email not found');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-ai-results', {
        body: { 
          email: userEmail,
          result: {
            content: result.content,
            type: result.type,
            labels: result.labels || [],
            timestamp: result.timestamp ? result.timestamp.toISOString() : new Date().toISOString(),
            metadata: result.metadata || {}
          },
          userFullName: userFullName
        }
      });

      if (error) {
        console.error('Email service error:', error);
        if (error.message?.includes('Missing API key')) {
          toast.error('Email service not configured. Please contact support.');
        } else if (error.message?.includes('domain')) {
          toast.error('Email domain not verified. Please contact support.');
        } else {
          toast.error('Failed to send email. Please try again.');
        }
        return;
      }
      
      toast.success('AI result emailed successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please check your connection and try again.');
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
  const applyAIResult = (content: string) => {
    if (selectedNote) {
      const updatedNote = {
        ...selectedNote,
        content
      };
      setSelectedNote(updatedNote);
      setNotes(prev => prev.map(note => note.id === selectedNote.id ? updatedNote : note));

      // Update in database
      supabase.from('voice_notes').update({
        content
      }).eq('id', selectedNote.id).then(({
        error
      }) => {
        if (error) {
          console.error('Error updating note:', error);
          toast.error('Failed to save the updated content.');
        } else {
          toast.success('The AI result has been applied to your note.');
        }
      });
    }
  };

  const handleEditNote = () => {
    setIsEditDialogOpen(true);
  };

  const handleSaveNote = async (content: string) => {
    if (!selectedNote) return;
    
    try {
      const { error } = await supabase
        .from('voice_notes')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedNote.id);
      
      if (error) throw error;
      
      // Update local state
      const updatedNote = { ...selectedNote, content, updated_at: new Date().toISOString() };
      setSelectedNote(updatedNote);
      setNotes(prev => prev.map(note => 
        note.id === selectedNote.id ? updatedNote : note
      ));
      
      toast.success('Note updated successfully!');
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };
  const isFailedNote = (note: VoiceNote) => {
    return (!note.transcription || note.transcription.trim() === '') && 
           (!note.content || note.content.trim() === '');
  };

  const filteredNotes = notes.filter(note => note.title?.toLowerCase().includes(searchQuery.toLowerCase()) || note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()));
  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your notes...</p>
        </div>
      </div>;
  }
  if (!user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
          <p className="text-muted-foreground mb-6">You need to be authenticated to use the voice recorder.</p>
          <Button onClick={() => window.location.href = '/'} className="w-full">
            Go to Home Page
          </Button>
        </div>
      </div>;
  }
  return <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              
              <div className="flex items-center gap-3">
                <img src="/lovable-uploads/b626c075-fcb2-4a34-abcd-e108edf5e4e2.png" alt="NotaVoice" className="h-8 w-auto" />
                {isPremium && <Badge variant="default" className="bg-yellow-500 text-white">
                    Premium
                  </Badge>}
                {isAdmin && <Badge variant="destructive">
                    Admin
                  </Badge>}
                {userRole && !isPremium && !isAdmin && <Badge variant="secondary">
                    Free
                  </Badge>}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Usage Indicator for Free Users */}
              {!isPremium && !isAdmin && <div className="text-xs text-muted-foreground">
                  {usageLimits.notesUsed}/{usageLimits.notesLimit} notes today
                </div>}
              
              <FeatureGate requirePremium>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = '/analytics'}>
                      📊
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Analytics Dashboard</p>
                  </TooltipContent>
                </Tooltip>
              </FeatureGate>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/billing'}>
                    💳
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPremium ? 'Manage Subscription' : 'Upgrade to Premium'}</p>
                </TooltipContent>
              </Tooltip>

              <FeatureGate requireAdmin>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin'}>
                      🔧
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Admin Panel</p>
                  </TooltipContent>
                </Tooltip>
              </FeatureGate>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/'}>
                    <Home className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Go to Home Page</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = '/profile'}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Profile Settings</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => setShowAITools(!showAITools)}>
                    <Bot className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showAITools ? 'Hide AI Tools' : 'Show AI Tools'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sign Out</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

      <div className="container mx-auto px-4 py-6">
        <div className={`grid gap-6 ${showAITools ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1 lg:grid-cols-3'}`}>
          {/* Sidebar - Notes List */}
          <div className={showAITools ? 'xl:col-span-1' : 'lg:col-span-1'}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Mic className="w-5 h-5" />
                    Your Notes ({notes.length})
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
                          <h4 className="font-medium text-xs mb-2">How to Manage Notes</h4>
                          <p className="text-xs text-muted-foreground">
                            Click any note to view and edit • Use the heart icon to favorite • Search notes using the search bar
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-xs mb-2">Processing Notes</h4>
                          <p className="text-xs text-muted-foreground">
                            Select a note to view its content • Toggle append mode to add new recordings to existing notes • Select text to use AI tools
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-xs mb-2">Note Limits</h4>
                          <p className="text-xs text-muted-foreground">
                            Free accounts can store up to 5 notes • When limit is reached, oldest notes are automatically replaced
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-xs mb-2">Retention Policy</h4>
                          <p className="text-xs text-muted-foreground">
                            Notes are automatically deleted after 7 days
                          </p>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {filteredNotes.length === 0 ? <div className="text-center py-8">
                    <Mic className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {notes.length === 0 ? 'No notes yet. Record your first one!' : 'No notes match your search.'}
                    </p>
                   </div> : filteredNotes.map(note => {
                       const isFailed = isFailedNote(note);
                       const isUploaded = note.upload_source === 'upload';
                       return (
                         <Card key={note.id} className={`cursor-pointer transition-all hover:shadow-md ${selectedNote?.id === note.id ? 'ring-2 ring-primary' : ''} ${isFailed ? 'opacity-60' : ''} ${isUploaded ? 'bg-gradient-to-r from-blue-50/50 to-yellow-50/50 dark:from-blue-950/20 dark:to-yellow-950/20 border-blue-200/50 dark:border-blue-800/50' : ''}`} onClick={() => setSelectedNote(note)}>
                           <CardContent className="p-4">
                             <div className="flex items-start justify-between mb-2">
                               <h3 className={`font-medium text-sm line-clamp-2 ${isFailed ? 'text-muted-foreground' : isUploaded ? 'text-blue-700 dark:text-blue-300' : ''}`}>{note.title}</h3>
                               <div className="flex items-center gap-1">
                                 {isUploaded && <Upload className="w-3 h-3 text-blue-500" />}
                                 {note.is_favorite && <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />}
                               </div>
                             </div>
                             <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                               {isFailed ? (
                                 <span className="text-destructive font-medium">Error: No audio provided</span>
                               ) : (
                                 note.content
                               )}
                             </p>
                           </CardContent>
                         </Card>
                       );
                    })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className={`space-y-6 ${showAITools ? 'xl:col-span-2' : 'lg:col-span-2'}`}>
            {/* Input Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Voice Recorder */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Record New Note
                    </div>
                    <div className="flex items-center gap-2">
                      {!isPremium && !isAdmin && <div className="text-xs text-muted-foreground">
                          {currentCount}/{limit} used
                        </div>}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" className="bg-red-500/70 text-white hover:bg-red-500/80 transition-colors h-5 w-5 rounded-full p-0">
                            <HelpCircle className="h-2.5 w-2.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-left">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-xs mb-2">How to Record</h4>
                              <p className="text-xs text-muted-foreground">
                                Click to record • Click again to stop • Maximum 3 minutes
                              </p>
                            </div>
                            
                            {!limitLoading && (
                              <div>
                                <h4 className="font-medium text-xs mb-2">Note Limits</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={canCreateNote ? "secondary" : "destructive"} className="text-xs">
                                    {currentCount}/{limit} notes used
                                  </Badge>
                                  {remaining > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      {remaining} remaining
                                    </Badge>
                                  )}
                                  {remaining === 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      Oldest will be replaced
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                              
                            <div>
                              <h4 className="font-medium text-xs mb-2">Retention Policy</h4>
                              <p className="text-xs text-muted-foreground">
                                Notes are automatically deleted after 7 days
                              </p>
                            </div>
                            
                            {typeof window !== 'undefined' && window.location !== window.parent.location && (
                              <div>
                                <h4 className="font-medium text-xs mb-2">Troubleshooting</h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Microphone may be blocked in embedded previews.
                                </p>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => window.open(location.href, '_blank', 'noopener')}
                                  className="text-xs"
                                >
                                  Open in new tab
                                </Button>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   {usageLimits.canCreateNote || isPremium || isAdmin ? <VoiceRecorder onTranscription={handleTranscription} selectedNote={selectedNote} /> : <PremiumFeature feature="unlimited voice notes">
                      <VoiceRecorder onTranscription={handleTranscription} selectedNote={selectedNote} />
                    </PremiumFeature>}
                </CardContent>
              </Card>

              {/* Audio File Upload - Premium Only */}
              <FeatureGate requirePremium fallback={
                <PremiumFeature feature="audio file upload">
                  <div></div>
                </PremiumFeature>
              }>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        Upload Audio File
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
                              <h4 className="font-medium text-xs mb-2">Supported Formats</h4>
                              <p className="text-xs text-muted-foreground">
                                MP3, WAV, M4A, OGG, FLAC, WebM • Maximum 25MB
                              </p>
                            </div>
                            
                            <div>
                              <h4 className="font-medium text-xs mb-2">How to Upload</h4>
                              <p className="text-xs text-muted-foreground">
                                Drag & drop or click to select • Processing takes 20-60 seconds
                              </p>
                            </div>
                            
                            <div>
                              <h4 className="font-medium text-xs mb-2">Troubleshooting</h4>
                              <p className="text-xs text-muted-foreground">
                                If upload fails, try a smaller file or convert to MP3
                              </p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AudioFileUpload onUploadComplete={handleTranscription} />
                  </CardContent>
                </Card>
              </FeatureGate>
            </div>

            {/* Selected Note */}
            {selectedNote && <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2 text-lg">{selectedNote.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => toggleNoteFavorite(selectedNote.id, selectedNote.is_favorite)}>
                            <Star className={`w-4 h-4 ${selectedNote.is_favorite ? 'text-yellow-500 fill-current' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{selectedNote.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={handleEditNote}>
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Note Content</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => shareNote(selectedNote)}>
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Share Note</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => exportNote(selectedNote)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Download as Text File</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => deleteNote(selectedNote.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete Note</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none" onMouseUp={handleTextSelection} style={{
                  userSelect: 'text'
                }}>
                    <p className="whitespace-pre-wrap">{selectedNote.content}</p>
                  </div>
                </CardContent>
              </Card>}
          </div>

          {/* AI Tools Sidebar */}
          {showAITools && <div className="xl:col-span-1 space-y-6">
              <AIToolsPanel selectedText={selectedText} onResult={handleAIResult} />
              <AIResultsPanel 
                onApplyResult={applyAIResult}
                onEmailResult={handleEmailResult}  
              />
            </div>}
        </div>
      </div>
    </div>

    <NoteEditorDialog
      isOpen={isEditDialogOpen}
      onClose={() => setIsEditDialogOpen(false)}
      onSave={handleSaveNote}
      note={selectedNote}
    />
    </TooltipProvider>;
};
export default AppPage;