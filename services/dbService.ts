import { ProjectInfo, Marker } from '../types';

// 資料庫設定
const DB_NAME = 'SitePhotoDB';
const DB_VERSION = 1;
const STORE_PROJECT = 'project'; // 儲存專案資訊的 Store
const STORE_MARKERS = 'markers'; // 儲存標記點的 Store

// 單例模式：儲存資料庫連線實體
let dbInstance: IDBDatabase | null = null;

const dbService = {
  // --- 初始化資料庫 ---
  // 開啟 IndexedDB 並處理版本升級 (建立 Object Stores)
  async init(): Promise<IDBDatabase> {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };
      // 當資料庫版本更新或初次建立時觸發
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // 建立專案資訊 Store
        if (!db.objectStoreNames.contains(STORE_PROJECT)) {
          db.createObjectStore(STORE_PROJECT, { keyPath: 'id' });
        }
        // 建立標記 Store
        if (!db.objectStoreNames.contains(STORE_MARKERS)) {
          db.createObjectStore(STORE_MARKERS, { keyPath: 'id' });
        }
      };
    });
  },

  // --- 儲存專案資訊 ---
  // 將專案設定 (名稱、平面圖) 存入 DB
  // 使用固定的 id: 'current'，代表目前應用程式只暫存一個專案
  async saveProject(projectInfo: ProjectInfo): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_PROJECT, 'readwrite');
      const store = tx.objectStore(STORE_PROJECT);
      // 使用 put 若存在則更新，不存在則新增
      store.put({ id: 'current', ...projectInfo });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // --- 取得專案資訊 ---
  // 讀取當前暫存的專案
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

  // --- 新增或更新標記 ---
  // 將單一標記存入 DB
  async addMarker(marker: Marker): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!dbInstance) return reject('DB not initialized');
      const tx = dbInstance.transaction(STORE_MARKERS, 'readwrite');
      const store = tx.objectStore(STORE_MARKERS);
      store.put(marker); // put 兼具新增與更新功能
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // --- 取得所有標記 ---
  // 讀取所有的標記點 (用於還原現場)
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

  // --- 清除所有資料 ---
  // 當使用者選擇重置或匯出完成後呼叫
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