import React, { useRef, useState } from 'react';
import { Trash2, ImageIcon, X, FolderOpen, Loader2 } from 'lucide-react';
import { ProjectInfo, FloorPlan } from '../types';

interface SetupScreenProps {
  projectInfo: ProjectInfo;
  setProjectInfo: React.Dispatch<React.SetStateAction<ProjectInfo>>;
  onFileUpload: (newPlans: FloorPlan[]) => void; // 更新型別定義
  onUpdatePlanName: (idx: number, name: string) => void;
  onRemovePlan: (idx: number) => void;
  onStart: () => void;
  onReset: () => void;
  onLoadProject: (file: File) => void;
  isZipLoaded: boolean;
  isPDFLoaded: boolean; // 傳入 PDF 載入狀態
}

// --- 設定頁面元件 ---
// 這是應用程式的第一個畫面，讓使用者輸入專案名稱並上傳平面圖
const SetupScreen: React.FC<SetupScreenProps> = ({
  projectInfo,
  setProjectInfo,
  onFileUpload,
  onUpdatePlanName,
  onRemovePlan,
  onStart,
  onReset,
  onLoadProject,
  isZipLoaded,
  isPDFLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false); // PDF 處理中狀態

  // 處理檔案上傳 (圖片或 PDF)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const newPlans: FloorPlan[] = [];
    setIsProcessing(true);

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          // --- 處理 PDF 檔案 ---
          if (!isPDFLoaded || !window.pdfjsLib) {
            alert('PDF 模組尚未載入，請稍後再試');
            continue;
          }

          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
            
            // 遍歷每一頁
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              // 設定 2倍縮放，確保轉出的圖片夠清晰
              const scale = 2.0; 
              const viewport = page.getViewport({ scale });
              
              // 建立 Canvas 進行繪製
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (context) {
                await page.render({
                  canvasContext: context,
                  viewport: viewport,
                }).promise;

                // Canvas 轉 Blob
                const blob = await new Promise<Blob | null>((resolve) => 
                  canvas.toBlob(resolve, 'image/jpeg', 0.9)
                );

                if (blob) {
                  // 將 Blob 轉為 File 物件
                  const imgFile = new File([blob], `${file.name}_Page${i}.jpg`, { type: 'image/jpeg' });
                  newPlans.push({
                    id: Date.now() + Math.random(),
                    name: `${file.name.replace('.pdf', '')}_P${i}`,
                    file: imgFile,
                    src: URL.createObjectURL(imgFile),
                  });
                }
              }
            }
          } catch (err) {
            console.error('Error parsing PDF:', err);
            alert(`無法讀取 PDF 檔案: ${file.name}`);
          }

        } else if (file.type.startsWith('image/')) {
          // --- 處理一般圖片 ---
          newPlans.push({
            id: Date.now() + Math.random(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            file: file,
            src: URL.createObjectURL(file),
          });
        }
      }

      // 透過 callback 更新狀態
      if (newPlans.length > 0) {
        onFileUpload(newPlans);
      }

    } catch (e) {
      console.error(e);
      alert('檔案處理發生錯誤');
    } finally {
      setIsProcessing(false);
      // 清空 input 讓同檔名可再次選取
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 space-y-6 relative">
        {/* 清除重置按鈕 */}
        <button
          onClick={onReset}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
          title="清除暫存資料"
        >
          <Trash2 size={20} />
        </button>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">工地現場紀錄</h1>
          <p className="text-gray-500 text-sm mt-1">建立新專案 或 開啟舊專案</p>
        </div>

        {/* 開啟舊專案按鈕 */}
        <div className="pb-4 border-b border-gray-100">
          <button
            onClick={() => projectInputRef.current?.click()}
            disabled={!isZipLoaded}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition disabled:opacity-50"
          >
            <FolderOpen size={20} />
            <span>開啟專案檔 (.siteproj)</span>
          </button>
          <input
            ref={projectInputRef}
            type="file"
            accept=".siteproj,.zip" 
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onLoadProject(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* 專案名稱輸入框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱 (新專案)</label>
          <input
            type="text"
            className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="例如：XX建案_B棟"
            value={projectInfo.name}
            onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
          />
        </div>

        {/* 檔案上傳區塊 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">匯入平面圖</label>
          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition group ${
               isProcessing 
                 ? 'border-gray-200 bg-gray-50 cursor-wait' 
                 : 'border-gray-300 hover:bg-blue-50 hover:border-blue-300'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center py-2">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                <span className="text-sm text-gray-500 font-bold">正在處理檔案...</span>
              </div>
            ) : (
              <>
                <div className="bg-gray-100 p-3 rounded-full mb-2 group-hover:bg-white transition">
                  <ImageIcon className="w-6 h-6 text-gray-500 group-hover:text-blue-500" />
                </div>
                <span className="text-sm font-medium text-gray-600">點擊上傳 JPG/PNG/PDF</span>
                <span className="text-xs text-gray-400 mt-1">PDF將自動轉換為圖片</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf" // 增加 PDF 支援
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* 已上傳平面圖列表 */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {projectInfo.floorPlans.map((plan, idx) => (
            <div key={plan.id} className="flex items-center bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
              <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 mr-3">
                <img src={plan.src} className="w-full h-full object-cover" alt="preview" />
              </div>
              <div className="flex-1">
                <input
                  value={plan.name}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => onUpdatePlanName(idx, e.target.value)}
                  className="w-full text-sm font-medium text-gray-800 border-b border-transparent focus:border-blue-500 outline-none bg-transparent"
                  placeholder="輸入圖說名稱"
                />
              </div>
              <button onClick={() => onRemovePlan(idx)} className="text-gray-400 hover:text-red-500 p-2 transition-colors">
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        {/* 開始按鈕 */}
        <button
          onClick={onStart}
          disabled={!projectInfo.name || projectInfo.floorPlans.length === 0 || isProcessing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          開始作業 / 儲存設定
        </button>
      </div>
    </div>
  );
};

export default SetupScreen;