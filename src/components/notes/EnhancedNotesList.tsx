import { useState, useMemo } from 'react';
import { Search, Filter, Tag, Star, Calendar, Clock, Download, Share2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface VoiceNote {
  id: string;
  title: string;
  content: string;
  transcription?: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  ai_processing_status: string;
  language: string;
  processing_time_seconds: number;
}

interface EnhancedNotesListProps {
  notes: VoiceNote[];
  selectedNote: VoiceNote | null;
  onSelectNote: (note: VoiceNote) => void;
  onToggleFavorite: (noteId: string, currentFavorite: boolean) => void;
  onDeleteNote: (noteId: string) => void;
  onExportNote: (note: VoiceNote) => void;
  onShareNote: (note: VoiceNote) => void;
}

const EnhancedNotesList = ({
  notes,
  selectedNote,
  onSelectNote,
  onToggleFavorite,
  onDeleteNote,
  onExportNote,
  onShareNote,
}: EnhancedNotesListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'processing_time'>('date');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Extract all unique tags from notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [notes]);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let filtered = notes.filter(note => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!note.title.toLowerCase().includes(query) && 
            !note.content.toLowerCase().includes(query) &&
            !note.tags?.some(tag => tag.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'all' && note.ai_processing_status !== filterStatus) {
        return false;
      }

      // Tags filter
      if (selectedTags.length > 0) {
        if (!note.tags?.some(tag => selectedTags.includes(tag))) {
          return false;
        }
      }

      // Favorites filter
      if (showFavoritesOnly && !note.is_favorite) {
        return false;
      }

      return true;
    });

    // Sort notes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'processing_time':
          return (b.processing_time_seconds || 0) - (a.processing_time_seconds || 0);
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [notes, searchQuery, sortBy, filterStatus, selectedTags, showFavoritesOnly]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isFailedNote = (note: VoiceNote) => {
    return (!note.transcription || note.transcription.trim() === '') && 
           (!note.content || note.content.trim() === '');
  };

  const getStatusColor = (status: string, isFailed: boolean = false) => {
    if (isFailed) return 'bg-destructive text-destructive-foreground';
    
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      case 'processing': return 'bg-primary text-primary-foreground';
      case 'error': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="title">Sort by Title</SelectItem>
              <SelectItem value="processing_time">Sort by Processing Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          {allTags.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="w-4 h-4 mr-2" />
                  Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-2">
                  <h4 className="font-medium">Filter by tags</h4>
                  {allTags.map(tag => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <label htmlFor={tag} className="text-sm">{tag}</label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Star className="w-4 h-4 mr-2" />
            Favorites
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <div className="space-y-2">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {notes.length === 0 ? 'No voice notes yet. Start by recording your first note!' : 'No notes match your filters.'}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isFailed = isFailedNote(note);
            return (
              <Card 
                key={note.id} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedNote?.id === note.id ? 'ring-2 ring-primary' : ''
                } ${isFailed ? 'opacity-60' : ''}`}
                onClick={() => onSelectNote(note)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium truncate ${isFailed ? 'text-muted-foreground' : ''}`}>
                          {note.title}
                        </h3>
                        {note.is_favorite && (
                          <Star className="w-4 h-4 text-warning fill-current" />
                        )}
                        <Badge className={getStatusColor(isFailed ? 'error' : note.ai_processing_status, isFailed)}>
                          {isFailed ? 'Error' : note.ai_processing_status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {isFailed ? (
                          <span className="text-destructive font-medium">Error: No audio provided</span>
                        ) : (
                          note.content
                        )}
                      </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {note.processing_time_seconds > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {note.processing_time_seconds}s
                        </div>
                      )}
                      {note.language && (
                        <Badge variant="outline" className="text-xs">
                          {note.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        •••
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(note.id, note.is_favorite);
                      }}>
                        <Star className="w-4 h-4 mr-2" />
                        {note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onExportNote(note);
                      }}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onShareNote(note);
                      }}>
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(note.id);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>
      
      {filteredNotes.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredNotes.length} of {notes.length} notes
        </div>
      )}
    </div>
  );
};

export default EnhancedNotesList;