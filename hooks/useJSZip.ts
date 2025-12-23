import { useState, useEffect } from 'react';

// --- JSZip 載入 Hook ---
// 為了避免將肥大的 JSZip 函式庫打包進主 Bundle，
// 這裡採用動態插入 script 標籤的方式從 CDN 載入 JSZip。
const useJSZip = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 如果 window 物件中已經有 JSZip (可能已被載入過)，直接設為 true
    if (window.JSZip) {
      setIsLoaded(true);
      return;
    }
    // 動態建立 script 標籤
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => setIsLoaded(true); // 載入完成後更新狀態
    document.head.appendChild(script);
  }, []);

  return isLoaded; // 回傳載入狀態，供 UI 判斷是否啟用匯出按鈕
};

export default useJSZip;