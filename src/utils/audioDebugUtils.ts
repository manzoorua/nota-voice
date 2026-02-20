// Audio debugging utilities for voice recording diagnostics

export interface AudioDebugInfo {
  sessionId: string;
  timestamp: number;
  step: string;
  status: 'success' | 'error' | 'warning' | 'info';
  data?: any;
  error?: string;
  duration?: number;
}

export interface AudioValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    size: number;
    type: string;
    duration: number;
    base64Length?: number;
    estimatedDuration?: number;
  };
}

export class AudioDebugger {
  private static instance: AudioDebugger;
  private logs: AudioDebugInfo[] = [];
  private currentSessionId: string = '';

  static getInstance(): AudioDebugger {
    if (!AudioDebugger.instance) {
      AudioDebugger.instance = new AudioDebugger();
    }
    return AudioDebugger.instance;
  }

  startSession(): string {
    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.log('session_start', 'info', { sessionId: this.currentSessionId });
    return this.currentSessionId;
  }

  log(step: string, status: 'success' | 'error' | 'warning' | 'info', data?: any, error?: string, startTime?: number): void {
    const logEntry: AudioDebugInfo = {
      sessionId: this.currentSessionId,
      timestamp: Date.now(),
      step,
      status,
      data,
      error,
      duration: startTime ? Date.now() - startTime : undefined
    };

    this.logs.push(logEntry);
    
    // Console logging with structured format
    const logLevel = status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'log';
    console[logLevel](`[AUDIO_DEBUG] ${this.currentSessionId} | ${step}:`, {
      status,
      duration: logEntry.duration ? `${logEntry.duration}ms` : undefined,
      data,
      error
    });

    // Keep only last 100 logs per session
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }
  }

  validateAudioBlob(blob: Blob, recordingTime: number): AudioValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Size validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    const minSize = 1024; // 1KB
    
    if (blob.size > maxSize) {
      errors.push(`Audio file too large: ${(blob.size / 1024 / 1024).toFixed(2)}MB (max: 50MB)`);
    }
    
    if (blob.size < minSize) {
      errors.push(`Audio file too small: ${blob.size} bytes (min: 1KB)`);
    }

    // Duration validation
    const maxDuration = 600; // 10 minutes
    const minDuration = 0.5; // 0.5 seconds
    
    if (recordingTime > maxDuration) {
      errors.push(`Recording too long: ${recordingTime}s (max: ${maxDuration}s)`);
    }
    
    if (recordingTime < minDuration) {
      errors.push(`Recording too short: ${recordingTime}s (min: ${minDuration}s)`);
    }

    // Type validation
    const supportedTypes = [
      'audio/webm', 'audio/wav', 'audio/mp3', 'audio/mp4', 
      'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/mpeg'
    ];
    
    if (!supportedTypes.includes(blob.type)) {
      warnings.push(`Unsupported MIME type: ${blob.type}`);
    }

    // Estimate duration from file size (rough approximation)
    const estimatedDuration = blob.size / (16000 * 2); // Assuming 16kHz, 16-bit
    if (Math.abs(estimatedDuration - recordingTime) > recordingTime * 0.5) {
      warnings.push(`Duration mismatch: recorded ${recordingTime}s, estimated ${estimatedDuration.toFixed(1)}s from file size`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        size: blob.size,
        type: blob.type,
        duration: recordingTime,
        estimatedDuration
      }
    };
  }

  validateBase64Audio(base64Data: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!base64Data) {
      errors.push('Base64 data is empty');
      return { isValid: false, errors, warnings };
    }

    if (base64Data.length < 100) {
      errors.push(`Base64 data too short: ${base64Data.length} characters`);
    }

    // Check for valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      errors.push('Invalid base64 format detected');
    }

    // Check for suspicious patterns
    if (base64Data.startsWith('data:')) {
      warnings.push('Base64 data appears to include data URI prefix');
    }

    // Estimate decoded size
    const decodedSize = (base64Data.length * 3) / 4;
    if (decodedSize > 50 * 1024 * 1024) { // 50MB
      warnings.push(`Large decoded size: ${(decodedSize / 1024 / 1024).toFixed(2)}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSessionLogs(sessionId?: string): AudioDebugInfo[] {
    const targetSessionId = sessionId || this.currentSessionId;
    return this.logs.filter(log => log.sessionId === targetSessionId);
  }

  getAllLogs(): AudioDebugInfo[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportDebugReport(sessionId?: string): string {
    const logs = sessionId ? this.getSessionLogs(sessionId) : this.getAllLogs();
    
    const report = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || this.currentSessionId,
      totalLogs: logs.length,
      errors: logs.filter(l => l.status === 'error').length,
      warnings: logs.filter(l => l.status === 'warning').length,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString()
      }))
    };

    return JSON.stringify(report, null, 2);
  }
}

// Enhanced FileReader with debugging
export class DebugFileReader {
  private debugger: AudioDebugger;
  private sessionId: string;

  constructor(sessionId: string) {
    this.debugger = AudioDebugger.getInstance();
    this.sessionId = sessionId;
  }

  async readAsBase64(blob: Blob): Promise<string> {
    const startTime = Date.now();
    this.debugger.log('file_reader_start', 'info', { 
      blobSize: blob.size, 
      blobType: blob.type 
    });

    // CRITICAL FIX: Add pre-validation
    if (!blob || blob.size === 0) {
      this.debugger.log('file_reader_invalid_blob', 'error', { 
        blobExists: !!blob, 
        blobSize: blob?.size || 0 
      });
      throw new Error('Invalid or empty audio blob provided to FileReader');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onloadstart = () => {
        this.debugger.log('file_reader_loadstart', 'info');
      };

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          this.debugger.log('file_reader_progress', 'info', { progress: progress.toFixed(1) });
        }
      };

      reader.onloadend = () => {
        try {
          const result = reader.result as string;
          
          this.debugger.log('file_reader_raw_result', 'info', {
            hasResult: !!result,
            resultType: typeof result,
            resultLength: result?.length || 0,
            startsWithDataUrl: result?.startsWith('data:') || false
          });
          
          if (!result) {
            this.debugger.log('file_reader_no_result', 'error', undefined, 'FileReader returned null/undefined result', startTime);
            reject(new Error('FileReader returned no result'));
            return;
          }

          // CRITICAL FIX: Enhanced base64 extraction
          let base64Data: string;
          if (result.includes(',')) {
            // Data URL format: "data:audio/webm;base64,UklGRiQAAABXQVZF..."
            const parts = result.split(',');
            if (parts.length !== 2) {
              this.debugger.log('file_reader_malformed_dataurl', 'error', {
                parts: parts.length,
                firstPart: parts[0]?.substring(0, 50)
              });
              reject(new Error(`Malformed data URL: expected 2 parts, got ${parts.length}`));
              return;
            }
            base64Data = parts[1];
          } else {
            // Assume it's already base64
            base64Data = result;
          }

          // CRITICAL: Validate extracted base64
          if (!base64Data || base64Data.length === 0) {
            this.debugger.log('file_reader_empty_base64', 'error', {
              originalResult: result.substring(0, 100),
              extractedBase64Length: base64Data?.length || 0
            });
            reject(new Error('Base64 extraction resulted in empty string'));
            return;
          }

          const validation = this.debugger.validateBase64Audio(base64Data);
          
          this.debugger.log('file_reader_complete', 'success', {
            resultLength: result.length,
            base64Length: base64Data.length,
            validation,
            firstBase64Chars: base64Data.substring(0, 50),
            lastBase64Chars: base64Data.substring(base64Data.length - 20)
          }, undefined, startTime);

          if (validation.errors.length > 0) {
            this.debugger.log('file_reader_validation_failed', 'error', validation);
            reject(new Error(`Base64 validation failed: ${validation.errors.join(', ')}`));
          } else {
            resolve(base64Data);
          }
        } catch (processError: any) {
          this.debugger.log('file_reader_processing_error', 'error', {
            errorType: processError.constructor.name,
            errorMessage: processError.message
          }, `Error processing FileReader result: ${processError.message}`, startTime);
          reject(new Error(`Error processing FileReader result: ${processError.message}`));
        }
      };

      reader.onerror = (error) => {
        this.debugger.log('file_reader_error', 'error', {
          errorType: error?.type || 'unknown',
          readerError: reader.error?.message || 'unknown'
        }, `FileReader error: ${reader.error?.message || error}`, startTime);
        reject(new Error(`FileReader error: ${reader.error?.message || error}`));
      };

      reader.onabort = () => {
        this.debugger.log('file_reader_abort', 'error', undefined, 'FileReader was aborted', startTime);
        reject(new Error('FileReader was aborted'));
      };

      try {
        // CRITICAL: Add timeout for FileReader operation
        const timeoutId = setTimeout(() => {
          reader.abort();
          this.debugger.log('file_reader_timeout', 'error', {
            timeoutMs: 10000,
            blobSize: blob.size
          }, 'FileReader operation timed out', startTime);
          reject(new Error('FileReader operation timed out after 10 seconds'));
        }, 10000);

        // Clear timeout on completion
        const originalOnLoadEnd = reader.onloadend;
        const originalOnError = reader.onerror;
        const originalOnAbort = reader.onabort;

        reader.onloadend = (event) => {
          clearTimeout(timeoutId);
          if (originalOnLoadEnd) originalOnLoadEnd.call(reader, event);
        };

        reader.onerror = (event) => {
          clearTimeout(timeoutId);
          if (originalOnError) originalOnError.call(reader, event);
        };

        reader.onabort = (event) => {
          clearTimeout(timeoutId);
          if (originalOnAbort) originalOnAbort.call(reader, event);
        };

        this.debugger.log('file_reader_starting', 'info', {
          method: 'readAsDataURL',
          timeoutMs: 10000
        });

        reader.readAsDataURL(blob);
      } catch (error: any) {
        this.debugger.log('file_reader_exception', 'error', {
          errorType: error.constructor.name,
          errorMessage: error.message
        }, `Exception in readAsDataURL: ${error.message}`, startTime);
        reject(new Error(`FileReader exception: ${error.message}`));
      }
    });
  }
}

// Network request debugging
export class DebugNetworkRequest {
  private debugger: AudioDebugger;
  private sessionId: string;

  constructor(sessionId: string) {
    this.debugger = AudioDebugger.getInstance();
    this.sessionId = sessionId;
  }

  async invokeFunction(functionName: string, body: any): Promise<any> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    this.debugger.log('network_request_start', 'info', {
      requestId,
      functionName,
      bodyKeys: Object.keys(body),
      bodySize: JSON.stringify(body).length
    });

    try {
      // Import here to avoid circular dependencies
      const { supabase } = await import('@/integrations/supabase/client');
      
      const response = await supabase.functions.invoke(functionName, { body });
      
      if (response.error) {
        this.debugger.log('network_request_error', 'error', {
          requestId,
          error: response.error
        }, `Function ${functionName} returned error: ${response.error.message}`, startTime);
        throw response.error;
      }

      this.debugger.log('network_request_success', 'success', {
        requestId,
        responseKeys: response.data ? Object.keys(response.data) : [],
        hasData: !!response.data
      }, undefined, startTime);

      return response;
    } catch (error: any) {
      this.debugger.log('network_request_exception', 'error', {
        requestId,
        errorType: error.constructor.name,
        errorMessage: error.message
      }, `Network request failed: ${error.message}`, startTime);
      throw error;
    }
  }
}

// Browser environment diagnostics
export function getBrowserDiagnostics() {
  const isSecure = window.isSecureContext;
  const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const isIframe = window.top !== window.self;
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  // MediaRecorder support check
  const mediaRecorderSupported = typeof MediaRecorder !== 'undefined';
  const supportedMimeTypes: string[] = [];
  
  if (mediaRecorderSupported) {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mpeg',
      'audio/wav'
    ];
    
    candidates.forEach(type => {
      if ((MediaRecorder as any).isTypeSupported?.(type)) {
        supportedMimeTypes.push(type);
      }
    });
  }

  return {
    isSecure,
    hasMediaDevices,
    isIframe,
    userAgent,
    platform,
    mediaRecorderSupported,
    supportedMimeTypes,
    isIOS: /iPad|iPhone|iPod/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
    timestamp: Date.now()
  };
}
