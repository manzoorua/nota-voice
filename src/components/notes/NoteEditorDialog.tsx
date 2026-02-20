import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, X } from 'lucide-react';

interface NoteEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
  note: {
    id: string;
    title: string;
    content: string;
  } | null;
}

export const NoteEditorDialog: React.FC<NoteEditorDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  note,
}) => {
  const [editedContent, setEditedContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (note && isOpen) {
      setEditedContent(note.content);
      setHasChanges(false);
    }
  }, [note, isOpen]);

  useEffect(() => {
    setHasChanges(editedContent !== (note?.content || ''));
  }, [editedContent, note?.content]);

  const handleSave = () => {
    onSave(editedContent);
    onClose();
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to quit without saving?');
      if (!confirmClose) return;
    }
    onClose();
  };

  if (!note) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Edit Note: {note.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col gap-4">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            placeholder="Edit your note content..."
            className="flex-1 resize-none min-h-[400px] font-mono text-sm leading-relaxed bg-background border border-border rounded-md p-4"
            style={{
              backgroundImage: 'linear-gradient(transparent 23px, hsl(var(--border)) 24px)',
              backgroundSize: '100% 24px',
              lineHeight: '24px',
              paddingTop: '8px'
            }}
          />
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {editedContent.length}
          </span>
          <div className="flex gap-4">
            <Button onClick={handleSave} className="gap-2">
              <Check className="w-4 h-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleCancel} className="gap-2">
              <X className="w-4 h-4" />
              Quit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};