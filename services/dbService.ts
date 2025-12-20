import { ProjectInfo, Marker } from '../types';

const DB_NAME = 'SitePhotoDB';
const DB_VERSION = 1;
const STORE_PROJECT = 'project';
const STORE_MARKERS = 'markers';

let dbInstance: IDBDatabase | null = null;

const dbService = {
  async init(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PROJECT)) {
          db.createObjectStore(STORE_PROJECT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_MARKERS)) {
          db.createObjectStore(STORE_MARKERS, { keyPath: 'id' });
        }
      };
    });
  },

  async saveProject(projectInfo: ProjectInfo): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_PROJECT, 'readwrite');
      const store = tx.objectStore(STORE_PROJECT);
      // Ensure we store with a fixed ID for the current project
      store.put({ id: 'current', ...projectInfo });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getProject(): Promise<ProjectInfo | undefined> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_PROJECT, 'readonly');
      const store = tx.objectStore(STORE_PROJECT);
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async addMarker(marker: Marker): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_MARKERS, 'readwrite');
      const store = tx.objectStore(STORE_MARKERS);
      store.put(marker);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllMarkers(): Promise<Marker[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_MARKERS, 'readonly');
      const store = tx.objectStore(STORE_MARKERS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction([STORE_PROJECT, STORE_MARKERS], 'readwrite');
      tx.objectStore(STORE_PROJECT).clear();
      tx.objectStore(STORE_MARKERS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

export default dbService;