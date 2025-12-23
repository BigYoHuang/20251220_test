import React, { useRef } from 'react';
import { Trash2, ImageIcon, X } from 'lucide-react';
import { ProjectInfo } from '../types';

interface SetupScreenProps {
  projectInfo: ProjectInfo;
  setProjectInfo: React.Dispatch<React.SetStateAction<ProjectInfo>>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdatePlanName: (idx: number, name: string) => void;
  onRemovePlan: (idx: number) => void;
  onStart: () => void;
  onReset: () => void;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          <p className="text-gray-500 text-sm mt-1">建立專案並匯入圖說</p>
        </div>

        {/* 專案名稱輸入框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">專案名稱</label>
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
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition group"
          >
            <div className="bg-gray-100 p-3 rounded-full mb-2 group-hover:bg-white transition">
              <ImageIcon className="w-6 h-6 text-gray-500 group-hover:text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">點擊上傳 JPG/PNG</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={onFileUpload}
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
          disabled={!projectInfo.name || projectInfo.floorPlans.length === 0}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          開始作業 / 儲存設定
        </button>
      </div>
    </div>
  );
};

export default SetupScreen;