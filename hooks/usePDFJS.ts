import { useState, useEffect } from 'react';

// --- PDF.js 載入 Hook ---
// 動態載入 PDF 解析函式庫
const usePDFJS = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.pdfjsLib) {
      setIsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      // 設定 Worker 來源 (必須與主程式版本一致)
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      setIsLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  return isLoaded;
};

export default usePDFJS;