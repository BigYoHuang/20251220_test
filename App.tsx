import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, ChevronDown, Move, MousePointer2, Save, LogOut } from 'lucide-react';
import useJSZip from './hooks/useJSZip';
import dbService from './services/dbService';
import SetupScreen from './components/SetupScreen';
import MarkerModal from './components/MarkerModal';
import ClusterSelectModal from './components/ClusterSelectModal';
import { ProjectInfo, FloorPlan, Marker, Transform, ImgDimensions, MarkerData } from './types';

// --- 選項產生輔助函式 ---
const generateFloorOptions = () => {
  const floors = [];
  // 產生 B18 到 B1
  for (let i = 18; i >= 1; i--) floors.push(`B${i}`);
  // 產生 1 到 88
  for (let i = 1; i <= 88; i++) floors.push(`${i}`);
  // 產生 R1 到 R3
  for (let i = 1; i <= 3; i++) floors.push(`R${i}`);
  return floors;
};

const FLOOR_OPTIONS = generateFloorOptions();
const NUMBER_OPTIONS = Array.from({ length: 189 }, (_, i) => i); // 0-188 的數字選項
const Y_OFFSET = 30; // 放大鏡位移 (讓放大鏡顯示在手指上方，避免被手指遮擋)

const App: React.FC = () => {
  const isZipLoaded = useJSZip(); // 檢查 JSZip 是否載入完成

  // --- 狀態管理 (State) ---
  const [isRestoring, setIsRestoring] = useState(true); // 是否正在還原資料庫狀態
  const [step, setStep] = useState<'setup' | 'workspace'>('setup'); // 當前步驟：設定頁面或工作區
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', floorPlans: [] });
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0); // 目前顯示的平面圖索引
  const [markers, setMarkers] = useState<Marker[]>([]); // 所有的標記點
  const [mode, setMode] = useState<'move' | 'mark'>('move'); // 操作模式：移動/縮放 或 標記模式

  // --- 視窗/畫布狀態 ---
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 }); // 畫布的位移與縮放
  // 使用 useRef 來追蹤 transform，以避免在高頻率的手勢事件(touchmove)中讀取到舊的 state
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  
  const [imgDimensions, setImgDimensions] = useState<ImgDimensions>({ width: 0, height: 0 }); // 圖片原始尺寸
  
  // --- 手勢操作 Refs ---
  const containerRef = useRef<HTMLDivElement>(null); // 畫布容器 Ref
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null); // 上一次單指觸控的位置 (用於平移)
  const lastDistRef = useRef<number | null>(null); // 上一次雙指距離 (用於縮放)
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null); // 上一次雙指中心點
  
  // --- 標記延遲 Refs ---
  const markTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 長按判斷用的計時器
  const currentFingerPosRef = useRef<{ clientX: number; clientY: number } | null>(null); // 當前手指位置

  // --- 記憶功能 Refs ---
  // 用來記憶最後一次輸入的位置描述
  const lastLocationRef = useRef<string>('');

  // --- 放大鏡 (Loupe) 狀態 ---
  const [isTouching, setIsTouching] = useState(false); // 是否正在觸控 (用於顯示放大鏡)
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 }); // 觸控點在螢幕上的位置
  const [imgCoord, setImgCoord] = useState<{ x: number | null; y: number | null }>({ x: null, y: null }); // 觸控點對應到圖片的原始座標

  // --- 彈窗 (Modal) 狀態 ---
  const [activeMarker, setActiveMarker] = useState<Partial<Marker> | null>(null); // 當前正在編輯/新增的標記
  const [isModalOpen, setIsModalOpen] = useState(false); // 標記編輯視窗開關
  const [showExitDialog, setShowExitDialog] = useState(false); // 是否顯示退出確認視窗
  
  // --- 聚合選擇視窗狀態 ---
  const [clusterModalState, setClusterModalState] = useState<{ isOpen: boolean; markers: Marker[] }>({
    isOpen: false,
    markers: [],
  });

  // --- 表單資料狀態 ---
  const [formData, setFormData] = useState<MarkerData>({
    floor: '1',
    isMezzanine: false,
    location: '',
    surfaceType: '雙面',
    code1: '0',
    code2: '0',
    code3: '0',
    code4: '0',
    code6: '0',
    length: '0',
    width: '0',
    tempImage: null,
  });

  // 判斷當前是否正在編輯已存在的標記 (而非新增)
  const isEditing = useMemo(() => {
    return activeMarker && markers.some(m => m.id === activeMarker.id);
  }, [activeMarker, markers]);

  // --- 1. 初始化與資料還原 ---
  useEffect(() => {
    const checkRestore = async () => {
      try {
        await dbService.init();
        // 從 IndexedDB 讀取專案與標記資料
        const savedProject = await dbService.getProject();
        const savedMarkers = await dbService.getAllMarkers();

        if (savedProject && savedProject.floorPlans && savedProject.floorPlans.length > 0) {
          // 重建 Blob URL
          const restoredPlans = savedProject.floorPlans.map((p: FloorPlan) => ({
            ...p,
            src: URL.createObjectURL(p.file),
          }));

          setProjectInfo({ ...savedProject, floorPlans: restoredPlans });
          setMarkers(savedMarkers);
          
          // 如果有舊資料，找出最後一筆新增的紀錄，將其位置描述記下來
          if (savedMarkers.length > 0) {
            // 依據 ID (時間戳) 找出最新的一筆
            const lastMarker = savedMarkers.reduce((prev, current) => (prev.id > current.id) ? prev : current);
            if (lastMarker && lastMarker.data.location) {
              lastLocationRef.current = lastMarker.data.location;
            }
          }

          setStep('workspace'); // 如果有舊資料，直接進入工作區
        }
      } catch (e) {
        console.error('Restore failed', e);
      } finally {
        setIsRestoring(false);
      }
    };
    checkRestore();
  }, []);

  // 切換平面圖時，重置縮放與位移
  useEffect(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
    transformRef.current = { x: 0, y: 0, scale: 1 };
  }, [currentPlanIndex]);

  // --- 聚合 (Cluster) 邏輯 ---
  // 計算在當前視圖中，哪些標記重疊在一起，將它們合併顯示
  const visibleMarkers = useMemo(() => {
    const planMarkers = markers.filter(m => m.planIndex === currentPlanIndex);
    if (imgDimensions.width === 0 || imgDimensions.height === 0) return [];

    // 計算聚合閾值：大約 29px 的範圍 (配合標記尺寸)
    const thresholdX = (29 / imgDimensions.width) * 100;
    const thresholdY = (29 / imgDimensions.height) * 100;

    interface Cluster {
      ids: number[]; // 聚合中包含的標記 ID 列表
      seqs: number[]; // 聚合中包含的標記序號列表
      sumX: number; // 用於計算平均位置
      sumY: number;
    }

    const clusters: Cluster[] = [];
    const sortedMarkers = [...planMarkers].sort((a, b) => a.seq - b.seq);

    sortedMarkers.forEach(marker => {
      // 檢查此標記是否與現有的聚合物件重疊
      const existing = clusters.find(c => {
        const cx = c.sumX / c.ids.length;
        const cy = c.sumY / c.ids.length;
        return Math.abs(cx - marker.x) < thresholdX && Math.abs(cy - marker.y) < thresholdY;
      });

      if (existing) {
        // 加入現有聚合
        existing.ids.push(marker.id);
        existing.seqs.push(marker.seq);
        existing.sumX += marker.x;
        existing.sumY += marker.y;
      } else {
        // 建立新聚合
        clusters.push({
          ids: [marker.id],
          seqs: [marker.seq],
          sumX: marker.x,
          sumY: marker.y
        });
      }
    });

    // 轉換為渲染用的格式
    return clusters.map(c => ({
      id: c.ids[0], // 使用第一個 ID 作為 key
      allIds: c.ids, // 保存所有 ID 供點擊時查詢
      x: c.sumX / c.ids.length, // 中心點 X
      y: c.sumY / c.ids.length, // 中心點 Y
      label: c.seqs.join(','), // 顯示文字 (如: "1,2,3")
      isCluster: c.ids.length > 1 // 是否為多個標記聚合
    }));

  }, [markers, currentPlanIndex, imgDimensions]);

  // --- 事件處理：設定頁面 ---
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

  // --- 事件處理：畫布觸控互動 ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 雙指觸控：縮放模式
      // 如果正在等待標記 (長按檢測中)，立即取消
      if (markTimeoutRef.current) {
        clearTimeout(markTimeoutRef.current);
        markTimeoutRef.current = null;
      }
      setIsTouching(false);

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      // 計算兩指距離
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      // 計算中心點
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      lastDistRef.current = dist;
      lastCenterRef.current = { x: centerX, y: centerY };

    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      
      if (mode === 'mark') {
        // 標記模式：啟動長按檢測
        currentFingerPosRef.current = { clientX: touch.clientX, clientY: touch.clientY };
        
        // 延遲 100ms 後才顯示放大鏡，避免只是誤觸
        markTimeoutRef.current = setTimeout(() => {
          setIsTouching(true);
          const pos = currentFingerPosRef.current || { clientX: touch.clientX, clientY: touch.clientY };
          updateLoupe(pos); 
        }, 100); 

      } else {
        // 移動模式：記錄起始點
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // --- 雙指縮放與平移 ---
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;

      if (!lastDistRef.current || !lastCenterRef.current) {
        lastDistRef.current = dist;
        lastCenterRef.current = { x: midX, y: midY };
        return;
      }

      const currentT = transformRef.current;
      const scaleFactor = dist / lastDistRef.current;
      
      // 限制縮放範圍 (0.1x ~ 20x)
      let newScale = currentT.scale * scaleFactor;
      newScale = Math.min(Math.max(newScale, 0.1), 20);
      
      const effectiveScaleFactor = newScale / currentT.scale;

      // 計算以雙指中心為基準的縮放位移修正
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
        // 標記模式：更新放大鏡位置
        currentFingerPosRef.current = { clientX: touch.clientX, clientY: touch.clientY };
        if (isTouching) {
          updateLoupe({ clientX: touch.clientX, clientY: touch.clientY });
        }
      } else if (mode === 'move') {
        // 移動模式：單指平移
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
    // 手指離開：清除計時器
    if (markTimeoutRef.current) {
      clearTimeout(markTimeoutRef.current);
      markTimeoutRef.current = null;
    }

    lastDistRef.current = null;
    lastTouchRef.current = null;
    lastCenterRef.current = null;

    // 如果是在標記模式且手指離開，觸發新增標記
    if (mode === 'mark' && isTouching) {
      setIsTouching(false);
      if (imgCoord.x !== null && imgCoord.y !== null) {
        openNewMarkerModal(imgCoord as { x: number; y: number });
      }
    }
  };

  // --- 更新放大鏡位置與座標換算 ---
  const updateLoupe = (pos: { clientX: number; clientY: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // UI位置：跟隨手指
    const touchX = pos.clientX - rect.left;
    const touchY = pos.clientY - rect.top;
    setTouchPos({ x: touchX, y: touchY });

    // 邏輯位置：Y軸向上偏移，讓使用者看到手指下方的內容
    const effectiveY = touchY - Y_OFFSET;

    const currentT = transformRef.current;
    // 將螢幕座標轉換回圖片原始座標
    const rawX = (touchX - currentT.x) / currentT.scale;
    const rawY = (effectiveY - currentT.y) / currentT.scale;

    // 檢查是否在圖片範圍內
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

  // --- 事件處理：標記操作 ---
  const handleMarkerClick = (marker: Marker) => {
    // 點擊單一標記，開啟編輯模式
    setActiveMarker(marker);
    setFormData({ 
      ...marker.data, 
      tempImage: marker.imageBlob 
    });
    setIsModalOpen(true);
  };

  // 從聚合選單選擇了特定標記後觸發
  const handleClusterSelect = (marker: Marker) => {
    setClusterModalState((prev) => ({ ...prev, isOpen: false }));
    handleMarkerClick(marker);
  };

  // 開啟新增標記視窗
  const openNewMarkerModal = (coord: { x: number; y: number }) => {
    const maxSeq = markers.reduce((max, m) => Math.max(max, m.seq), 0);
    const nextSeq = maxSeq + 1;

    // 將座標轉換為百分比儲存，適應響應式縮放
    const xPct = (coord.x / imgDimensions.width) * 100;
    const yPct = (coord.y / imgDimensions.height) * 100;

    setActiveMarker({
      id: Date.now(),
      planIndex: currentPlanIndex,
      x: xPct,
      y: yPct,
      seq: nextSeq,
    });

    // 重置表單預設值
    setFormData((prev) => ({
      ...prev,
      // 使用上一次記憶的位置描述，若無則為空
      location: lastLocationRef.current,
      surfaceType: '雙面',
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

    // 檢查是更新現有標記還是新增
    const isUpdate = markers.some(m => m.id === newMarker.id);

    if (isUpdate) {
      setMarkers((prev) => prev.map(m => m.id === newMarker.id ? newMarker : m));
    } else {
      setMarkers((prev) => [...prev, newMarker]);
    }

    // 寫入 IndexedDB
    await dbService.addMarker(newMarker);
    
    // 成功儲存後，更新記憶的位置描述
    lastLocationRef.current = formData.location;

    setIsModalOpen(false);
    setActiveMarker(null);
    setMode('move'); // 儲存後切換回移動模式
  };

  // --- 專案檔案處理 (Saving / Loading) ---

  // 1. 儲存專案 (Save Project) -> .siteproj
  const handleSaveProject = async () => {
    if (!window.JSZip) {
      alert('系統模組載入中，請稍候');
      return;
    }
    
    try {
      const zip = new window.JSZip();
      
      // 準備中繼資料 (不含 blob/file)
      // 平面圖資訊
      const floorPlansMeta = projectInfo.floorPlans.map(p => ({
        id: p.id,
        name: p.name,
        // file 與 src 不存入 JSON，改用參照
        fileName: `plans/${p.id}.png` // 假設都轉存為 png 或原檔
      }));

      // 標記資料
      const markersMeta = markers.map(m => ({
        ...m,
        imageBlob: null, // 移除 Blob
        imageFileName: `markers/${m.id}.jpg`
      }));

      const projectMeta = {
        name: projectInfo.name,
        floorPlans: floorPlansMeta,
        markers: markersMeta,
        version: "1.0"
      };

      // 寫入 JSON
      zip.file("data.json", JSON.stringify(projectMeta));

      // 寫入平面圖檔案
      const assetsFolder = zip.folder("assets");
      const plansFolder = assetsFolder?.folder("plans");
      const markersFolder = assetsFolder?.folder("markers");

      // 批次加入平面圖
      projectInfo.floorPlans.forEach(p => {
        // 使用原檔名副檔名或預設png，這裡簡單起見直接存入 Blob
        plansFolder?.file(`${p.id}.png`, p.file);
      });

      // 批次加入標記照片
      markers.forEach(m => {
        markersFolder?.file(`${m.id}.jpg`, m.imageBlob);
      });

      // 產生 ZIP Blob
      const content = await zip.generateAsync({ type: 'blob' });
      
      // 下載
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${projectInfo.name || 'Project'}.siteproj`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error(error);
      alert('儲存專案失敗，請檢查記憶體空間');
    }
  };

  // 2. 開啟專案 (Open Project)
  const handleLoadProject = async (file: File) => {
    if (!window.JSZip) return;
    
    setIsRestoring(true);
    try {
      const zip = await new window.JSZip().loadAsync(file);
      
      // 讀取 JSON
      const jsonText = await zip.file("data.json")?.async("text");
      if (!jsonText) throw new Error("Invalid project file: missing data.json");
      
      const meta = JSON.parse(jsonText);
      
      // 先清除當前資料庫 (避免 ID 衝突混淆)
      await dbService.clearAll();

      // 還原平面圖
      const newPlans: FloorPlan[] = [];
      if (meta.floorPlans) {
        for (const pMeta of meta.floorPlans) {
          // 讀取檔案
          const blob = await zip.file(`assets/${pMeta.fileName}`)?.async("blob");
          if (blob) {
             const fileObj = new File([blob], pMeta.name, { type: blob.type });
             newPlans.push({
               id: pMeta.id,
               name: pMeta.name,
               file: fileObj,
               src: URL.createObjectURL(fileObj)
             });
          }
        }
      }

      // 還原標記
      const newMarkers: Marker[] = [];
      if (meta.markers) {
         for (const mMeta of meta.markers) {
            const blob = await zip.file(`assets/${mMeta.imageFileName}`)?.async("blob");
            if (blob) {
              const fileObj = new File([blob], `marker_${mMeta.id}.jpg`, { type: 'image/jpeg' });
              // 移除 JSON 中不必要的欄位並補回 Blob
              const { imageFileName, imageBlob, ...rest } = mMeta;
              newMarkers.push({
                ...rest,
                imageBlob: fileObj
              });
            }
         }
      }

      const newProjectInfo: ProjectInfo = {
        name: meta.name,
        floorPlans: newPlans
      };

      // 存入 IndexedDB
      await dbService.saveProject(newProjectInfo);
      for (const m of newMarkers) {
        await dbService.addMarker(m);
      }

      // 更新 State
      setProjectInfo(newProjectInfo);
      setMarkers(newMarkers);
      setStep('workspace');
      setCurrentPlanIndex(0);

      alert(`專案 ${meta.name} 讀取成功！`);

    } catch (e) {
      console.error(e);
      alert('讀取失敗：檔案格式錯誤或損毀');
      // 如果失敗，嘗試重新載入目前 DB 狀態 (雖然已經被 clear 了，這裡通常建議 reload)
      window.location.reload();
    } finally {
      setIsRestoring(false);
    }
  };

  // --- 退出專案邏輯 ---
  const handleExitClick = () => {
    setShowExitDialog(true);
  };

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave) {
      await handleSaveProject();
      // 給予瀏覽器一點時間處理下載觸發
      setTimeout(async () => {
        await dbService.clearAll();
        window.location.reload();
      }, 500);
    } else {
      await dbService.clearAll();
      window.location.reload();
    }
  };


  // --- 匯出報告 (Export Report) ---
  // 產生匯出檔名格式
  const getMarkerFileName = (m: Marker) => {
    const d = m.data;
    let floorStr = d.floor;
    if (d.isMezzanine) floorStr = `${d.floor}M`;
    floorStr += 'F';
    const seqStr = String(m.seq).padStart(3, '0');
    // 檔名格式: 序號_樓層_位置_管線數量..._施作面
    return `${seqStr}_${floorStr}_${d.location}_${d.code1}_${d.code2}_${d.code3}_${d.code4}_${d.code6}_${d.length}_${d.width}_${d.surfaceType}`;
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

    // 1. 匯出照片
    markers.forEach((m) => {
      const fileName = getMarkerFileName(m) + '.jpg';
      photosFolder.file(fileName, m.imageBlob);
    });

    // 2. 匯出標記後的平面圖 (繪製到 Canvas)
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

          // 在 Canvas 上繪製標記與編號
          planMarkers.forEach((m) => {
            const x = (m.x / 100) * canvas.width;
            const y = (m.y / 100) * canvas.height;
            // 計算標記大小 (隨圖片尺寸縮放)
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

          // 轉換 Canvas 為 Blob
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

    // 3. 產生 ZIP 檔案並下載
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${folderName}_Report.zip`; // 區別於 .siteproj
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 匯出報告不自動清除資料，因為使用者可能要繼續存檔
  };

  // --- 畫面渲染 ---
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        載入中...
      </div>
    );
  }

  // 步驟 1: 設定畫面
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
        onLoadProject={handleLoadProject}
        isZipLoaded={isZipLoaded}
      />
    );
  }

  const currentPlan = projectInfo.floorPlans[currentPlanIndex];

  // 步驟 2: 工作區 (地圖標記)
  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col overflow-hidden">
      {/* 頂部導覽列 */}
      <div className="bg-white px-4 py-3 shadow-md z-20 flex items-center justify-between shrink-0">
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-gray-500 font-bold truncate max-w-[150px]">
            {projectInfo.name}
          </span>
          <div className="relative inline-flex items-center">
            {/* 切換平面圖下拉選單 */}
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
        
        {/* 按鈕群組 */}
        <div className="flex items-center gap-2">
          {/* 儲存專案按鈕 */}
          <button
             onClick={handleSaveProject}
             disabled={!isZipLoaded}
             title="儲存專案檔 (.siteproj)"
             className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition active:scale-95"
          >
            <Save size={20} />
          </button>

          {/* 匯出報告按鈕 */}
          <button
            onClick={handleExport}
            disabled={!isZipLoaded}
            title="匯出照片與報表"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 transition ${
              isZipLoaded ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
            }`}
          >
            <Download size={18} />
            <span className="hidden sm:inline">匯出</span>
          </button>

          {/* 退出專案按鈕 */}
          <button
            onClick={handleExitClick}
            title="退出專案"
            className="p-2 bg-gray-100 text-red-500 rounded-lg hover:bg-gray-200 transition active:scale-95"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* 畫布區域 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#2a2a2a] touch-none select-none"
        onContextMenu={(e) => e.preventDefault()}
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
              // 圖片載入後，自動縮放至符合容器寬度
              if (containerRef.current) {
                const containerW = containerRef.current.clientWidth;
                const scale = containerW / imgW;
                setTransform({ x: 0, y: 0, scale });
                transformRef.current = { x: 0, y: 0, scale };
              }
            }}
          />
          {/* 標記層 (使用聚合後的標記) */}
          {visibleMarkers.map((m) => (
              <div
                key={m.id}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  // 只有在移動模式下才允許點擊標記
                  if (mode !== 'move') return;

                  if (m.isCluster) {
                    // 如果是聚合點：開啟選擇清單
                    // 找出所有屬於此聚合的標記物件
                    const clusterMarkers = markers.filter(marker => m.allIds.includes(marker.id));
                    // 依序號排序
                    clusterMarkers.sort((a, b) => a.seq - b.seq);
                    setClusterModalState({ isOpen: true, markers: clusterMarkers });
                  } else {
                    // 如果是單一標記：直接開啟編輯視窗
                    const target = markers.find(marker => marker.id === m.id);
                    if (target) handleMarkerClick(target);
                  }
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[1.625rem] h-[1.625rem] px-1 bg-yellow-400 border border-red-600 flex items-center justify-center text-[13px] font-bold text-black shadow-sm z-10 whitespace-nowrap`}
              >
                {m.label}
              </div>
            ))}
        </div>

        {/* 放大鏡元件 (僅在標記模式且觸控時顯示) */}
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
              {/* 內部容器，同步顯示放大的地圖與標記 */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: imgDimensions.width * 2, // 2倍放大
                  height: imgDimensions.height * 2,
                  // 計算位移，確保放大鏡中心對準觸控點偏移後的位置
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
                {/* 在放大鏡中也顯示標記 */}
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

              {/* 十字準心 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-0.5 h-6 bg-red-500/80 absolute"></div>
                <div className="w-6 h-0.5 bg-red-500/80 absolute"></div>
                <div className="w-2 h-2 border border-red-500 rounded-full absolute"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部功能列 */}
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

      {/* 聚合選擇視窗 */}
      <ClusterSelectModal
        isOpen={clusterModalState.isOpen}
        onClose={() => setClusterModalState(prev => ({ ...prev, isOpen: false }))}
        markers={clusterModalState.markers}
        onSelect={handleClusterSelect}
      />

      {/* 標記編輯視窗 */}
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
        isEditing={!!isEditing}
      />

      {/* 退出確認對話框 */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">確認退出</h3>
            <p className="text-gray-600 mb-6 text-sm">
              您確定要結束目前的專案嗎？<br />
              若尚未儲存，所有進度將會遺失。
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleConfirmExit(true)}
                disabled={!isZipLoaded}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Save size={18} />
                儲存專案並退出
              </button>
              <button 
                onClick={() => handleConfirmExit(false)}
                className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition active:scale-95"
              >
                不儲存直接退出
              </button>
              <button 
                onClick={() => setShowExitDialog(false)}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition active:scale-95"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;