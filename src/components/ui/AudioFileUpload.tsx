import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { toast } from "sonner";

interface AudioFileUploadProps {
  onUploadComplete: (transcript: string) => void;
}

const AudioFileUpload: React.FC<AudioFileUploadProps> = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
    'audio/aac', 'audio/flac', 'audio/ogg', 'audio/webm'
  ];

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return `Unsupported file type. Please upload: MP3, WAV, M4A, AAC, FLAC, OGG, or WebM files.`;
    }

    // Check file size (25MB limit for OpenAI Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      return `File too large. Maximum size is 25MB for transcription. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`;
    }

    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processUploadedFile = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to Supabase Storage
      const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio-uploads')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      setUploadProgress(40);

      // Create voice note record
      const { data: noteData, error: noteError } = await supabase
        .from('voice_notes')
        .insert({
          user_id: user.id,
          title: `Uploaded: ${selectedFile.name}`,
          status: 'processing',
          upload_source: 'upload',
          uploaded_file_path: uploadData.path,
          duration_seconds: 0 // Will be updated after processing
        })
        .select()
        .single();

      if (noteError) throw noteError;

      setUploadProgress(60);

      // Send storage path to transcription service (no base64 conversion)
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke(
        'transcribe-audio',
        {
          body: {
            noteId: noteData.id,
            storagePath: uploadData.path,
            mimeType: selectedFile.type,
            language: 'en',
            uploadSource: 'upload'
          }
        }
      );

      if (transcriptionError) throw transcriptionError;

      setUploadProgress(90);

      // Clean up the uploaded file from storage
      await supabase.storage
        .from('audio-uploads')
        .remove([uploadData.path]);

      setUploadProgress(100);

      toast.success('Audio file processed successfully!');
      onUploadComplete(transcriptionData.transcript);
      clearSelectedFile();

    } catch (error: any) {
      console.error('Upload processing error:', error);
      toast.error(`Failed to process audio file: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 text-center gradient-card shadow-lg relative select-none">
      {!selectedFile ? (
        <div
          className={`flex items-center justify-center min-h-[200px] text-center transition-colors duration-200 ${
            dragActive ? 'bg-primary/10' : ''
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-yellow-500 flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h3 className="font-medium text-base mb-2">Upload Audio File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop an audio file here, or click to browse
              </p>
              
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="bg-gradient-to-r from-blue-500 to-yellow-500 text-white border-0 hover:from-blue-600 hover:to-yellow-600"
              >
                Choose File
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Supported formats: MP3, WAV, M4A, AAC, FLAC, OGG, WebM</p>
              <p>Maximum file size: 25MB</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={allowedTypes.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg w-full max-w-md">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-yellow-500 flex items-center justify-center">
              <File className="w-5 h-5 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)} • {selectedFile.type}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelectedFile}
              disabled={isUploading}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {isUploading && (
            <div className="flex flex-col items-center space-y-2 w-full max-w-md">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing audio file... {uploadProgress}%
              </div>
              <div className="w-full bg-background/50 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 w-full max-w-md">
            <Button
              onClick={processUploadedFile}
              disabled={isUploading}
              className="flex-1 bg-gradient-to-r from-blue-500 to-yellow-500 text-white hover:from-blue-600 hover:to-yellow-600"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Process Audio'
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={clearSelectedFile}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioFileUpload;