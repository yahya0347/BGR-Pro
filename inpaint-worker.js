self.onmessage = function(e) {
  const { imgWidth, imgHeight, imgPixels, maskPixels } = e.data;
  
  const w = imgWidth;
  const h = imgHeight;
  const dst = new Uint8ClampedArray(imgPixels);
  const mask = new Uint8Array(w * h);
  
  // Find bounding box and initialize mask map
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let hasMask = false;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (maskPixels[idx + 3] > 10) {
        mask[y * w + x] = 1;
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
  
  // Dilate mask by 2px (tighter fit to prevent bleeding into nearby design borders)
  const dilationRadius = 2;
  const dilatedMask = new Uint8Array(w * h);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const offset = y * w + x;
      if (mask[offset] === 1) {
        for (let dy = -dilationRadius; dy <= dilationRadius; dy++) {
          for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              dilatedMask[ny * w + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  // Apply dilated mask
  for (let y = Math.max(0, minY - dilationRadius); y <= Math.min(h - 1, maxY + dilationRadius); y++) {
    for (let x = Math.max(0, minX - dilationRadius); x <= Math.min(w - 1, maxX + dilationRadius); x++) {
      const offset = y * w + x;
      mask[offset] = dilatedMask[offset];
    }
  }
  
  // Recompute bounding box after dilation
  minX = w; maxX = 0; minY = h; maxY = 0;
  let maskCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        maskCount++;
      }
    }
  }
  
  // Set up local search window boundaries
  const searchMargin = 100; // wide enough to find clear background patterns
  const sMinX = Math.max(0, minX - searchMargin);
  const sMaxX = Math.min(w - 1, maxX + searchMargin);
  const sMinY = Math.max(0, minY - searchMargin);
  const sMaxY = Math.min(h - 1, maxY + searchMargin);
  
  const workMask = new Uint8Array(mask);
  const confidence = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    confidence[i] = workMask[i] === 1 ? 0 : 1;
  }
  
  const patchSize = 7;
  const halfPatch = 3;
  
  let iter = 0;
  const maxIter = maskCount * 2;
  
  // 1. Exemplar-Based Patch Matching (Copies actual textures/gradients from surroundings)
  while (maskCount > 0 && iter < maxIter) {
    iter++;
    
    // Find boundary pixels of the unfilled mask
    const boundary = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const offset = y * w + x;
        if (workMask[offset] === 1) {
          const isBoundary = (x > 0 && workMask[offset - 1] === 0) ||
                             (x < w - 1 && workMask[offset + 1] === 0) ||
                             (y > 0 && workMask[offset - w] === 0) ||
                             (y < h - 1 && workMask[offset + w] === 0);
          if (isBoundary) {
            boundary.push({ x, y });
          }
        }
      }
    }
    
    if (boundary.length === 0) break;
    
    // Select boundary pixel with the most known neighbors
    let bestPixel = null;
    let maxPriority = -1;
    
    for (let i = 0; i < boundary.length; i++) {
      const p = boundary[i];
      let confSum = 0;
      let count = 0;
      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            confSum += confidence[ny * w + nx];
            count++;
          }
        }
      }
      const priority = count > 0 ? confSum / count : 0;
      if (priority > maxPriority) {
        maxPriority = priority;
        bestPixel = p;
      }
    }
    
    if (!bestPixel) break;
    
    const targetX = bestPixel.x;
    const targetY = bestPixel.y;
    
    // Find best matching source patch in search window
    let bestSourceX = -1;
    let bestSourceY = -1;
    let minErr = Infinity;
    
    const searchStep = (maxX - minX > 300 || maxY - minY > 300) ? 3 : 1;
    
    for (let sy = sMinY; sy <= sMaxY; sy += searchStep) {
      for (let sx = sMinX; sx <= sMaxX; sx += searchStep) {
        // Source patch must be fully outside the original (dilated) mask
        let isValid = true;
        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const snx = sx + dx;
            const sny = sy + dy;
            if (snx < 0 || snx >= w || sny < 0 || sny >= h || mask[sny * w + snx] === 1) {
              isValid = false;
              break;
            }
          }
          if (!isValid) break;
        }
        
        if (!isValid) continue;
        
        // Sum of Squared Differences (SSD)
        let ssd = 0;
        let knownCount = 0;
        
        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          const tny = targetY + dy;
          const sny = sy + dy;
          if (tny < 0 || tny >= h || sny < 0 || sny >= h) continue;
          
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const tnx = targetX + dx;
            const snx = sx + dx;
            if (tnx < 0 || tnx >= w || snx < 0 || snx >= w) continue;
            
            if (workMask[tny * w + tnx] === 0) {
              const tIdx = (tny * w + tnx) * 4;
              const sIdx = (sny * w + snx) * 4;
              
              const dr = dst[tIdx] - dst[sIdx];
              const dg = dst[tIdx + 1] - dst[sIdx + 1];
              const db = dst[tIdx + 2] - dst[sIdx + 2];
              
              ssd += dr * dr + dg * dg + db * db;
              knownCount++;
            }
          }
        }
        
        if (knownCount > 0) {
          const normSsd = ssd / knownCount;
          if (normSsd < minErr) {
            minErr = normSsd;
            bestSourceX = sx;
            bestSourceY = sy;
          }
        }
      }
    }
    
    // Copy patch data to target
    if (bestSourceX !== -1) {
      const confVal = maxPriority;
      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        const tny = targetY + dy;
        const sny = bestSourceY + dy;
        if (tny < 0 || tny >= h) continue;
        
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const tnx = targetX + dx;
          const snx = bestSourceX + dx;
          if (tnx < 0 || tnx >= w) continue;
          
          const offset = tny * w + tnx;
          if (workMask[offset] === 1) {
            const tIdx = offset * 4;
            const sIdx = (sny * w + snx) * 4;
            
            dst[tIdx] = dst[sIdx];
            dst[tIdx + 1] = dst[sIdx + 1];
            dst[tIdx + 2] = dst[sIdx + 2];
            dst[tIdx + 3] = dst[sIdx + 3];
            
            workMask[offset] = 0;
            confidence[offset] = confVal;
            maskCount--;
          }
        }
      }
      
      // Update bounds dynamically
      minX = w; maxX = 0; minY = h; maxY = 0;
      for (let y = sMinY; y <= sMaxY; y++) {
        for (let x = sMinX; x <= sMaxX; x++) {
          if (workMask[y * w + x] === 1) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } else {
      break;
    }
  }
  
  // 2. Seam-Blending Laplace Solver (Smooths only the boundary edges to blend patch seams)
  const borderMap = new Uint8Array(w * h);
  const smoothIndices = [];
  
  for (let y = Math.max(0, minY - 2); y <= Math.min(h - 1, maxY + 2); y++) {
    for (let x = Math.max(0, minX - 2); x <= Math.min(w - 1, maxX + 2); x++) {
      const offset = y * w + x;
      if (mask[offset] === 1) {
        smoothIndices.push(offset);
        borderMap[offset] = 1;
      }
    }
  }
  
  const countSmooth = smoothIndices.length;
  if (countSmooth > 0) {
    const rBuf = new Float32Array(countSmooth);
    const gBuf = new Float32Array(countSmooth);
    const bBuf = new Float32Array(countSmooth);
    const aBuf = new Float32Array(countSmooth);
    
    for (let i = 0; i < countSmooth; i++) {
      const idx = smoothIndices[i] * 4;
      rBuf[i] = dst[idx];
      gBuf[i] = dst[idx + 1];
      bBuf[i] = dst[idx + 2];
      aBuf[i] = dst[idx + 3];
    }
    
    const rTemp = new Float32Array(countSmooth);
    const gTemp = new Float32Array(countSmooth);
    const bTemp = new Float32Array(countSmooth);
    const aTemp = new Float32Array(countSmooth);
    
    const smoothIterations = 30; // 30 passes is perfect to soften seams without blurring textures
    for (let sIter = 0; sIter < smoothIterations; sIter++) {
      const srcR = (sIter % 2 === 0) ? rBuf : rTemp;
      const srcG = (sIter % 2 === 0) ? gBuf : gTemp;
      const srcB = (sIter % 2 === 0) ? bBuf : bTemp;
      const srcA = (sIter % 2 === 0) ? aBuf : aTemp;
      
      const destR = (sIter % 2 === 0) ? rTemp : rBuf;
      const destG = (sIter % 2 === 0) ? gTemp : gBuf;
      const destB = (sIter % 2 === 0) ? bTemp : bBuf;
      const destA = (sIter % 2 === 0) ? aTemp : aBuf;
      
      for (let i = 0; i < countSmooth; i++) {
        const offset = smoothIndices[i];
        const x = offset % w;
        const y = Math.floor(offset / w);
        
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
        let weightSum = 0;
        
        const neighbors = [
          offset - 1,
          offset + 1,
          offset - w,
          offset + w
        ];
        
        const valid = [
          x > 0,
          x < w - 1,
          y > 0,
          y < h - 1
        ];
        
        for (let n = 0; n < 4; n++) {
          if (valid[n]) {
            const nOffset = neighbors[n];
            if (borderMap[nOffset] === 1) {
              const nIdx = smoothIndices.indexOf(nOffset);
              if (nIdx !== -1) {
                rSum += srcR[nIdx];
                gSum += srcG[nIdx];
                bSum += srcB[nIdx];
                aSum += srcA[nIdx];
                weightSum++;
              }
            } else {
              const nIdx = nOffset * 4;
              rSum += dst[nIdx];
              gSum += dst[nIdx + 1];
              bSum += dst[nIdx + 2];
              aSum += dst[nIdx + 3];
              weightSum++;
            }
          }
        }
        
        if (weightSum > 0) {
          destR[i] = rSum / weightSum;
          destG[i] = gSum / weightSum;
          destB[i] = bSum / weightSum;
          destA[i] = aSum / weightSum;
        } else {
          destR[i] = srcR[i];
          destG[i] = srcG[i];
          destB[i] = srcB[i];
          destA[i] = srcA[i];
        }
      }
    }
    
    const finalR = (smoothIterations % 2 === 0) ? rBuf : rTemp;
    const finalG = (smoothIterations % 2 === 0) ? gBuf : gTemp;
    const finalB = (smoothIterations % 2 === 0) ? bBuf : bTemp;
    const finalA = (smoothIterations % 2 === 0) ? aBuf : aTemp;
    
    for (let i = 0; i < countSmooth; i++) {
      const offset = smoothIndices[i];
      const idx = offset * 4;
      dst[idx] = Math.round(finalR[i]);
      dst[idx + 1] = Math.round(finalG[i]);
      dst[idx + 2] = Math.round(finalB[i]);
      dst[idx + 3] = Math.round(finalA[i]);
    }
  }
  
  self.postMessage({ result: dst });
};
