// --- 平面圖介面 ---
// 儲存單張平面圖的資訊，包含原始檔案與預覽用的 URL
export interface FloorPlan {
  id: number;           // 唯一識別碼 (timestamp + random)
  name: string;         // 圖說名稱 (預設為檔名)
  file: File;           // 原始圖檔物件 (用於儲存至 DB)
  src: string;          // 預覽用的 Blob URL
}

// --- 專案資訊介面 ---
// 整個專案的結構，包含專案名稱與多張平面圖
export interface ProjectInfo {
  id?: string;          // IndexedDB 中的 key (通常為 'current')
  name: string;         // 專案名稱 (如：XX建案)
  floorPlans: FloorPlan[]; // 此專案包含的所有平面圖
}

// --- 標記資料介面 ---
// 使用者在表單中輸入的詳細估價資訊
export interface MarkerData {
  floor: string;        // 樓層 (例如: 1, B1, R1)
  isMezzanine: boolean; // 是否為夾層
  location: string;     // 位置描述 (例如: 主臥廁所)
  surfaceType: string;  // 施作面 (單面, 雙面, 腳踩面, 倒吊面)
  
  // 金屬管數量
  metal1: string;       // 1英吋
  metal2: string;       // 2英吋
  metal3: string;       // 3英吋
  metal4: string;       // 4英吋
  metal6: string;       // 6英吋

  // PVC管數量
  pvc1: string;         // 1英吋
  pvc2: string;         // 2英吋
  pvc3: string;         // 3英吋
  pvc4: string;         // 4英吋
  pvc6: string;         // 6英吋

  length: string;       // 開口長度
  width: string;        // 開口寬度
  tempImage: File | null; // 暫存的現場照片檔案
}

// --- 標記點介面 ---
// 在地圖上的一個標記點，包含位置座標與上述的資料
export interface Marker {
  id: number;           // 唯一識別碼 (timestamp)
  planIndex: number;    // 對應到哪一張平面圖 (ProjectInfo.floorPlans 的索引)
  x: number;            // X軸座標百分比 (0-100%)，確保縮放時位置相對正確
  y: number;            // Y軸座標百分比 (0-100%)
  seq: number;          // 流水號 (顯示在標記上的數字)
  data: MarkerData;     // 詳細資料
  imageBlob: File;      // 拍攝的照片檔案
}

// --- 視窗變換介面 ---
// 控制畫布的移動與縮放狀態
export interface Transform {
  x: number;            // X軸位移 (pixels)
  y: number;            // Y軸位移 (pixels)
  scale: number;        // 縮放倍率
}

// --- 圖片尺寸介面 ---
// 記錄當前平面圖的原始像素尺寸，用於計算相對座標
export interface ImgDimensions {
  width: number;
  height: number;
}

// --- 全域型別擴充 ---
// 為了支援透過 CDN 載入的 JSZip 與 PDF.js
declare global {
  interface Window {
    JSZip: any;
    pdfjsLib: any;
  }
}