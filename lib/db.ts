import { Presentation } from "./types";

const DB_NAME = "ppt-maker-db";
const DB_VERSION = 1;
const STORE_NAME = "presentations";

export interface HistoryRecord {
  id: string;
  timestamp: number;
  presentation: Presentation;
  thumbnail?: string; // First slide image
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

export const savePresentationToHistory = async (
  presentation: Presentation
): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: HistoryRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      presentation,
      thumbnail: presentation.slides[0]?.imageUrl,
    };

    // Check if we already have a record for this presentation (based on title maybe? or just always new?)
    // For now, let's just add a new record.
    // Ideally we might want to update if it's the same session, but "History" usually implies snapshots.
    // However, to avoid spamming history on every auto-save, we might want to be careful.
    // But the requirement says "History record list shows...".
    // Let's assume we save when entering the editor or manually.
    // Actually, the requirement says "History records are saved in local storage" (now IndexedDB).
    // Let's provide a way to save.

    return new Promise((resolve, reject) => {
      const request = store.add(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject("Error saving presentation");
    });
  } catch (error) {
    console.error("Error saving to history:", error);
    throw error;
  }
};

export const getHistory = async (): Promise<HistoryRecord[]> => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as HistoryRecord[];
        // Sort by timestamp desc
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject("Error fetching history");
    });
  } catch (error) {
    console.error("Error getting history:", error);
    throw error;
  }
};

export const deleteHistoryRecord = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject("Error deleting record");
    });
  } catch (error) {
    console.error("Error deleting history record:", error);
    throw error;
  }
};
