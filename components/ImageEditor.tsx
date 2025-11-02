import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EditMode, BrushSettings } from '../types';
import { Toolbar } from './Toolbar';
import { downloadImage } from '../utils/imageUtils';

interface ImageEditorProps {
  originalImage: string;
  processedImage: string;
  onReset: () => void;
}

type CropRect = { x: number; y: number; width: number; height: number };
type CropAction = {
  type: 'drawing' | 'moving' | 'resizing';
  handle?: string;
  startX: number;
  startY: number;
  startRect?: CropRect;
};

const HANDLE_SIZE = 10;

export const ImageEditor: React.FC<ImageEditorProps> = ({ originalImage, processedImage, onReset }) => {
  const [editMode, setEditMode] = useState<EditMode>(EditMode.Erase);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({ size: 40 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cropAction, setCropAction] = useState<CropAction | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (history.length > 0 && history[historyIndex]) {
      ctx.putImageData(history[historyIndex], 0, 0);
    }

    if (editMode === EditMode.Crop && cropRect) {
      drawCropOverlay(ctx, cropRect);
    }
  }, [history, historyIndex, editMode, cropRect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = processedImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialImageData]);
      setHistoryIndex(0);
    };

    const originalImg = new Image();
    originalImg.crossOrigin = "anonymous";
    originalImg.src = originalImage;
    originalImg.onload = () => {
      originalImageRef.current = originalImg;
    };
  }, [processedImage, originalImage]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(currentImageData);
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const restoreCanvasState = (imageData: ImageData) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      restoreCanvasState(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      restoreCanvasState(history[newIndex]);
    }
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const originalImg = originalImageRef.current;
    if (!ctx || !canvas) return;
  
    if (editMode === EditMode.Restore && !originalImg) return;
  
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = brushSettings.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (editMode === EditMode.Erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.stroke();
    } else if (editMode === EditMode.Restore) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.clip();
      ctx.drawImage(originalImg!, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [editMode, brushSettings.size]);
  
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode === EditMode.Crop) return;
    isDrawing.current = true;
    const pos = getMousePos(e);
    if (pos) {
      lastPoint.current = pos;
      drawLine(pos.x, pos.y, pos.x, pos.y);
    }
  }, [editMode, drawLine]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode === EditMode.Crop) return;
    if (!isDrawing.current) return;
    const currentPoint = getMousePos(e);
    if (currentPoint && lastPoint.current) {
      drawLine(lastPoint.current.x, lastPoint.current.y, currentPoint.x, currentPoint.y);
      lastPoint.current = currentPoint;
    }
  }, [editMode, drawLine]);
  
  const stopDrawing = useCallback(() => {
    if (isDrawing.current) {
      saveToHistory();
    }
    isDrawing.current = false;
    lastPoint.current = null;
  }, [saveToHistory]);

  // --- CROP LOGIC ---
  const getCropHandle = (pos: { x: number, y: number }, rect: CropRect): string | null => {
    const { x, y, width, height } = rect;
    const hs = HANDLE_SIZE;
    if (pos.x > x + width - hs && pos.x < x + width + hs && pos.y > y + height - hs && pos.y < y + height + hs) return 'br';
    if (pos.x > x - hs && pos.x < x + hs && pos.y > y - hs && pos.y < y + hs) return 'tl';
    if (pos.x > x + width - hs && pos.x < x + width + hs && pos.y > y - hs && pos.y < y + hs) return 'tr';
    if (pos.x > x - hs && pos.x < x + hs && pos.y > y + height - hs && pos.y < y + height + hs) return 'bl';
    if (pos.x > x + width / 2 - hs && pos.x < x + width / 2 + hs && pos.y > y - hs && pos.y < y + hs) return 'tm';
    if (pos.x > x + width / 2 - hs && pos.x < x + width / 2 + hs && pos.y > y + height - hs && pos.y < y + height + hs) return 'bm';
    if (pos.x > x - hs && pos.x < x + hs && pos.y > y + height / 2 - hs && pos.y < y + height / 2 + hs) return 'ml';
    if (pos.x > x + width - hs && pos.x < x + width + hs && pos.y > y + height / 2 - hs && pos.y < y + height / 2 + hs) return 'mr';
    return null;
  };

  const getCursorForHandle = (handle: string | null) => {
    if (['tl', 'br'].includes(handle!)) return 'nwse-resize';
    if (['tr', 'bl'].includes(handle!)) return 'nesw-resize';
    if (['tm', 'bm'].includes(handle!)) return 'ns-resize';
    if (['ml', 'mr'].includes(handle!)) return 'ew-resize';
    return 'move';
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode !== EditMode.Crop) return;
    const pos = getMousePos(e);
    if (!pos) return;

    if (cropRect) {
      const handle = getCropHandle(pos, cropRect);
      if (handle) {
        setCropAction({ type: 'resizing', handle, startX: pos.x, startY: pos.y, startRect: { ...cropRect } });
        return;
      }
      if (pos.x > cropRect.x && pos.x < cropRect.x + cropRect.width && pos.y > cropRect.y && pos.y < cropRect.y + cropRect.height) {
        setCropAction({ type: 'moving', startX: pos.x, startY: pos.y, startRect: { ...cropRect } });
        return;
      }
    }
    setCropAction({ type: 'drawing', startX: pos.x, startY: pos.y });
  };
  
  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getMousePos(e);
    if (!pos) return;
    
    if (editMode === EditMode.Crop) {
      let cursor = 'crosshair';
      if (cropRect) {
        const handle = getCropHandle(pos, cropRect);
        if (handle) {
          cursor = getCursorForHandle(handle);
        } else if (pos.x > cropRect.x && pos.x < cropRect.x + cropRect.width && pos.y > cropRect.y && pos.y < cropRect.y + cropRect.height) {
          cursor = 'move';
        }
      }
      canvas.style.cursor = cursor;
    } else {
       canvas.style.cursor = 'crosshair';
    }


    if (!cropAction || editMode !== EditMode.Crop) return;

    if (cropAction.type === 'drawing') {
      const x = Math.min(pos.x, cropAction.startX);
      const y = Math.min(pos.y, cropAction.startY);
      const width = Math.abs(pos.x - cropAction.startX);
      const height = Math.abs(pos.y - cropAction.startY);
      setCropRect({ x, y, width, height });
    } else if (cropAction.type === 'moving' && cropAction.startRect) {
      const dx = pos.x - cropAction.startX;
      const dy = pos.y - cropAction.startY;
      setCropRect({
        ...cropAction.startRect,
        x: cropAction.startRect.x + dx,
        y: cropAction.startRect.y + dy,
      });
    } else if (cropAction.type === 'resizing' && cropAction.startRect && cropAction.handle) {
      const dx = pos.x - cropAction.startX;
      const dy = pos.y - cropAction.startY;
      let { x, y, width, height } = cropAction.startRect;

      if (cropAction.handle.includes('l')) { x += dx; width -= dx; }
      if (cropAction.handle.includes('r')) { width += dx; }
      if (cropAction.handle.includes('t')) { y += dy; height -= dy; }
      if (cropAction.handle.includes('b')) { height += dy; }
      
      if (width < 0) { x += width; width = -width; }
      if (height < 0) { y += height; height = -height; }

      setCropRect({ x, y, width, height });
    }
  };
  
  const handleCropMouseUp = () => {
    setCropAction(null);
  };
  
  const drawCropOverlay = (ctx: CanvasRenderingContext2D, rect: CropRect) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    
    // handles
    ctx.fillStyle = 'white';
    const hs = HANDLE_SIZE;
    const handles = [
      { x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
      { x: rect.x, y: rect.y + rect.height }, { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x + rect.width/2, y: rect.y }, { x: rect.x + rect.width/2, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height/2 }, { x: rect.x + rect.width, y: rect.y + rect.height/2 },
    ];
    handles.forEach(h => ctx.fillRect(h.x - hs/2, h.y - hs/2, hs, hs));
    ctx.restore();
  };
  
  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const originalImg = originalImageRef.current;
    if (!canvas || !ctx || !cropRect || !originalImg) return;
  
    // Crop processed image
    const croppedImageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    
    // Crop original image for future restores
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropRect.width;
    tempCanvas.height = cropRect.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(originalImg, cropRect.x, cropRect.y, cropRect.width, cropRect.height, 0, 0, cropRect.width, cropRect.height);
    
    const newOriginalImage = new Image();
    newOriginalImage.src = tempCanvas.toDataURL();
    newOriginalImage.onload = () => {
      originalImageRef.current = newOriginalImage;

      // Update main canvas
      canvas.width = cropRect.width;
      canvas.height = cropRect.height;
      ctx.putImageData(croppedImageData, 0, 0);

      saveToHistory();
      setCropRect(null);
      setEditMode(EditMode.Erase);
    }
  };
  
  const handleCancelCrop = () => {
    setCropRect(null);
    setEditMode(EditMode.Erase);
  };
  // --- END CROP LOGIC ---


  const handleDownload = (format: 'png' | 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (format === 'png') {
      const dataUrl = canvas.toDataURL('image/png');
      downloadImage(dataUrl, 'background_removed.png');
    } else {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
        downloadImage(dataUrl, 'background_removed.jpg');
      }
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleSetEditMode = (mode: EditMode) => {
    setEditMode(mode);
    if (mode === EditMode.Crop && !cropRect) {
      const canvas = canvasRef.current;
      if(canvas) {
        setCropRect({ x: canvas.width * 0.1, y: canvas.height * 0.1, width: canvas.width * 0.8, height: canvas.height * 0.8 });
      }
    } else if (mode !== EditMode.Crop) {
      setCropRect(null);
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 space-y-4">
      <Toolbar 
        editMode={editMode}
        onSetEditMode={handleSetEditMode}
        brushSettings={brushSettings}
        onSetBrushSettings={setBrushSettings}
        onDownload={handleDownload}
        onReset={onReset}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onApplyCrop={handleApplyCrop}
        onCancelCrop={handleCancelCrop}
      />
      <div className="w-full max-w-6xl aspect-auto overflow-auto flex justify-center items-center bg-gray-800 rounded-lg p-2 checkerboard">
        <canvas 
          ref={canvasRef}
          className="max-w-full max-h-[70vh] object-contain"
          onMouseDown={editMode === EditMode.Crop ? handleCropMouseDown : startDrawing}
          onMouseMove={editMode === EditMode.Crop ? handleCropMouseMove : draw}
          onMouseUp={editMode === EditMode.Crop ? handleCropMouseUp : stopDrawing}
          onMouseLeave={editMode === EditMode.Crop ? handleCropMouseUp : stopDrawing}
        />
      </div>
    </div>
  );
};