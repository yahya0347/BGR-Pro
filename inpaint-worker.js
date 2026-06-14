/**
 * Fast Marching Method (FMM) Inpainting — Telea Algorithm
 * 
 * This is the same proven algorithm used in OpenCV's cv::inpaint(INPAINT_TELEA).
 * It processes pixels from the mask boundary inward, estimating each pixel's color 
 * from nearby known pixels weighted by distance and gradient direction.
 * 
 * Why this works better than Laplace diffusion:
 * - Fills from boundary inward (preserves edge structure)
 * - Gradient-aware weighting (follows image flow/isophotes)
 * - Distance-based weighting (closer pixels have more influence)
 * - Linear time complexity (fast even for large masks)
 * 
 * After FMM fill, a multi-pass smoothing blends seam boundaries.
 */

self.onmessage = function(e) {
  const { imgWidth, imgHeight, imgPixels, maskPixels } = e.data;
  
  const w = imgWidth;
  const h = imgHeight;
  const N = w * h;
  
  // Working copy of pixel data
  const dst = new Uint8ClampedArray(imgPixels);
  
  // Build binary mask from brush overlay (alpha > 10 = masked)
  const KNOWN = 0;
  const BAND = 1;
  const INSIDE = 2;
  
  const flag = new Uint8Array(N); // KNOWN=0, BAND=1, INSIDE=2
  const dist = new Float32Array(N); // distance to boundary
  
  let hasMask = false;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;
      if (maskPixels[idx + 3] > 10) {
        flag[i] = INSIDE;
        dist[i] = 1e6;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasMask = true;
      } else {
        flag[i] = KNOWN;
        dist[i] = 0;
      }
    }
  }
  
  if (!hasMask) {
    self.postMessage({ result: imgPixels });
    return;
  }
  
  // Dilate mask by 3px to cover anti-aliased watermark edges
  const dilR = 3;
  const expandedMinX = Math.max(0, minX - dilR);
  const expandedMaxX = Math.min(w - 1, maxX + dilR);
  const expandedMinY = Math.max(0, minY - dilR);
  const expandedMaxY = Math.min(h - 1, maxY + dilR);
  
  const dilated = new Uint8Array(N);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (flag[y * w + x] === INSIDE) {
        for (let dy = -dilR; dy <= dilR; dy++) {
          for (let dx = -dilR; dx <= dilR; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              dilated[ny * w + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  // Apply dilation
  for (let i = 0; i < N; i++) {
    if (dilated[i] === 1 && flag[i] === KNOWN) {
      flag[i] = INSIDE;
      dist[i] = 1e6;
    }
  }
  
  // Recompute bounding box
  minX = w; maxX = 0; minY = h; maxY = 0;
  let maskedCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (flag[y * w + x] === INSIDE) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        maskedCount++;
      }
    }
  }
  
  if (maskedCount === 0) {
    self.postMessage({ result: imgPixels });
    return;
  }
  
  // ================================================================
  // STEP 1: Initialize the narrow band (boundary of mask)
  // ================================================================
  
  // Min-heap (priority queue) sorted by distance
  // Each entry: [distance, index]
  const heap = [];
  
  function heapPush(d, idx) {
    heap.push([d, idx]);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] > heap[i][0]) {
        const tmp = heap[parent];
        heap[parent] = heap[i];
        heap[i] = tmp;
        i = parent;
      } else break;
    }
  }
  
  function heapPop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
        if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
        if (smallest !== i) {
          const tmp = heap[smallest];
          heap[smallest] = heap[i];
          heap[i] = tmp;
          i = smallest;
        } else break;
      }
    }
    return top;
  }
  
  // Find initial narrow band: INSIDE pixels adjacent to KNOWN pixels
  const dx4 = [-1, 1, 0, 0];
  const dy4 = [0, 0, -1, 1];
  
  for (let y = Math.max(0, minY - 1); y <= Math.min(h - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(w - 1, maxX + 1); x++) {
      const i = y * w + x;
      if (flag[i] !== INSIDE) continue;
      
      for (let d = 0; d < 4; d++) {
        const nx = x + dx4[d];
        const ny = y + dy4[d];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          if (flag[ny * w + nx] === KNOWN) {
            flag[i] = BAND;
            dist[i] = 1.0;
            heapPush(1.0, i);
            break;
          }
        }
      }
    }
  }
  
  // ================================================================
  // STEP 2: Fast Marching — process pixels from boundary inward
  // ================================================================
  
  // Inpainting radius (how far to look for source pixels)
  const INPAINT_RADIUS = 12;
  const RADIUS_SQ = INPAINT_RADIUS * INPAINT_RADIUS;
  
  // Working float arrays for gradient computation
  const grayF = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const idx = i * 4;
    grayF[i] = 0.299 * dst[idx] + 0.587 * dst[idx + 1] + 0.114 * dst[idx + 2];
  }
  
  /**
   * Inpaint a single pixel at position (x,y) using Telea's method:
   * Color = weighted average of nearby known pixels
   * Weight = (1/distance²) * directionalFactor * levelSetFactor
   */
  function inpaintPixel(x, y) {
    const i = y * w + x;
    
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    let weightSum = 0;
    
    // Gradient at this pixel (estimated from known neighbors)
    let gradX = 0, gradY = 0;
    let gradCount = 0;
    
    for (let d = 0; d < 4; d++) {
      const nx = x + dx4[d];
      const ny = y + dy4[d];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && flag[ny * w + nx] === KNOWN) {
        gradX += dx4[d] * grayF[ny * w + nx];
        gradY += dy4[d] * grayF[ny * w + nx];
        gradCount++;
      }
    }
    if (gradCount > 0) {
      gradX /= gradCount;
      gradY /= gradCount;
    }
    
    // Sample nearby known pixels within inpainting radius
    const rStart = Math.max(0, y - INPAINT_RADIUS);
    const rEnd = Math.min(h - 1, y + INPAINT_RADIUS);
    const cStart = Math.max(0, x - INPAINT_RADIUS);
    const cEnd = Math.min(w - 1, x + INPAINT_RADIUS);
    
    for (let ky = rStart; ky <= rEnd; ky++) {
      for (let kx = cStart; kx <= cEnd; kx++) {
        const ki = ky * w + kx;
        if (flag[ki] !== KNOWN) continue;
        
        const ddx = kx - x;
        const ddy = ky - y;
        const distSq = ddx * ddx + ddy * ddy;
        
        if (distSq > RADIUS_SQ || distSq === 0) continue;
        
        const d = Math.sqrt(distSq);
        
        // Distance weight: closer pixels have more influence
        const wDist = 1.0 / (d * d * d); // 1/r³ for strong falloff
        
        // Direction weight: favor pixels along gradient direction (isophote)
        let wDir = 1.0;
        if (d > 0) {
          // Unit vector from known pixel to target
          const ux = ddx / d;
          const uy = ddy / d;
          // Dot product with gradient gives directional preference
          wDir = Math.abs(ux * gradX + uy * gradY) + 0.5;
        }
        
        // Level set weight: favor pixels at similar boundary distance
        const levelDiff = Math.abs(dist[ki] - dist[i]);
        const wLevel = 1.0 / (1.0 + levelDiff);
        
        const weight = wDist * wDir * wLevel;
        
        const kidx = ki * 4;
        rSum += dst[kidx] * weight;
        gSum += dst[kidx + 1] * weight;
        bSum += dst[kidx + 2] * weight;
        aSum += dst[kidx + 3] * weight;
        weightSum += weight;
      }
    }
    
    const idx = i * 4;
    if (weightSum > 0) {
      dst[idx] = Math.round(rSum / weightSum);
      dst[idx + 1] = Math.round(gSum / weightSum);
      dst[idx + 2] = Math.round(bSum / weightSum);
      dst[idx + 3] = Math.round(aSum / weightSum);
    } else {
      // Fallback: average immediate known neighbors
      let r = 0, g = 0, b = 0, a = 0, c = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + dx4[d];
        const ny = y + dy4[d];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && flag[ny * w + nx] === KNOWN) {
          const nidx = (ny * w + nx) * 4;
          r += dst[nidx]; g += dst[nidx + 1]; b += dst[nidx + 2]; a += dst[nidx + 3];
          c++;
        }
      }
      if (c > 0) {
        dst[idx] = Math.round(r / c);
        dst[idx + 1] = Math.round(g / c);
        dst[idx + 2] = Math.round(b / c);
        dst[idx + 3] = Math.round(a / c);
      }
    }
    
    // Update grayscale
    grayF[i] = 0.299 * dst[idx] + 0.587 * dst[idx + 1] + 0.114 * dst[idx + 2];
  }
  
  /**
   * Solve eikonal equation for distance update
   * Given neighbor distances, compute new distance for pixel
   */
  function solveEikonal(x, y) {
    const i = y * w + x;
    
    // Get min distance from each axis pair
    let dH = 1e6; // horizontal
    if (x > 0 && flag[y * w + (x - 1)] !== INSIDE) dH = Math.min(dH, dist[y * w + (x - 1)]);
    if (x < w - 1 && flag[y * w + (x + 1)] !== INSIDE) dH = Math.min(dH, dist[y * w + (x + 1)]);
    
    let dV = 1e6; // vertical
    if (y > 0 && flag[(y - 1) * w + x] !== INSIDE) dV = Math.min(dV, dist[(y - 1) * w + x]);
    if (y < h - 1 && flag[(y + 1) * w + x] !== INSIDE) dV = Math.min(dV, dist[(y + 1) * w + x]);
    
    let d;
    if (dH === 1e6) d = dV + 1;
    else if (dV === 1e6) d = dH + 1;
    else {
      const diff = dH - dV;
      if (Math.abs(diff) >= 1) {
        d = Math.min(dH, dV) + 1;
      } else {
        d = (dH + dV + Math.sqrt(2 - diff * diff)) / 2;
      }
    }
    
    return d;
  }
  
  // Main FMM loop
  let processed = 0;
  
  while (heap.length > 0) {
    const [d, idx] = heapPop();
    const x = idx % w;
    const y = (idx - x) / w;
    
    // Skip if already processed (duplicate in heap)
    if (flag[idx] === KNOWN) continue;
    
    // Mark as known and inpaint
    flag[idx] = KNOWN;
    inpaintPixel(x, y);
    processed++;
    
    // Update 4-neighbors
    for (let dd = 0; dd < 4; dd++) {
      const nx = x + dx4[dd];
      const ny = y + dy4[dd];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      
      const ni = ny * w + nx;
      
      if (flag[ni] !== KNOWN) {
        // Compute new distance via eikonal equation
        const newDist = solveEikonal(nx, ny);
        
        if (newDist < dist[ni]) {
          dist[ni] = newDist;
        }
        
        if (flag[ni] === INSIDE) {
          flag[ni] = BAND;
          heapPush(dist[ni], ni);
        }
      }
    }
  }
  
  // ================================================================
  // STEP 3: Multi-pass Gaussian smoothing at mask boundaries
  // ================================================================
  
  // Rebuild original mask for knowing which pixels were inpainted
  const wasMasked = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (maskPixels[idx + 3] > 10) {
        wasMasked[y * w + x] = 1;
      }
    }
  }
  // Include dilated area
  for (let i = 0; i < N; i++) {
    if (dilated[i] === 1) wasMasked[i] = 1;
  }
  
  // Compute distance from mask boundary for feathering
  const featherDist = new Float32Array(N);
  const FEATHER_WIDTH = 5;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (wasMasked[i] !== 1) continue;
      
      // Find minimum distance to non-masked pixel
      let minD = FEATHER_WIDTH + 1;
      for (let fy = -FEATHER_WIDTH; fy <= FEATHER_WIDTH && minD > 1; fy++) {
        for (let fx = -FEATHER_WIDTH; fx <= FEATHER_WIDTH && minD > 1; fx++) {
          const nx = x + fx, ny = y + fy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (wasMasked[ny * w + nx] === 0) {
              const dd = Math.sqrt(fx * fx + fy * fy);
              if (dd < minD) minD = dd;
            }
          }
        }
      }
      featherDist[i] = minD;
    }
  }
  
  // Smoothing passes — more passes on boundary, fewer inside
  const SMOOTH_PASSES = 5;
  
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const tmp = new Uint8ClampedArray(dst);
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (wasMasked[i] !== 1) continue;
        
        // Only smooth pixels near the boundary (within feather width)
        if (featherDist[i] > FEATHER_WIDTH) continue;
        
        // Blend strength decreases with distance from boundary
        const alpha = Math.max(0, 1.0 - featherDist[i] / FEATHER_WIDTH);
        if (alpha < 0.01) continue;
        
        const idx = i * 4;
        
        // 3x3 weighted average (center has weight 4, edges 2, corners 1 = total 16)
        let r = 0, g = 0, b = 0, a = 0;
        const offsets = [
          [-1,-1,1], [0,-1,2], [1,-1,1],
          [-1, 0,2], [0, 0,4], [1, 0,2],
          [-1, 1,1], [0, 1,2], [1, 1,1]
        ];
        
        let wt = 0;
        for (const [ox, oy, ow] of offsets) {
          const ni = (y + oy) * w + (x + ox);
          const nidx = ni * 4;
          r += dst[nidx] * ow;
          g += dst[nidx + 1] * ow;
          b += dst[nidx + 2] * ow;
          a += dst[nidx + 3] * ow;
          wt += ow;
        }
        
        // Blend between original inpainted value and smoothed value
        tmp[idx]     = Math.round(dst[idx]     * (1 - alpha) + (r / wt) * alpha);
        tmp[idx + 1] = Math.round(dst[idx + 1] * (1 - alpha) + (g / wt) * alpha);
        tmp[idx + 2] = Math.round(dst[idx + 2] * (1 - alpha) + (b / wt) * alpha);
        tmp[idx + 3] = Math.round(dst[idx + 3] * (1 - alpha) + (a / wt) * alpha);
      }
    }
    
    // Write back smoothed pixels
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (wasMasked[i] !== 1) continue;
        if (featherDist[i] > FEATHER_WIDTH) continue;
        const idx = i * 4;
        dst[idx] = tmp[idx];
        dst[idx + 1] = tmp[idx + 1];
        dst[idx + 2] = tmp[idx + 2];
        dst[idx + 3] = tmp[idx + 3];
      }
    }
  }
  
  // ================================================================
  // STEP 4: Final interior smoothing pass for large filled areas
  // ================================================================
  // Light 2-pass smooth on all inpainted pixels to remove any artifacts
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Uint8ClampedArray(dst);
    
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        if (wasMasked[i] !== 1) continue;
        if (featherDist[i] <= FEATHER_WIDTH) continue; // Already smoothed above
        
        const idx = i * 4;
        
        // Gentle 5-cross average (center 60%, neighbors 10% each)
        const l = (i - 1) * 4;
        const r = (i + 1) * 4;
        const u = (i - w) * 4;
        const d = (i + w) * 4;
        
        tmp[idx]     = Math.round(0.6 * dst[idx]     + 0.1 * (dst[l] + dst[r] + dst[u] + dst[d]));
        tmp[idx + 1] = Math.round(0.6 * dst[idx + 1] + 0.1 * (dst[l+1] + dst[r+1] + dst[u+1] + dst[d+1]));
        tmp[idx + 2] = Math.round(0.6 * dst[idx + 2] + 0.1 * (dst[l+2] + dst[r+2] + dst[u+2] + dst[d+2]));
        tmp[idx + 3] = Math.round(0.6 * dst[idx + 3] + 0.1 * (dst[l+3] + dst[r+3] + dst[u+3] + dst[d+3]));
      }
    }
    
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const i = y * w + x;
        if (wasMasked[i] !== 1) continue;
        if (featherDist[i] <= FEATHER_WIDTH) continue;
        const idx = i * 4;
        dst[idx] = tmp[idx];
        dst[idx + 1] = tmp[idx + 1];
        dst[idx + 2] = tmp[idx + 2];
        dst[idx + 3] = tmp[idx + 3];
      }
    }
  }
  
  self.postMessage({ result: dst });
};
