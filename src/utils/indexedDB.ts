import { Contract } from '../types';

const DB_NAME = 'tk_agency_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

// Helper to open IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
};

/**
 * Save an item to IndexedDB
 */
export const setItemIndexedDB = async <T>(key: string, value: T): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB setItem failed:', err);
  }
};

/**
 * Get an item from IndexedDB
 */
export const getItemIndexedDB = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB getItem failed:', err);
    return null;
  }
};

/**
 * Delete an item from IndexedDB
 */
export const removeItemIndexedDB = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB removeItem failed:', err);
  }
};

const CONTRACTS_KEY = 'tk_contracts_full';

/**
 * Persist full contracts list (including full-resolution base64 photos) to IndexedDB
 */
export const saveContractsToIndexedDB = async (contracts: Contract[]): Promise<void> => {
  await setItemIndexedDB(CONTRACTS_KEY, contracts);
};

/**
 * Retrieve full contracts list from IndexedDB
 */
export const loadContractsFromIndexedDB = async (): Promise<Contract[] | null> => {
  return await getItemIndexedDB<Contract[]>(CONTRACTS_KEY);
};

/**
 * Safely save contracts to localStorage without exceeding browser quota.
 * If contracts contain large base64 photos, strips or truncates large images
 * in the localStorage cache while IndexedDB retains the full high-res data.
 */
export const safeSaveContractsToLocalStorage = (contracts: Contract[]): void => {
  try {
    // Attempt normal direct save first
    localStorage.setItem('tk_contracts', JSON.stringify(contracts));
  } catch (quotaError) {
    console.warn('LocalStorage quota reached when saving contracts, falling back to compressed lightweight cache:', quotaError);
    
    // Clear ephemeral or bulky local keys
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('tk_cf_cvs_') || key.startsWith('tmp_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore
    }

    try {
      // Create a lightweight version where large base64 photos (> 20KB) are replaced with placeholders
      // Full photos are preserved in IndexedDB and Supabase
      const lightweightContracts = contracts.map(c => {
        const sanitized = { ...c };
        if (sanitized.passportPhoto && sanitized.passportPhoto.length > 20000 && sanitized.passportPhoto.startsWith('data:')) {
          sanitized.passportPhoto = undefined;
        }
        if (sanitized.fullBodyPhoto && sanitized.fullBodyPhoto.length > 20000 && sanitized.fullBodyPhoto.startsWith('data:')) {
          sanitized.fullBodyPhoto = undefined;
        }
        if (sanitized.facePhoto && sanitized.facePhoto.length > 50000 && sanitized.facePhoto.startsWith('data:')) {
          sanitized.facePhoto = undefined;
        }
        return sanitized;
      });

      localStorage.setItem('tk_contracts', JSON.stringify(lightweightContracts));
    } catch (secondError) {
      console.warn('Could not save even lightweight contracts to localStorage; relying on IndexedDB and Supabase:', secondError);
    }
  }
};
