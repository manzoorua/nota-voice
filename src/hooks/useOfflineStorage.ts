import * as React from 'react';
import { useState, useEffect } from 'react';

interface OfflineNote {
  id: string;
  title: string;
  content: string;
  audioBlob?: Blob;
  createdAt: string;
  synced: boolean;
}

const DB_NAME = 'NotaVoiceOfflineDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';

export const useOfflineStorage = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingNotes, setPendingNotes] = useState<OfflineNote[]>([]);
  const [db, setDb] = useState<IDBDatabase | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    const initDB = async () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(NOTES_STORE)) {
            const store = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
            store.createIndex('createdAt', 'createdAt');
            store.createIndex('synced', 'synced');
          }
        };
      });
    };

    initDB().then(setDb).catch(console.error);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncPendingNotes();
    };
    
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending notes from IndexedDB
  useEffect(() => {
    if (db) {
      loadPendingNotes();
    }
  }, [db]);

  const loadPendingNotes = async () => {
    if (!db) return;

    try {
      const transaction = db.transaction([NOTES_STORE], 'readonly');
      const store = transaction.objectStore(NOTES_STORE);
      const index = store.index('synced');
      
      return new Promise<void>((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(false));
        
        request.onsuccess = () => {
          setPendingNotes(request.result || []);
          resolve();
        };
        
        request.onerror = () => {
          console.error('Failed to load pending notes from index');
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load pending notes:', error);
      setPendingNotes([]);
    }
  };

  const saveOfflineNote = async (note: Omit<OfflineNote, 'id' | 'synced'>): Promise<string> => {
    if (!db) throw new Error('Database not initialized');

    const noteWithId: OfflineNote = {
      ...note,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      synced: false
    };

    try {
      const transaction = db.transaction([NOTES_STORE], 'readwrite');
      const store = transaction.objectStore(NOTES_STORE);
      await store.add(noteWithId);
      
      setPendingNotes(prev => [...prev, noteWithId]);
      
      // Register for background sync
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ('sync' in registration) {
            await (registration as any).sync.register('background-sync-recordings');
          }
        } catch (error) {
          console.log('Background sync not supported');
        }
      }

      return noteWithId.id;
    } catch (error) {
      console.error('Failed to save offline note:', error);
      throw error;
    }
  };

  const getOfflineNote = async (id: string): Promise<OfflineNote | null> => {
    if (!db) return null;

    try {
      const transaction = db.transaction([NOTES_STORE], 'readonly');
      const store = transaction.objectStore(NOTES_STORE);
      const request = store.get(id);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get offline note:', error);
      return null;
    }
  };

  const markNoteAsSynced = async (id: string): Promise<void> => {
    if (!db) return;

    try {
      const transaction = db.transaction([NOTES_STORE], 'readwrite');
      const store = transaction.objectStore(NOTES_STORE);
      
      return new Promise<void>((resolve, reject) => {
        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
          const note = getRequest.result;
          if (note) {
            note.synced = true;
            const putRequest = store.put(note);
            putRequest.onsuccess = () => {
              setPendingNotes(prev => prev.filter(n => n.id !== id));
              resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
          } else {
            resolve();
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error('Failed to mark note as synced:', error);
    }
  };

  const deleteOfflineNote = async (id: string): Promise<void> => {
    if (!db) return;

    try {
      const transaction = db.transaction([NOTES_STORE], 'readwrite');
      const store = transaction.objectStore(NOTES_STORE);
      await store.delete(id);
      setPendingNotes(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete offline note:', error);
    }
  };

  const syncPendingNotes = async (): Promise<void> => {
    if (isOffline || pendingNotes.length === 0) return;

    for (const note of pendingNotes) {
      try {
        // In a real implementation, this would sync to your API
        await syncNoteToServer(note);
        await markNoteAsSynced(note.id);
      } catch (error) {
        console.error('Failed to sync note:', note.id, error);
      }
    }
  };

  const syncNoteToServer = async (note: OfflineNote): Promise<void> => {
    // Placeholder for actual API sync
    // This would upload the note to your Supabase backend
    return new Promise(resolve => setTimeout(resolve, 1000));
  };

  const getAllOfflineNotes = async (): Promise<OfflineNote[]> => {
    if (!db) return [];

    try {
      const transaction = db.transaction([NOTES_STORE], 'readonly');
      const store = transaction.objectStore(NOTES_STORE);
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all offline notes:', error);
      return [];
    }
  };

  return {
    isOffline,
    pendingNotes,
    saveOfflineNote,
    getOfflineNote,
    deleteOfflineNote,
    syncPendingNotes,
    getAllOfflineNotes,
    markNoteAsSynced
  };
};