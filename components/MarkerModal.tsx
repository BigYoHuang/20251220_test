import React, { useRef } from 'react';
import { X, Camera, Check } from 'lucide-react';
import { Marker, MarkerData } from '../types';

interface MarkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMarker: Partial<Marker> | null;
  formData: MarkerData;
  setFormData: React.Dispatch<React.SetStateAction<MarkerData>>;
  onSave: () => void;
  onPhotoCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  FLOOR_OPTIONS: string[];
  NUMBER_OPTIONS: number[];
  isEditing?: boolean; // 判斷是新增還是編輯模式
}

// --- 標記資料編輯彈窗 ---
// 提供使用者輸入估價資料、拍攝照片的介面
const MarkerModal: React.FC<MarkerModalProps> = ({
  isOpen,
  onClose,
  activeMarker,
  formData,
  setFormData,
  onSave,
  onPhotoCapture,
  FLOOR_OPTIONS,
  NUMBER_OPTIONS,
  isEditing = false,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const PIPES = [1, 2, 3, 4, 6];

  // 處理互斥按鈕邏輯
  const toggleIncomplete = () => {
    setFormData((prev) => ({
      ...prev,
      isIncomplete: !prev.isIncomplete,
      // 如果開啟了"不完整"，強制關閉"無防火帶"
      noFireBarrier: !prev.isIncomplete ? false : prev.noFireBarrier,
    }));
  };

  const toggleNoFireBarrier = () => {
    setFormData((prev) => ({
      ...prev,
      noFireBarrier: !prev.noFireBarrier,
      // 如果開啟了"無防火帶"，強制關閉"不完整"
      isIncomplete: !prev.noFireBarrier ? false : prev.isIncomplete,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        {/* 標題列 */}
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 border border-red-600 w-8 h-8 flex items-center justify-center font-bold rounded text-sm">
              {activeMarker?.seq}
            </div>
            <h3 className="font-bold text-lg text-gray-800">{isEditing ? '編輯紀錄' : '新增紀錄'}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X />
          </button>
        </div>

        {/* 內容區塊 */}
        <div className="p-5 space-y-5">
          {/* 拍照/預覽區塊 */}
          <div
            onClick={() => cameraInputRef.current?.click()}
            className={`w-full h-36 rounded-xl flex items-center justify-center cursor-pointer border-2 transition-all ${
              formData.tempImage
                ? 'border-green-500 border-solid bg-green-50'
                : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            {formData.tempImage ? (
              <div className="relative w-full h-full p-1">
                <img
                  src={URL.createObjectURL(formData.tempImage)}
                  className="w-full h-full object-contain rounded-lg shadow-sm"
                  alt="Captured"
                />
                <div className="absolute bottom-3 right-3 bg-green-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 font-bold shadow-md">
                  <Check size={14} strokeWidth={3} /> 已拍攝
                </div>
              </div>
            ) : (
              <div className="flex flex-row items-center justify-center gap-3 text-gray-400">
                <div className="bg-white p-2 rounded-full shadow-sm">
                  <Camera size={24} className="text-blue-500" />
                </div>
                <span className="font-bold text-gray-500">點擊開啟相機</span>
              </div>
            )}
            {/* 隱藏的檔案輸入框，支援相機 capture */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhotoCapture}
            />
          </div>

          {/* 樓層與夾層設定 */}
          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1.5">樓層</label>
              <select
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full border-gray-300 border p-3 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                {FLOOR_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}F
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1.5">夾層</label>
              <button
                onClick={() => setFormData((prev) => ({ ...prev, isMezzanine: !prev.isMezzanine }))}
                className={`h-[46px] px-6 rounded-lg border font-bold transition-all ${
                  formData.isMezzanine
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-gray-500 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {formData.isMezzanine ? '是 (M)' : '否'}
              </button>
            </div>
          </div>

          {/* 位置描述輸入 */}
          <div>
            <label className="text-xs text-gray-500 font-bold block mb-1.5">位置描述</label>
            <input
              type="text"
              placeholder="例如：主臥廁所"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full border-gray-300 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 金屬管數量選擇 */}
          <div className="space-y-2">
            <span className="text-xs text-gray-500 font-bold block">金屬管</span>
            <div className="grid grid-cols-5 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              {PIPES.map((num) => (
                <div key={`metal-${num}`}>
                  <label className="text-[10px] text-center text-gray-400 font-bold block mb-1">{num}"</label>
                  <select
                    value={(formData as any)[`metal${num}`]}
                    onChange={(e) => setFormData({ ...formData, [`metal${num}`]: e.target.value })}
                    className="w-full border-gray-300 border p-1.5 rounded bg-white text-sm text-center focus:border-blue-500 outline-none"
                  >
                    {NUMBER_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* PVC管數量選擇 */}
          <div className="space-y-2">
            <span className="text-xs text-gray-500 font-bold block">PVC管</span>
            <div className="grid grid-cols-5 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              {PIPES.map((num) => (
                <div key={`pvc-${num}`}>
                  <label className="text-[10px] text-center text-gray-400 font-bold block mb-1">{num}"</label>
                  <select
                    value={(formData as any)[`pvc${num}`]}
                    onChange={(e) => setFormData({ ...formData, [`pvc${num}`]: e.target.value })}
                    className="w-full border-gray-300 border p-1.5 rounded bg-white text-sm text-center focus:border-blue-500 outline-none"
                  >
                    {NUMBER_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 長寬輸入 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1.5">長</label>
              <input
                type="number"
                value={formData.length}
                onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                className="w-full border-gray-300 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold block mb-1.5">寬</label>
              <input
                type="number"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                className="w-full border-gray-300 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 施作面選擇 (四選一) */}
          <div>
            <label className="text-xs text-gray-500 font-bold block mb-1.5">施作面</label>
            <div className="grid grid-cols-4 gap-2">
              {['單面', '雙面', '腳踩面', '倒吊面'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFormData({ ...formData, surfaceType: type })}
                  className={`py-3 rounded-lg font-bold text-xs sm:text-sm transition-all border ${
                    formData.surfaceType === type
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 不完整 / 無防火帶 互斥按鈕 */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <button
              onClick={toggleIncomplete}
              className={`py-3 rounded-lg font-bold text-sm transition-all border ${
                formData.isIncomplete
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              不完整
            </button>
            <button
              onClick={toggleNoFireBarrier}
              className={`py-3 rounded-lg font-bold text-sm transition-all border ${
                formData.noFireBarrier
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              無防火帶
            </button>
          </div>

          {/* 底部按鈕 */}
          <div className="pt-2 pb-6">
            <button
              onClick={onSave}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition hover:bg-blue-700"
            >
              儲存並返回地圖
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkerModal;