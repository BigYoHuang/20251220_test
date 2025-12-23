import React, { useRef, useState } from 'react';
import { X, ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import { FloorPlan } from '../types';

interface AddPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newPlans: FloorPlan[]) => void;
  isPDFLoaded: boolean;
}

const AddPlanModal: React.FC<AddPlanModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isPDFLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPlans, setPendingPlans] = useState<FloorPlan[]>([]);

  if (!isOpen) return null;

  // 處理檔案選擇 (邏輯與 SetupScreen 相同)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const newPlans: FloorPlan[] = [];
    setIsProcessing(true);

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          if (!isPDFLoaded || !window.pdfjsLib) {
            alert('PDF 模組尚未載入，請稍後再試');
            continue;
          }

          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const scale = 2.0;
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                const blob = await new Promise<Blob | null>((resolve) =>
                  canvas.toBlob(resolve, 'image/jpeg', 0.9)
                );

                if (blob) {
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
          newPlans.push({
            id: Date.now() + Math.random(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            file: file,
            src: URL.createObjectURL(file),
          });
        }
      }

      setPendingPlans((prev) => [...prev, ...newPlans]);
    } catch (e) {
      console.error(e);
      alert('檔案處理發生錯誤');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleRemovePending = (idx: number) => {
    setPendingPlans((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleNameChange = (idx: number, name: string) => {
    setPendingPlans((prev) => {
      const updated = [...prev];
      updated[idx].name = name;
      return updated;
    });
  };

  const handleConfirm = () => {
    if (pendingPlans.length === 0) return;
    onConfirm(pendingPlans);
    setPendingPlans([]); // 清空暫存
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* 標題列 */}
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg text-gray-800">新增平面圖</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 內容區域 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* 上傳區塊 */}
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
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
          </div>

          {/* 預覽與更名列表 */}
          {pendingPlans.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase">準備匯入 ({pendingPlans.length})</h4>
              {pendingPlans.map((plan, idx) => (
                <div key={plan.id} className="flex items-center bg-gray-50 border border-gray-200 p-2 rounded-lg">
                  <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0 mr-3 border border-gray-300">
                    <img src={plan.src} className="w-full h-full object-cover" alt="preview" />
                  </div>
                  <div className="flex-1">
                    <input
                      value={plan.name}
                      onChange={(e) => handleNameChange(idx, e.target.value)}
                      className="w-full text-sm font-bold text-gray-800 border-b border-transparent focus:border-blue-500 outline-none bg-transparent"
                      placeholder="輸入圖說名稱"
                    />
                  </div>
                  <button onClick={() => handleRemovePending(idx)} className="text-gray-400 hover:text-red-500 p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按鈕 */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={pendingPlans.length === 0 || isProcessing}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus size={18} />
            確認新增
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPlanModal;