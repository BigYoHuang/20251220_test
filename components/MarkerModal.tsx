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
}

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
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 border border-red-600 w-8 h-8 flex items-center justify-center font-bold rounded text-sm">
              {activeMarker?.seq}
            </div>
            <h3 className="font-bold text-lg text-gray-800">新增紀錄</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Photo Capture */}
          <div
            onClick={() => cameraInputRef.current?.click()}
            className={`w-full aspect-[4/3] rounded-xl flex items-center justify-center cursor-pointer border-2 transition-all ${
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
              <div className="flex flex-col items-center text-gray-400">
                <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                  <Camera size={32} className="text-blue-500" />
                </div>
                <span className="font-bold text-gray-500">點擊開啟相機</span>
              </div>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhotoCapture}
            />
          </div>

          {/* Form Fields */}
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

          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 6].map((num) => (
              <div key={num}>
                <label className="text-[10px] text-center text-gray-500 font-bold block mb-1">{num}"</label>
                <select
                  value={(formData as any)[`code${num}`]}
                  onChange={(e) => setFormData({ ...formData, [`code${num}`]: e.target.value })}
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