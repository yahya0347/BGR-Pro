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
  const maskedCoords = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const offset = y * w + x;
      if (mask[offset] === 1) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        maskedCoords.push(offset);
      }
    }
  }
  
  const numMasked = maskedCoords.length;
  if (numMasked === 0) {
    self.postMessage({ result: imgPixels });
    return;
  }
  
  // Initialize propagation states
  // computed = 1 for known (unmasked) pixels
  const computed = new Uint8Array(w * h);
  const initialized = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (mask[i] === 0) {
      computed[i] = 1;
      initialized[i] = 1;
    }
  }
  
  // Copy dst components to separate Float32Arrays for fast math and to avoid clamping during relaxation
  const dstR = new Float32Array(w * h);
  const dstG = new Float32Array(w * h);
  const dstB = new Float32Array(w * h);
  const dstA = new Float32Array(w * h);
  
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    dstR[i] = dst[idx];
    dstG[i] = dst[idx + 1];
    dstB[i] = dst[idx + 2];
    dstA[i] = dst[idx + 3];
  }
  
  const queue = [];
  // Find initial boundary queue (masked pixels touching unmasked)
  for (let i = 0; i < numMasked; i++) {
    const offset = maskedCoords[i];
    const x = offset % w;
    const y = Math.floor(offset / w);
    
    let isBorder = false;
    const neighbors = [offset - 1, offset + 1, offset - w, offset + w];
    const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
    
    for (let n = 0; n < 4; n++) {
      if (valid[n] && mask[neighbors[n]] === 0) {
        isBorder = true;
        break;
      }
    }
    
    if (isBorder) {
      queue.push(offset);
      initialized[offset] = 1;
    }
  }
  
  // Boundary propagation (flood fill average)
  let head = 0;
  while (head < queue.length) {
    const offset = queue[head++];
    const x = offset % w;
    const y = Math.floor(offset / w);
    
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    let wSum = 0;
    
    const neighbors = [offset - 1, offset + 1, offset - w, offset + w];
    const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
    
    for (let n = 0; n < 4; n++) {
      if (valid[n]) {
        const noff = neighbors[n];
        if (computed[noff] === 1) {
          rSum += dstR[noff];
          gSum += dstG[noff];
          bSum += dstB[noff];
          aSum += dstA[noff];
          wSum++;
        }
      }
    }
    
    if (wSum > 0) {
      dstR[offset] = rSum / wSum;
      dstG[offset] = gSum / wSum;
      dstB[offset] = bSum / wSum;
      dstA[offset] = aSum / wSum;
    }
    
    computed[offset] = 1;
    
    // Add uninitialized neighbors to queue
    for (let n = 0; n < 4; n++) {
      if (valid[n]) {
        const noff = neighbors[n];
        if (initialized[noff] === 0) {
          initialized[noff] = 1;
          queue.push(noff);
        }
      }
    }
  }
  
  // Store the initial propagated color as reference to prevent bleeding of foreign colors (Bilateral reference)
  const refR = new Float32Array(dstR);
  const refG = new Float32Array(dstG);
  const refB = new Float32Array(dstB);
  const refA = new Float32Array(dstA);
  
  // Fast Bilateral Laplace relaxation
  const tempR = new Float32Array(dstR);
  const tempG = new Float32Array(dstG);
  const tempB = new Float32Array(dstB);
  const tempA = new Float32Array(dstA);
  
  const iterations = 150;
  const sigma = 25.0;
  const invTwoSigmaSq = 1.0 / (2.0 * sigma * sigma);
  
  for (let iter = 0; iter < iterations; iter++) {
    const srcR = (iter % 2 === 0) ? dstR : tempR;
    const srcG = (iter % 2 === 0) ? dstG : tempG;
    const srcB = (iter % 2 === 0) ? dstB : tempB;
    const srcA = (iter % 2 === 0) ? dstA : tempA;
    
    const destR = (iter % 2 === 0) ? tempR : dstR;
    const destG = (iter % 2 === 0) ? tempG : dstG;
    const destB = (iter % 2 === 0) ? tempB : dstB;
    const destA = (iter % 2 === 0) ? tempA : dstA;
    
    for (let i = 0; i < numMasked; i++) {
      const offset = maskedCoords[i];
      const x = offset % w;
      const y = Math.floor(offset / w);
      
      const rRef = refR[offset];
      const gRef = refG[offset];
      const bRef = refB[offset];
      const aRef = refA[offset];
      
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
      let weightSum = 0;
      
      const neighbors = [offset - 1, offset + 1, offset - w, offset + w];
      const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
      
      for (let n = 0; n < 4; n++) {
        if (valid[n]) {
          const noff = neighbors[n];
          const nr = srcR[noff];
          const ng = srcG[noff];
          const nb = srcB[noff];
          const na = srcA[noff];
          
          const dr = nr - rRef;
          const dg = ng - gRef;
          const db = nb - bRef;
          const da = na - aRef;
          
          const distSq = dr*dr + dg*dg + db*db + da*da;
          const wBilateral = Math.exp(-distSq * invTwoSigmaSq);
          
          rSum += nr * wBilateral;
          gSum += ng * wBilateral;
          bSum += nb * wBilateral;
          aSum += na * wBilateral;
          weightSum += wBilateral;
        }
      }
      
      if (weightSum > 0) {
        destR[offset] = rSum / weightSum;
        destG[offset] = gSum / weightSum;
        destB[offset] = bSum / weightSum;
        destA[offset] = aSum / weightSum;
      } else {
        destR[offset] = srcR[offset];
        destG[offset] = srcG[offset];
        destB[offset] = srcB[offset];
        destA[offset] = srcA[offset];
      }
    }
  }
  
  // Write back to final dst array
  const finalR = (iterations % 2 === 0) ? dstR : tempR;
  const finalG = (iterations % 2 === 0) ? dstG : tempG;
  const finalB = (iterations % 2 === 0) ? dstB : tempB;
  const finalA = (iterations % 2 === 0) ? dstA : tempA;
  
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    dst[idx] = Math.round(finalR[i]);
    dst[idx + 1] = Math.round(finalG[i]);
    dst[idx + 2] = Math.round(finalB[i]);
    dst[idx + 3] = Math.round(finalA[i]);
  }
  
  self.postMessage({ result: dst });
};
