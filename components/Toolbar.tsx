import React from 'react';
import { BrushIcon } from './icons/BrushIcon';
import { EraserIcon } from './icons/EraserIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ResetIcon } from './icons/ResetIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { CropIcon } from './icons/CropIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';
import { EditMode, BrushSettings } from '../types';

interface ToolbarProps {
  editMode: EditMode;
  onSetEditMode: (mode: EditMode) => void;
  brushSettings: BrushSettings;
  onSetBrushSettings: (settings: BrushSettings) => void;
  onDownload: (format: 'png' | 'jpeg') => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onApplyCrop: () => void;
  onCancelCrop: () => void;
}

const ToolButton: React.FC<{ 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}> = ({ onClick, isActive = false, disabled = false, children, title }) => (
  <button
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`p-3 rounded-lg transition-colors ${
      isActive ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
    } ${
      disabled ? 'opacity-50 cursor-not-allowed hover:bg-gray-700' : ''
    }`}
  >
    {children}
  </button>
);

export const Toolbar: React.FC<ToolbarProps> = ({
  editMode,
  onSetEditMode,
  brushSettings,
  onSetBrushSettings,
  onDownload,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onApplyCrop,
  onCancelCrop
}) => {
  return (
    <div className="w-full max-w-5xl bg-gray-800/80 backdrop-blur-sm p-3 rounded-xl shadow-lg flex flex-wrap items-center justify-center gap-4">
      {editMode === EditMode.Crop ? (
        <>
          <span className="font-semibold text-gray-200">Crop Image</span>
          <div className="flex items-center gap-2 border-l-2 border-gray-700 pl-4">
            <button
              onClick={onApplyCrop}
              title="Apply Crop"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              <CheckIcon className="w-5 h-5" /> Apply
            </button>
            <button
              onClick={onCancelCrop}
              title="Cancel Crop"
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors"
            >
              <CloseIcon className="w-5 h-5" /> Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <ToolButton onClick={() => onSetEditMode(EditMode.Restore)} isActive={editMode === EditMode.Restore} title="Restore">
              <BrushIcon className="w-6 h-6" />
            </ToolButton>
            <ToolButton onClick={() => onSetEditMode(EditMode.Erase)} isActive={editMode === EditMode.Erase} title="Erase">
              <EraserIcon className="w-6 h-6" />
            </ToolButton>
            {/* Fix: Removed `isActive` prop which caused a TypeScript error.
                Inside this `else` block, `editMode` can never be `EditMode.Crop`, so the comparison `editMode === EditMode.Crop` is always false.
                The default value for `isActive` in ToolButton is false, which is the correct behavior here. */}
            <ToolButton onClick={() => onSetEditMode(EditMode.Crop)} title="Crop">
              <CropIcon className="w-6 h-6" />
            </ToolButton>
          </div>
          
          <div className="flex items-center gap-2 border-l-2 border-gray-700 pl-4">
            <ToolButton onClick={onUndo} disabled={!canUndo} title="Undo">
              <UndoIcon className="w-6 h-6" />
            </ToolButton>
            <ToolButton onClick={onRedo} disabled={!canRedo} title="Redo">
              <RedoIcon className="w-6 h-6" />
            </ToolButton>
          </div>

          <div className="flex items-center gap-3 text-gray-300 min-w-[200px] border-l-2 border-gray-700 pl-4">
            <span>Size:</span>
            <input
              type="range"
              min="1"
              max="150"
              value={brushSettings.size}
              onChange={(e) => onSetBrushSettings({ ...brushSettings, size: parseInt(e.target.value, 10) })}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-8 text-center">{brushSettings.size}</span>
          </div>

          <div className="flex items-center gap-2 border-l-2 border-gray-700 pl-4">
            <button 
              onClick={() => onDownload('png')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors">
              <DownloadIcon className="w-5 h-5" /> Download PNG
            </button>
            <button 
              onClick={() => onDownload('jpeg')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
              Download JPG
            </button>
          </div>
          <div className="border-l-2 border-gray-700 pl-4">
            <button 
                onClick={onReset}
                title="Start Over"
                className="p-3 bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white rounded-lg transition-colors">
                <ResetIcon className="w-6 h-6" />
              </button>
          </div>
        </>
      )}
    </div>
  );
};
