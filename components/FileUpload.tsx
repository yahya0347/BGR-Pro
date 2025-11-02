
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploadProps {
  onImageUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageUpload(e.dataTransfer.files[0]);
    }
  }, [onImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full max-w-2xl">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
          ${isDragging ? 'border-indigo-500 bg-gray-800' : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadIcon className={`w-10 h-10 mb-3 text-gray-400 transition-colors ${isDragging ? 'text-indigo-400' : ''}`} />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PNG, JPG, or WEBP</p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer" 
          onChange={handleFileChange}
          accept="image/png, image/jpeg, image/webp"
        />
      </div>
    </div>
  );
};
