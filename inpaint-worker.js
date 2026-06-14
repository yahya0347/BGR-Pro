self.onmessage = function(e) {
  const { imgWidth, imgHeight, imgPixels, maskPixels } = e.data;
  
  const dst = new Uint8ClampedArray(imgPixels);
  const mask = new Uint8Array(imgWidth * imgHeight);
  
  // Find bounding box and initialize mask map
  let minX = imgWidth, maxX = 0, minY = imgHeight, maxY = 0;
  let hasMask = false;
  
  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < imgWidth; x++) {
      const idx = (y * imgWidth + x) * 4;
      if (maskPixels[idx + 3] > 10) {
        mask[y * imgWidth + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasMask = true;
      }
    }
  }
  
  if (!hasMask) {
    self.postMessage({ result: imgPixels });
    return;
  }
  
  // Expand bounding box slightly for safety
  const margin = 10;
  minX = Math.max(0, minX - margin);
  maxX = Math.min(imgWidth - 1, maxX + margin);
  minY = Math.max(0, minY - margin);
  maxY = Math.min(imgHeight - 1, maxY + margin);
  
  // Dilate mask by 3 pixels to capture antialiased edges and shadows
  const dilationRadius = 3;
  const dilatedMask = new Uint8Array(imgWidth * imgHeight);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = y * imgWidth + x;
      if (mask[offset] === 1) {
        for (let dy = -dilationRadius; dy <= dilationRadius; dy++) {
          for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < imgWidth && ny >= 0 && ny < imgHeight) {
              dilatedMask[ny * imgWidth + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  // Apply dilated mask
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = y * imgWidth + x;
      mask[offset] = dilatedMask[offset];
    }
  }
  
  // Collect all masked pixel indices in the bounding box
  const maskedIndices = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = y * imgWidth + x;
      if (mask[offset] === 1) {
        maskedIndices.push(offset);
      }
    }
  }
  
  const numMasked = maskedIndices.length;
  
  // Buffers for color channels
  const rBuf = new Float32Array(numMasked);
  const gBuf = new Float32Array(numMasked);
  const bBuf = new Float32Array(numMasked);
  const aBuf = new Float32Array(numMasked);
  
  // Fast lookup for masked pixel index
  const maskIndexMap = new Int32Array(imgWidth * imgHeight);
  maskIndexMap.fill(-1);
  for (let i = 0; i < numMasked; i++) {
    maskIndexMap[maskedIndices[i]] = i;
  }
  
  // Initialize by boundary propagation (flood fill average)
  const initialized = new Uint8Array(numMasked);
  let numInitialized = 0;
  
  // Immediate boundary check (masked pixels touching known pixels)
  for (let i = 0; i < numMasked; i++) {
    const offset = maskedIndices[i];
    const x = offset % imgWidth;
    const y = Math.floor(offset / imgWidth);
    
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0, wSum = 0;
    
    const neighbors = [
      { nx: x - 1, ny: y, nOffset: offset - 1 },
      { nx: x + 1, ny: y, nOffset: offset + 1 },
      { nx: x, ny: y - 1, nOffset: offset - imgWidth },
      { nx: x, ny: y + 1, nOffset: offset + imgWidth }
    ];
    
    for (let j = 0; j < 4; j++) {
      const { nx, ny, nOffset } = neighbors[j];
      if (nx >= 0 && nx < imgWidth && ny >= 0 && ny < imgHeight) {
        if (mask[nOffset] === 0) { // known pixel
          const nIdx = nOffset * 4;
          rSum += dst[nIdx];
          gSum += dst[nIdx + 1];
          bSum += dst[nIdx + 2];
          aSum += dst[nIdx + 3];
          wSum++;
        }
      }
    }
    
    if (wSum > 0) {
      rBuf[i] = rSum / wSum;
      gBuf[i] = gSum / wSum;
      bBuf[i] = bSum / wSum;
      aBuf[i] = aSum / wSum;
      initialized[i] = 1;
      numInitialized++;
    }
  }
  
  // Propagate colors inward to initialize the rest of the masked pixels
  let passes = 0;
  const maxPasses = imgWidth + imgHeight;
  while (numInitialized < numMasked && passes < maxPasses) {
    passes++;
    let progress = false;
    for (let i = 0; i < numMasked; i++) {
      if (initialized[i] === 0) {
        const offset = maskedIndices[i];
        const x = offset % imgWidth;
        const y = Math.floor(offset / imgWidth);
        
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0, wSum = 0;
        
        const neighbors = [
          { nx: x - 1, ny: y, nOffset: offset - 1 },
          { nx: x + 1, ny: y, nOffset: offset + 1 },
          { nx: x, ny: y - 1, nOffset: offset - imgWidth },
          { nx: x, ny: y + 1, nOffset: offset + imgWidth }
        ];
        
        for (let j = 0; j < 4; j++) {
          const { nx, ny, nOffset } = neighbors[j];
          if (nx >= 0 && nx < imgWidth && ny >= 0 && ny < imgHeight) {
            const nMaskIdx = maskIndexMap[nOffset];
            if (nMaskIdx !== -1 && initialized[nMaskIdx] === 1) {
              rSum += rBuf[nMaskIdx];
              gSum += gBuf[nMaskIdx];
              bSum += bBuf[nMaskIdx];
              aSum += aBuf[nMaskIdx];
              wSum++;
            } else if (mask[nOffset] === 0) {
              const nIdx = nOffset * 4;
              rSum += dst[nIdx];
              gSum += dst[nIdx + 1];
              bSum += dst[nIdx + 2];
              aSum += dst[nIdx + 3];
              wSum++;
            }
          }
        }
        
        if (wSum > 0) {
          rBuf[i] = rSum / wSum;
          gBuf[i] = gSum / wSum;
          bBuf[i] = bSum / wSum;
          aBuf[i] = aSum / wSum;
          initialized[i] = 1;
          numInitialized++;
          progress = true;
        }
      }
    }
    if (!progress) break;
  }
  
  // Fallback for any uninitialized pixels
  if (numInitialized < numMasked) {
    for (let i = 0; i < numMasked; i++) {
      if (initialized[i] === 0) {
        const offset = maskedIndices[i];
        const idx = offset * 4;
        rBuf[i] = dst[idx];
        gBuf[i] = dst[idx + 1];
        bBuf[i] = dst[idx + 2];
        aBuf[i] = dst[idx + 3];
      }
    }
  }
  
  // Jacobi Laplace relaxation for smoothing (150 iterations)
  const rTemp = new Float32Array(numMasked);
  const gTemp = new Float32Array(numMasked);
  const bTemp = new Float32Array(numMasked);
  const aTemp = new Float32Array(numMasked);
  
  const iterations = 150;
  for (let iter = 0; iter < iterations; iter++) {
    const srcR = (iter % 2 === 0) ? rBuf : rTemp;
    const srcG = (iter % 2 === 0) ? gBuf : gTemp;
    const srcB = (iter % 2 === 0) ? bBuf : bTemp;
    const srcA = (iter % 2 === 0) ? aBuf : aTemp;
    
    const destR = (iter % 2 === 0) ? rTemp : rBuf;
    const destG = (iter % 2 === 0) ? gTemp : gBuf;
    const destB = (iter % 2 === 0) ? bTemp : bBuf;
    const destA = (iter % 2 === 0) ? aTemp : aBuf;
    
    for (let i = 0; i < numMasked; i++) {
      const offset = maskedIndices[i];
      const x = offset % imgWidth;
      const y = Math.floor(offset / imgWidth);
      
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let count = 0;
      
      const neighbors = [
        offset - 1,
        offset + 1,
        offset - imgWidth,
        offset + imgWidth
      ];
      
      const validNeighbors = [
        x > 0,
        x < imgWidth - 1,
        y > 0,
        y < imgHeight - 1
      ];
      
      for (let n = 0; n < 4; n++) {
        if (validNeighbors[n]) {
          const nOffset = neighbors[n];
          const nMaskIdx = maskIndexMap[nOffset];
          
          if (nMaskIdx !== -1) {
            rSum += srcR[nMaskIdx];
            gSum += srcG[nMaskIdx];
            bSum += srcB[nMaskIdx];
            aSum += srcA[nMaskIdx];
          } else {
            const nIdx = nOffset * 4;
            rSum += dst[nIdx];
            gSum += dst[nIdx + 1];
            bSum += dst[nIdx + 2];
            aSum += dst[nIdx + 3];
          }
          count++;
        }
      }
      
      if (count > 0) {
        destR[i] = rSum / count;
        destG[i] = gSum / count;
        destB[i] = bSum / count;
        destA[i] = aSum / count;
      } else {
        destR[i] = srcR[i];
        destG[i] = srcG[i];
        destB[i] = srcB[i];
        destA[i] = srcA[i];
      }
    }
  }
  
  const finalR = (iterations % 2 === 0) ? rBuf : rTemp;
  const finalG = (iterations % 2 === 0) ? gBuf : gTemp;
  const finalB = (iterations % 2 === 0) ? bBuf : bTemp;
  const finalA = (iterations % 2 === 0) ? aBuf : aTemp;
  
  for (let i = 0; i < numMasked; i++) {
    const offset = maskedIndices[i];
    const idx = offset * 4;
    dst[idx] = Math.round(finalR[i]);
    dst[idx + 1] = Math.round(finalG[i]);
    dst[idx + 2] = Math.round(finalB[i]);
    dst[idx + 3] = Math.round(finalA[i]);
  }
  
  self.postMessage({ result: dst });
};
