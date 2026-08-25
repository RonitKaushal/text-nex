// Enhanced storage utility with multiple fallback methods
export class EnhancedStorage {
  static instance;
  
  constructor() {}
  
  static getInstance() {
    if (!EnhancedStorage.instance) {
      EnhancedStorage.instance = new EnhancedStorage();
    }
    return EnhancedStorage.instance;
  }

  // Save data to multiple storage locations
  async saveData(key, data) {
    // Clean data for serialization (remove React elements and functions)
    const cleanData = this.cleanDataForSerialization(data);
    const serializedData = JSON.stringify(cleanData);
    
    try {
      // Method 1: Electron Store (if available)
      if (window.electronAPI?.store) {
        await window.electronAPI.store.set(key, cleanData);
        console.log('✅ Saved to electron-store:', key);
      }
    } catch (error) {
      console.warn('⚠️ Electron store failed:', error);
    }

    try {
      // Method 2: localStorage
      localStorage.setItem(`textnexus-${key}`, serializedData);
      console.log('✅ Saved to localStorage:', key);
    } catch (error) {
      console.warn('⚠️ localStorage failed:', error);
    }

    try {
      // Method 3: sessionStorage as backup
      sessionStorage.setItem(`textnexus-${key}`, serializedData);
      console.log('✅ Saved to sessionStorage:', key);
    } catch (error) {
      console.warn('⚠️ sessionStorage failed:', error);
    }

    try {
      // Method 4: IndexedDB for large data
      await this.saveToIndexedDB(key, cleanData);
      console.log('✅ Saved to IndexedDB:', key);
    } catch (error) {
      console.warn('⚠️ IndexedDB failed:', error);
    }
  }

  // Clean data for serialization
  cleanDataForSerialization(data) {
    if (data === null || data === undefined) {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForSerialization(item));
    }
    
    if (typeof data === 'object') {
      const cleaned = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip React elements and functions
        if (key === 'icon' || typeof value === 'function' || 
            (typeof value === 'object' && value !== null && value.$$typeof)) {
          continue;
        }
        cleaned[key] = this.cleanDataForSerialization(value);
      }
      return cleaned;
    }
    
    return data;
  }

  // Load data from multiple storage locations
  async loadData(key) {
    let data = null;

    // Try electron-store first
    try {
      if (window.electronAPI?.store) {
        data = await window.electronAPI.store.get(key);
        if (data !== null && data !== undefined) {
          console.log('📖 Loaded from electron-store:', key);
          return data;
        }
      }
    } catch (error) {
      console.warn('⚠️ Electron store load failed:', error);
    }

    // Try IndexedDB
    try {
      data = await this.loadFromIndexedDB(key);
      if (data !== null && data !== undefined) {
        console.log('📖 Loaded from IndexedDB:', key);
        return data;
      }
    } catch (error) {
      console.warn('⚠️ IndexedDB load failed:', error);
    }

    // Try localStorage
    try {
      const stored = localStorage.getItem(`textnexus-${key}`);
      if (stored !== null) {
        data = JSON.parse(stored);
        console.log('📖 Loaded from localStorage:', key);
        return data;
      }
    } catch (error) {
      console.warn('⚠️ localStorage load failed:', error);
    }

    // Try sessionStorage as last resort
    try {
      const stored = sessionStorage.getItem(`textnexus-${key}`);
      if (stored !== null) {
        data = JSON.parse(stored);
        console.log('📖 Loaded from sessionStorage:', key);
        return data;
      }
    } catch (error) {
      console.warn('⚠️ sessionStorage load failed:', error);
    }

    console.log('❌ No data found for key:', key);
    return null;
  }

  // IndexedDB operations
  async saveToIndexedDB(key, data) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TextNexusDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'key' });
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['storage'], 'readwrite');
        const store = transaction.objectStore('storage');
        
        store.put({ key, data, timestamp: Date.now() });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  async loadFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('TextNexusDB', 1);
      
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'key' });
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['storage'], 'readonly');
        const store = transaction.objectStore('storage');
        
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          resolve(result ? result.data : null);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  // Clear all data
  async clearAll() {
    try {
      if (window.electronAPI?.store) {
        await window.electronAPI.store.clear();
      }
    } catch (error) {
      console.warn('⚠️ Electron store clear failed:', error);
    }

    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('textnexus-')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('⚠️ localStorage clear failed:', error);
    }

    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('textnexus-')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('⚠️ sessionStorage clear failed:', error);
    }
  }
}

export const storage = EnhancedStorage.getInstance();