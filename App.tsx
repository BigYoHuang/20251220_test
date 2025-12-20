import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, ChevronDown, Move, MousePointer2 } from 'lucide-react';
import useJSZip from './hooks/useJSZip';
import dbService from './services/dbService';
import SetupScreen from './components/SetupScreen';
import MarkerModal from './components/MarkerModal';
import { ProjectInfo, FloorPlan, Marker, Transform, ImgDimensions, MarkerData } from './types';

// --- Options Helpers ---
const generateFloorOptions = () => {
  const floors = [];
  for (let i = 18; i >= 1; i--) floors.push(`B${i}`);
  for (let i = 1; i <= 88; i++) floors.push(`${i}`);
  for (let i = 1; i <= 3; i++) floors.push(`R${i}`);
  return floors;
};

const FLOOR_OPTIONS = generateFloorOptions();
const NUMBER_OPTIONS = Array.from({ length: 189 }, (_, i) => i);
const Y_OFFSET = 60; // Offset in pixels (aiming above finger)

const App: React.FC = () => {
  const isZipLoaded = useJSZip();

  // --- State ---
  const [isRestoring, setIsRestoring] = useState(true);
  const [step, setStep] = useState<'setup' | 'workspace'>('setup');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', floorPlans: [] });
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [mode, setMode] = useState<'move' | 'mark'>('move');

  // Viewport
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  // Use a ref to track transform for gesture math to avoid stale state in high-freq events
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  
  const [imgDimensions, setImgDimensions] = useState<ImgDimensions>({ width: 0, height: 0 });
  
  // Refs for Touch/Gesture
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistRef = useRef<number | null>(null);
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  
  // Ref for Mark Delay
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFingerPosRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Loupe
  const [isTouching, setIsTouching] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const [imgCoord, setImgCoord] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  // Modal
  const [activeMarker, setActiveMarker] = useState<Partial<Marker> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [formData, setFormData] = useState<MarkerData>({
    floor: '1',
    isMezzanine: false,
    location: '',
    code1: '0',
    code2: '0',
    code3: '0',
    code4: '0',
    code6: '0',
    length: '0',
    width: '0',
    tempImage: null,
  });

  // --- 1. Initialization & Restore Logic ---
  useEffect(() => {
    const checkRestore = async () => {
      try {
        await dbService.init();
        const savedProject = await dbService.getProject();
        const savedMarkers = await dbService.getAllMarkers();

        if (savedProject && savedProject.floorPlans && savedProject.floorPlans.length > 0) {
          const restoredPlans = savedProject.floorPlans.map((p: FloorPlan) => ({
            ...p,
            src: URL.createObjectURL(p.file),
          }));

          setProjectInfo({ ...savedProject, floorPlans: restoredPlans });
          setMarkers(savedMarkers);
          setStep('workspace');
        }
      } catch (e) {
        console.error('Restore failed', e);
      } finally {
        setIsRestoring(false);
      }
    };
    checkRestore();
  }, []);

  // Reset transform ref when switching plans
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
    transformRef.current = { x: 0, y: 0, scale: 1 };
  }, [currentPlanIndex]);

  // --- Clustering Logic (Merged Markers) ---
  const visibleMarkers = useMemo(() => {
    const planMarkers = markers.filter(m => m.planIndex === currentPlanIndex);
    if (imgDimensions.width === 0 || imgDimensions.height === 0) return [];

    // Increased size logic: Marker size ~26px (1.3x of 20px)
    // Threshold adjusted to ~29px to account for larger markers
    const thresholdX = (29 / imgDimensions.width) * 100;
    const thresholdY = (29 / imgDimensions.height) * 100;

    interface Cluster {
      ids: number[];
      seqs: number[];
      sumX: number;
      sumY: number;
    }

    const clusters: Cluster[] = [];
    const sortedMarkers = [...planMarkers].sort((a, b) => a.seq - b.seq);

    sortedMarkers.forEach(marker => {
      const existing = clusters.find(c => {
        const cx = c.sumX / c.ids.length;
        const cy = c.sumY / c.ids.length;
        return Math.abs(cx - marker.x) < thresholdX && Math.abs(cy - marker.y) < thresholdY;
      });

      if (existing) {
        existing.ids.push(marker.id);
        existing.seqs.push(marker.seq);
        existing.sumX += marker.x;
        existing.sumY += marker.y;
      } else {
        clusters.push({
          ids: [marker.id],
          seqs: [marker.seq],
          sumX: marker.x,
          sumY: marker.y
        });
      }
    });

    return clusters.map(c => ({
      id: c.ids[0],
      x: c.sumX / c.ids.length,
      y: c.sumY / c.ids.length,
      label: c.seqs.join(','),
      isCluster: c.ids.length > 1
    }));

  }, [markers, currentPlanIndex, imgDimensions]);

  // --- Handlers: Setup ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList) as File[];
    const newPlans: FloorPlan[] = files.map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name.replace(/\.[^/.]+$/, ''),
      file: file,
      src: URL.createObjectURL(file),
    }));

    setProjectInfo((prev) => ({
      ...prev,
      floorPlans: [...prev.floorPlans, ...newPlans],
    }));
  };

  const updatePlanName = (idx: number, newName: string) => {
    const newPlans = [...projectInfo.floorPlans];
    newPlans[idx].name = newName;
    setProjectInfo({ ...projectInfo, floorPlans: newPlans });
  };

  const removePlan = (index: number) => {
    const newPlans = [...projectInfo.floorPlans];
    newPlans.splice(index, 1);
    setProjectInfo((prev) => ({ ...prev, floorPlans: newPlans }));
  };

  const startProject = async () => {
    if (!projectInfo.name || projectInfo.floorPlans.length === 0) {
      alert('請輸入專案名稱並至少匯入一張平面圖');
      return;
    }
    await dbService.saveProject(projectInfo);
    setStep('workspace');
  };

  const handleReset = async () => {
    if (confirm('確定要清除所有舊資料並開始新專案嗎？此動作無法復原。')) {
      await dbService.clearAll();
      window.location.reload();
    }
  };

  // --- Handlers: Canvas Interaction ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // If we were waiting to mark, cancel it immediately
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
        markTimeoutRef.current = null;
      }
      setIsTouching(false);

      // Pinch start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      lastDistRef.current = dist;
      lastCenterRef.current = { x: centerX, y: centerY };

    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      
      if (mode === 'mark') {
        // Start a delay before activating mark mode to distinguish from pinch start
        currentFingerPosRef.current = { clientX: touch.clientX, clientY: touch.clientY };
        
        markTimeoutRef.current = setTimeout(() => {
          setIsTouching(true);
          // Use the latest tracked position (from move) or the initial start position
          const pos = currentFingerPosRef.current || { clientX: touch.clientX, clientY: touch.clientY };
          // We must reconstruct a mock touch object or adjust updateLoupe to accept coords
          updateLoupe(pos); 
        }, 100); // 100ms tolerance

      } else {
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // --- Simultaneous Pan & Zoom ---
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      // Initialize refs if starting gesture mid-stream
      if (!lastDistRef.current || !lastCenterRef.current) {
        lastDistRef.current = dist;
        lastCenterRef.current = { x: midX, y: midY };
        return;
      }

      const currentT = transformRef.current;
      const scaleFactor = dist / lastDistRef.current;
      
      let newScale = currentT.scale * scaleFactor;
      newScale = Math.min(Math.max(newScale, 0.1), 20);
      
      const effectiveScaleFactor = newScale / currentT.scale;

      const newX = midX - (lastCenterRef.current.x - currentT.x) * effectiveScaleFactor;
      const newY = midY - (lastCenterRef.current.y - currentT.y) * effectiveScaleFactor;

      const newTransform = { x: newX, y: newY, scale: newScale };
      
      setTransform(newTransform);
      transformRef.current = newTransform;
      
      lastDistRef.current = dist;
      lastCenterRef.current = { x: midX, y: midY };

    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      
      if (mode === 'mark') {
        currentFingerPosRef.current = { clientX: touch.clientX, clientY: touch.clientY };
        // Only update if the timeout has fired and we are officially "touching/marking"
        if (isTouching) {
          updateLoupe({ clientX: touch.clientX, clientY: touch.clientY });
        }
      } else if (mode === 'move') {
        const last = lastTouchRef.current;
        if (last) {
          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;
          
          const currentT = transformRef.current;
          const newTransform = { ...currentT, x: currentT.x + dx, y: currentT.y + dy };
          
          setTransform(newTransform);
          transformRef.current = newTransform;
          lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    }
  };

  const handleTouchEnd = () => {
    // Clear timeout if user lifts finger before 100ms
    if (markTimeoutRef.current) {
      clearTimeout(markTimeoutRef.current);
      markTimeoutRef.current = null;
    }

    lastDistRef.current = null;
    lastTouchRef.current = null;
    lastCenterRef.current = null;

    if (mode === 'mark' && isTouching) {
      setIsTouching(false);
      if (imgCoord.x !== null && imgCoord.y !== null) {
        openNewMarkerModal(imgCoord as { x: number; y: number });
      }
    }
  };

  const updateLoupe = (pos: { clientX: number; clientY: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // UI Position: Follow the finger exactly (so the circle sits on top of finger)
    const touchX = pos.clientX - rect.left;
    const touchY = pos.clientY - rect.top;
    setTouchPos({ x: touchX, y: touchY });

    // Logic Position: Aim 60px ABOVE the finger
    const effectiveY = touchY - Y_OFFSET;

    const currentT = transformRef.current;
    const rawX = (touchX - currentT.x) / currentT.scale;
    const rawY = (effectiveY - currentT.y) / currentT.scale;

    if (
      rawX >= 0 &&
      rawX <= imgDimensions.width &&
      rawY >= 0 &&
      rawY <= imgDimensions.height
    ) {
      setImgCoord({ x: rawX, y: rawY });
    } else {
      setImgCoord({ x: null, y: null });
    }
  };

  // --- Handlers: Marker & Form ---
  const openNewMarkerModal = (coord: { x: number; y: number }) => {
    const maxSeq = markers.reduce((max, m) => Math.max(max, m.seq), 0);
    const nextSeq = maxSeq + 1;

    const xPct = (coord.x / imgDimensions.width) * 100;
    const yPct = (coord.y / imgDimensions.height) * 100;

    setActiveMarker({
      id: Date.now(),
      planIndex: currentPlanIndex,
      x: xPct,
      y: yPct,
      seq: nextSeq,
    });

    setFormData((prev) => ({
      ...prev,
      location: '',
      length: '0',
      width: '0',
      code1: '0',
      code2: '0',
      code3: '0',
      code4: '0',
      code6: '0',
      tempImage: null,
    }));

    setIsModalOpen(true);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, tempImage: file }));
    }
  };

  const saveMarker = async () => {
    if (!formData.tempImage) {
      alert('請拍攝或上傳照片');
      return;
    }
    if (!formData.location) {
      alert('請輸入位置');
      return;
    }

    if (!activeMarker) return;

    const newMarker: Marker = {
      ...(activeMarker as Marker),
      data: { ...formData },
      imageBlob: formData.tempImage,
    };

    setMarkers((prev) => [...prev, newMarker]);
    await dbService.addMarker(newMarker);
    setIsModalOpen(false);
    setActiveMarker(null);
    setMode('move');
  };

  // --- Export Logic ---
  const getMarkerFileName = (m: Marker) => {
    const d = m.data;
    let floorStr = d.floor;
    if (d.isMezzanine) floorStr = `${d.floor}M`;
    floorStr += 'F';
    const seqStr = String(m.seq).padStart(3, '0');
    return `${seqStr}_${floorStr}_${d.location}_${d.code1}_${d.code2}_${d.code3}_${d.code4}_${d.code6}_${d.length}_${d.width}`;
  };

  const handleExport = async () => {
    if (!window.JSZip) {
      alert('匯出模組尚未載入，請稍候再試');
      return;
    }

    const zip = new window.JSZip();
    const folderName = projectInfo.name || 'Project';
    const mainFolder = zip.folder(folderName);
    const photosFolder = mainFolder.folder('photos');
    const mapsFolder = mainFolder.folder('maps');

    markers.forEach((m) => {
      const fileName = getMarkerFileName(m) + '.jpg';
      photosFolder.file(fileName, m.imageBlob);
    });

    const uniquePlansIndices = [...new Set(markers.map((m) => m.planIndex))];
    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (const planIndex of uniquePlansIndices) {
      const plan = projectInfo.floorPlans[planIndex];
      const planMarkers = markers.filter((m) => m.planIndex === planIndex);

      try {
        const img = await loadImage(plan.src);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0);

          planMarkers.forEach((m) => {
            const x = (m.x / 100) * canvas.width;
            const y = (m.y / 100) * canvas.height;
            // Draw marker on exported image (scale size appropriately?)
            // Using slightly larger size for readability on export
            const size = Math.max(30, canvas.width * 0.02);

            ctx.fillStyle = '#FFFF00';
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = size * 0.15;
            ctx.beginPath();
            ctx.rect(x - size / 2, y - size / 2, size, size);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.font = `bold ${size * 0.7}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(m.seq), x, y);
          });

          const mapBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg')
          );
          if (mapBlob) {
            mapsFolder.file(`${plan.name}_marked.jpg`, mapBlob);
          }
        }
      } catch (e) {
        console.error('Error generating map', e);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${folderName}_Export.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(async () => {
      if (
        confirm(
          '匯出成功！是否要清除暫存資料並結束此專案？(若還需要繼續編輯請按取消)'
        )
      ) {
        await dbService.clearAll();
        window.location.reload();
      }
    }, 500);
  };

  // --- RENDER ---
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        載入中...
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <SetupScreen
        projectInfo={projectInfo}
        setProjectInfo={setProjectInfo}
        onFileUpload={handleFileUpload}
        onUpdatePlanName={updatePlanName}
        onRemovePlan={removePlan}
        onStart={startProject}
        onReset={handleReset}
      />
    );
  }

  const currentPlan = projectInfo.floorPlans[currentPlanIndex];

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-md z-20 flex items-center justify-between shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-gray-500 font-bold truncate max-w-[150px]">
            {projectInfo.name}
          </span>
          <div className="relative inline-flex items-center">
            <select
              value={currentPlanIndex}
              onChange={(e) => {
                setCurrentPlanIndex(Number(e.target.value));
              }}
              className="font-bold text-lg bg-transparent pr-6 outline-none appearance-none truncate max-w-[200px]"
            >
              {projectInfo.floorPlans.map((p, i) => (
                <option key={p.id} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 w-4 h-4 pointer-events-none text-gray-500" />
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={!isZipLoaded}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition ${
            isZipLoaded ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
          }`}
        >
          <Download size={18} />
          <span>匯出</span>
        </button>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#2a2a2a] touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          className="absolute top-0 left-0"
        >
          <img
            src={currentPlan.src}
            alt="Floor Plan"
            className="max-w-none pointer-events-none select-none block"
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              const imgW = img.width;
              const imgH = img.height;
              setImgDimensions({ width: imgW, height: imgH });
              if (containerRef.current) {
                const containerW = containerRef.current.clientWidth;
                const scale = containerW / imgW;
                setTransform({ x: 0, y: 0, scale });
                transformRef.current = { x: 0, y: 0, scale };
              }
            }}
          />
          {/* Markers Layer (Using Clustered Markers) */}
          {/* Size Increased: min-w-[1.625rem] (26px), text-[13px] */}
          {visibleMarkers.map((m) => (
              <div
                key={m.id}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[1.625rem] h-[1.625rem] px-1 bg-yellow-400 border border-red-600 flex items-center justify-center text-[13px] font-bold text-black shadow-sm z-10 whitespace-nowrap`}
              >
                {m.label}
              </div>
            ))}
        </div>

        {/* Loupe */}
        {isTouching && mode === 'mark' && imgCoord.x !== null && (
          <div
            className="absolute pointer-events-none rounded-full border-4 border-white shadow-2xl overflow-hidden bg-gray-100 z-50 flex items-center justify-center"
            style={{
              width: '140px',
              height: '140px',
              left: touchPos.x - 70,
              top: touchPos.y - 180,
            }}
          >
            <div className="relative w-full h-full overflow-hidden bg-black">
              {/* Inner container to move both image and markers together */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: imgDimensions.width * 2,
                  height: imgDimensions.height * 2,
                  // Apply Y_OFFSET compensation to the image inside the loupe too so the center crosshair aligns
                  transform: `translate(${-(imgCoord.x || 0) * 2 + 70}px, ${
                    -(imgCoord.y || 0) * 2 + 70
                  }px)`,
                }}
              >
                <img
                  src={currentPlan.src}
                  alt="magnified"
                  style={{
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                  }}
                />
                {/* Render markers inside loupe with larger size */}
                {visibleMarkers.map((m) => (
                  <div
                    key={`loupe-${m.id}`}
                    style={{ left: `${m.x}%`, top: `${m.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[1.625rem] h-[1.625rem] px-1 bg-yellow-400 border border-red-600 flex items-center justify-center text-[13px] font-bold text-black shadow-sm whitespace-nowrap`}
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-0.5 h-6 bg-red-500/80 absolute"></div>
                <div className="w-6 h-0.5 bg-red-500/80 absolute"></div>
                <div className="w-2 h-2 border border-red-500 rounded-full absolute"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-white pb-safe pt-2 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-around items-center border-t shrink-0 z-20">
        <button
          onClick={() => setMode('move')}
          className={`flex-1 flex flex-col items-center py-3 rounded-lg transition-all duration-200 ${
            mode === 'move'
              ? 'bg-blue-50 text-blue-600 translate-y-[-2px]'
              : 'text-gray-400'
          }`}
        >
          <Move className={`mb-1 ${mode === 'move' ? 'scale-110' : ''}`} />
          <span className="text-xs font-bold">移動/縮放</span>
        </button>

        <div className="w-px h-8 bg-gray-200 mx-2"></div>

        <button
          onClick={() => setMode('mark')}
          className={`flex-1 flex flex-col items-center py-3 rounded-lg transition-all duration-200 ${
            mode === 'mark'
              ? 'bg-red-50 text-red-600 translate-y-[-2px]'
              : 'text-gray-400'
          }`}
        >
          <MousePointer2
            className={`mb-1 ${mode === 'mark' ? 'scale-110' : ''}`}
          />
          <span className="text-xs font-bold">選取位置 (按住)</span>
        </button>
      </div>

      {/* Modal */}
      <MarkerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeMarker={activeMarker}
        formData={formData}
        setFormData={setFormData}
        onSave={saveMarker}
        onPhotoCapture={handlePhotoCapture}
        FLOOR_OPTIONS={FLOOR_OPTIONS}
        NUMBER_OPTIONS={NUMBER_OPTIONS}
      />
    </div>
  );
};

export default App;