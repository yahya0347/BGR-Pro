
import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ImageEditor } from './components/ImageEditor';
import { removeBackground } from './services/geminiService';
import { fileToBase64 } from './utils/imageUtils';

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<number>(0);

  const handleImageUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setProcessedImage(null);

    try {
      const base64Image = await fileToBase64(file);
      setOriginalImage(base64Image);

      const resultBase64 = await removeBackground(base64Image);
      setProcessedImage(`data:image/png;base64,${resultBase64}`);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to process image. ${errorMessage}`);
      setOriginalImage(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setError(null);
    setIsLoading(false);
    setKey(prevKey => prevKey + 1); // Remount FileUpload
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-6xl text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
          AI Background Remover Pro
        </h1>
        <p className="text-gray-400 mt-2">Upload an image to remove the background, then fine-tune with our editor.</p>
      </header>
      
      <main className="w-full flex-grow flex items-center justify-center">
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg className="animate-spin h-12 w-12 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg text-gray-300">Removing background with AI...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center p-8 bg-gray-800 border border-red-500 rounded-lg max-w-lg">
            <p className="text-red-400 text-xl mb-4">An Error Occurred</p>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!originalImage && !isLoading && !error && (
          <FileUpload key={key} onImageUpload={handleImageUpload} />
        )}
        
        {originalImage && processedImage && !isLoading && (
          <ImageEditor 
            originalImage={originalImage} 
            processedImage={processedImage}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
};

export default App;
