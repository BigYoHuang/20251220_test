import React from 'react';
import { X, MousePointer2 } from 'lucide-react';
import { Marker } from '../types';

interface ClusterSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  markers: Marker[];
  onSelect: (marker: Marker) => void;
}

const ClusterSelectModal: React.FC<ClusterSelectModalProps> = ({
  isOpen,
  onClose,
  markers,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-yellow-400 border border-red-600 w-6 h-6 flex items-center justify-center font-bold rounded text-xs">
              {markers.length}
            </div>
            <h3 className="font-bold text-lg text-gray-800">選擇標記</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
          {markers.map((marker) => (
            <button
              key={marker.id}
              onClick={() => onSelect(marker)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 active:bg-blue-100 transition-colors border border-gray-100 shadow-sm text-left group"
            >
              <div className="bg-yellow-400 border border-red-600 w-8 h-8 flex-shrink-0 flex items-center justify-center font-bold rounded shadow-sm group-hover:scale-110 transition-transform">
                {marker.seq}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 truncate">
                   {marker.data.location || '無位置描述'}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {marker.data.floor}F {marker.data.isMezzanine ? '(夾層)' : ''} - {marker.data.surfaceType}
                </div>
              </div>
              <MousePointer2 className="text-gray-300 group-hover:text-blue-500" size={18} />
            </button>
          ))}
        </div>
        
        <div className="p-3 bg-gray-50 text-center text-xs text-gray-400">
            請選擇要查看或編輯的項目
        </div>
      </div>
    </div>
  );
};

export default ClusterSelectModal;