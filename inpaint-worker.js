/**
 * Exemplar-Based Inpainting Worker (Criminisi-inspired)
 * 
 * This worker implements a patch-based inpainting algorithm that reconstructs
 * the image content under watermarks by finding and copying the most similar
 * texture patches from the surrounding image. Unlike simple Laplace diffusion
 * which just blurs/averages colors, this method preserves texture, edges, and
 * image structure.
 * 
 * Algorithm:
 * 1. Build a fill-front (boundary between masked and known pixels)
 * 2. For each boundary pixel, compute priority based on confidence and edge data
 * 3. Pick the highest-priority pixel and find the best matching patch from known areas
 * 4. Copy that patch into the masked area
 * 5. Update confidence values and repeat until the mask is filled
 */

self.onmessage = function(e) {
  const { imgWidth, imgHeight, imgPixels, maskPixels } = e.data;
  
  const w = imgWidth;
  const h = imgHeight;
  const totalPixels = w * h;
  
  // Working copy of pixel data (RGBA)
  const dst = new Uint8ClampedArray(imgPixels);
  
  // Build binary mask from brush overlay (alpha > 10 means masked)
  const mask = new Uint8Array(totalPixels);
  let hasMask = false;
  let minX = w, maxX = 0, minY = h, maxY = 0;
  
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
  
  // Dilate mask by 3px to cover anti-aliased watermark edges
  const dilationRadius = 3;
  const dilatedMask = new Uint8Array(totalPixels);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * w + x] === 1) {
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
  
  // Use dilated mask as the working mask
  for (let i = 0; i < totalPixels; i++) {
    mask[i] = dilatedMask[i];
  }
  
  // Recompute bounding box after dilation
  minX = w; maxX = 0; minY = h; maxY = 0;
  let maskedCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 1) {
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
  
  // === EXEMPLAR-BASED PATCH INPAINTING ===
  
  const PATCH_RADIUS = 4; // 9x9 patches
  const PATCH_SIZE = PATCH_RADIUS * 2 + 1;
  const SEARCH_RADIUS = 40; // Search area around each fill-front pixel
  
  // Confidence array: 1.0 for known pixels, 0.0 for masked
  const confidence = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    confidence[i] = mask[i] === 0 ? 1.0 : 0.0;
  }
  
  // Remaining mask count
  let remaining = maskedCount;
  
  // Grayscale for gradient computation
  const gray = new Float32Array(totalPixels);
  function updateGrayscale() {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * dst[idx] + 0.587 * dst[idx + 1] + 0.114 * dst[idx + 2];
    }
  }
  updateGrayscale();
  
  // Compute gradient at a pixel (Sobel-like)
  function getGradient(x, y) {
    if (x <= 0 || x >= w - 1 || y <= 0 || y >= h - 1) return { gx: 0, gy: 0 };
    const gx = gray[y * w + (x + 1)] - gray[y * w + (x - 1)];
    const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
    return { gx, gy };
  }
  
  // Compute normal to the fill-front at a boundary pixel
  function getFrontNormal(x, y) {
    // Normal is gradient of the mask (pointing from filled toward unfilled)
    let nx = 0, ny = 0;
    if (x > 0 && x < w - 1) {
      nx = (mask[y * w + (x + 1)] === 1 ? 1 : 0) - (mask[y * w + (x - 1)] === 1 ? 1 : 0);
    }
    if (y > 0 && y < h - 1) {
      ny = (mask[(y + 1) * w + x] === 1 ? 1 : 0) - (mask[(y - 1) * w + x] === 1 ? 1 : 0);
    }
    const len = Math.sqrt(nx * nx + ny * ny);
    if (len > 0) { nx /= len; ny /= len; }
    return { nx, ny };
  }
  
  // Check if pixel is on the fill-front (masked pixel adjacent to known pixel)
  function isFillFront(x, y) {
    if (mask[y * w + x] !== 1) return false;
    if (x > 0 && mask[y * w + (x - 1)] === 0) return true;
    if (x < w - 1 && mask[y * w + (x + 1)] === 0) return true;
    if (y > 0 && mask[(y - 1) * w + x] === 0) return true;
    if (y < h - 1 && mask[(y + 1) * w + x] === 0) return true;
    return false;
  }
  
  // Compute patch distance (SSD) between source patch at (sx,sy) and target patch at (tx,ty)
  // Only compare pixels where the target patch has known values
  function patchSSD(tx, ty, sx, sy) {
    let ssd = 0;
    let count = 0;
    
    for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
      for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
        const tpx = tx + dx;
        const tpy = ty + dy;
        const spx = sx + dx;
        const spy = sy + dy;
        
        // Both must be in bounds
        if (tpx < 0 || tpx >= w || tpy < 0 || tpy >= h) continue;
        if (spx < 0 || spx >= w || spy < 0 || spy >= h) continue;
        
        // Only compare where target patch pixel is known (not masked)
        if (mask[tpy * w + tpx] === 1) continue;
        
        // Source patch pixel must also be known
        if (mask[spy * w + spx] === 1) return Infinity;
        
        const tidx = (tpy * w + tpx) * 4;
        const sidx = (spy * w + spx) * 4;
        
        const dr = dst[tidx] - dst[sidx];
        const dg = dst[tidx + 1] - dst[sidx + 1];
        const db = dst[tidx + 2] - dst[sidx + 2];
        
        ssd += dr * dr + dg * dg + db * db;
        count++;
      }
    }
    
    if (count === 0) return Infinity;
    return ssd / count; // Normalized SSD
  }
  
  // Main inpainting loop
  const MAX_ITERATIONS = maskedCount * 3; // Safety limit
  let iterations = 0;
  
  while (remaining > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    
    // 1. Find all fill-front pixels and compute their priorities
    let bestPriority = -Infinity;
    let bestX = -1, bestY = -1;
    
    const searchMinY = Math.max(0, minY - 1);
    const searchMaxY = Math.min(h - 1, maxY + 1);
    const searchMinX = Math.max(0, minX - 1);
    const searchMaxX = Math.min(w - 1, maxX + 1);
    
    for (let y = searchMinY; y <= searchMaxY; y++) {
      for (let x = searchMinX; x <= searchMaxX; x++) {
        if (!isFillFront(x, y)) continue;
        
        // Confidence term: average confidence in the patch
        let confSum = 0;
        let confCount = 0;
        for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
          for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              confSum += confidence[py * w + px];
              confCount++;
            }
          }
        }
        const C = confCount > 0 ? confSum / confCount : 0;
        
        // Data term: strength of isophote hitting the fill-front normal
        const grad = getGradient(x, y);
        const normal = getFrontNormal(x, y);
        // Isophote direction is perpendicular to gradient
        const D = Math.abs(-grad.gy * normal.nx + grad.gx * normal.ny) / 255.0 + 0.001;
        
        const priority = C * D;
        
        if (priority > bestPriority) {
          bestPriority = priority;
          bestX = x;
          bestY = y;
        }
      }
    }
    
    if (bestX === -1) break; // No fill-front found
    
    // 2. Find the best matching source patch for the target patch at (bestX, bestY)
    let bestSSD = Infinity;
    let bestSX = -1, bestSY = -1;
    
    // Adaptive search: search locally first, then expand if needed
    const localSearchR = Math.min(SEARCH_RADIUS, Math.max(maxX - minX, maxY - minY));
    const sMinY = Math.max(PATCH_RADIUS, bestY - localSearchR);
    const sMaxY = Math.min(h - 1 - PATCH_RADIUS, bestY + localSearchR);
    const sMinX = Math.max(PATCH_RADIUS, bestX - localSearchR);
    const sMaxX = Math.min(w - 1 - PATCH_RADIUS, bestX + localSearchR);
    
    // Step size for search (2 = every other pixel for speed, then refine)
    const step = 2;
    
    for (let sy = sMinY; sy <= sMaxY; sy += step) {
      for (let sx = sMinX; sx <= sMaxX; sx += step) {
        // Source patch center must be entirely known
        if (mask[sy * w + sx] === 1) continue;
        
        const ssd = patchSSD(bestX, bestY, sx, sy);
        if (ssd < bestSSD) {
          bestSSD = ssd;
          bestSX = sx;
          bestSY = sy;
        }
      }
    }
    
    // Refine around best coarse match
    if (bestSX !== -1) {
      const refineR = step;
      const rMinY = Math.max(PATCH_RADIUS, bestSY - refineR);
      const rMaxY = Math.min(h - 1 - PATCH_RADIUS, bestSY + refineR);
      const rMinX = Math.max(PATCH_RADIUS, bestSX - refineR);
      const rMaxX = Math.min(w - 1 - PATCH_RADIUS, bestSX + refineR);
      
      for (let sy = rMinY; sy <= rMaxY; sy++) {
        for (let sx = rMinX; sx <= rMaxX; sx++) {
          if (mask[sy * w + sx] === 1) continue;
          const ssd = patchSSD(bestX, bestY, sx, sy);
          if (ssd < bestSSD) {
            bestSSD = ssd;
            bestSX = sx;
            bestSY = sy;
          }
        }
      }
    }
    
    // If local search failed, do a global sparse search
    if (bestSX === -1) {
      const globalStep = 8;
      for (let sy = PATCH_RADIUS; sy < h - PATCH_RADIUS; sy += globalStep) {
        for (let sx = PATCH_RADIUS; sx < w - PATCH_RADIUS; sx += globalStep) {
          if (mask[sy * w + sx] === 1) continue;
          const ssd = patchSSD(bestX, bestY, sx, sy);
          if (ssd < bestSSD) {
            bestSSD = ssd;
            bestSX = sx;
            bestSY = sy;
          }
        }
      }
    }
    
    if (bestSX === -1) {
      // Absolute fallback: just fill with the nearest known pixel average
      let rS = 0, gS = 0, bS = 0, aS = 0, cnt = 0;
      for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
        for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
          const px = bestX + dx;
          const py = bestY + dy;
          if (px >= 0 && px < w && py >= 0 && py < h && mask[py * w + px] === 0) {
            const pidx = (py * w + px) * 4;
            rS += dst[pidx]; gS += dst[pidx + 1]; bS += dst[pidx + 2]; aS += dst[pidx + 3];
            cnt++;
          }
        }
      }
      if (cnt > 0) {
        const pidx = (bestY * w + bestX) * 4;
        dst[pidx] = Math.round(rS / cnt);
        dst[pidx + 1] = Math.round(gS / cnt);
        dst[pidx + 2] = Math.round(bS / cnt);
        dst[pidx + 3] = Math.round(aS / cnt);
      }
      mask[bestY * w + bestX] = 0;
      confidence[bestY * w + bestX] = 0.001;
      remaining--;
      continue;
    }
    
    // 3. Copy the best matching source patch into the target patch (only masked pixels)
    let filledThisRound = 0;
    const confValue = confidence[bestY * w + bestX] > 0 ? confidence[bestY * w + bestX] : bestPriority;
    
    for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
      for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
        const tpx = bestX + dx;
        const tpy = bestY + dy;
        const spx = bestSX + dx;
        const spy = bestSY + dy;
        
        if (tpx < 0 || tpx >= w || tpy < 0 || tpy >= h) continue;
        if (spx < 0 || spx >= w || spy < 0 || spy >= h) continue;
        
        const tOff = tpy * w + tpx;
        
        // Only fill masked pixels
        if (mask[tOff] !== 1) continue;
        
        const tidx = tOff * 4;
        const sidx = (spy * w + spx) * 4;
        
        dst[tidx] = dst[sidx];
        dst[tidx + 1] = dst[sidx + 1];
        dst[tidx + 2] = dst[sidx + 2];
        dst[tidx + 3] = dst[sidx + 3];
        
        mask[tOff] = 0;
        confidence[tOff] = confValue;
        remaining--;
        filledThisRound++;
      }
    }
    
    // Update grayscale for filled pixels
    if (filledThisRound > 0) {
      for (let dy = -PATCH_RADIUS; dy <= PATCH_RADIUS; dy++) {
        for (let dx = -PATCH_RADIUS; dx <= PATCH_RADIUS; dx++) {
          const px = bestX + dx;
          const py = bestY + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const pidx = (py * w + px) * 4;
            gray[py * w + px] = 0.299 * dst[pidx] + 0.587 * dst[pidx + 1] + 0.114 * dst[pidx + 2];
          }
        }
      }
    }
    
    // Safety: if nothing was filled this round, we're stuck
    if (filledThisRound === 0) {
      // Force fill the single pixel
      const pidx = (bestY * w + bestX) * 4;
      let rS = 0, gS = 0, bS = 0, aS = 0, cnt = 0;
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [ddx, ddy] of dirs) {
        const nx = bestX + ddx;
        const ny = bestY + ddy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx] === 0) {
          const nidx = (ny * w + nx) * 4;
          rS += dst[nidx]; gS += dst[nidx+1]; bS += dst[nidx+2]; aS += dst[nidx+3];
          cnt++;
        }
      }
      if (cnt > 0) {
        dst[pidx] = Math.round(rS / cnt);
        dst[pidx+1] = Math.round(gS / cnt);
        dst[pidx+2] = Math.round(bS / cnt);
        dst[pidx+3] = Math.round(aS / cnt);
      }
      mask[bestY * w + bestX] = 0;
      confidence[bestY * w + bestX] = 0.001;
      remaining--;
    }
    
    // Update bounding box (shrink if possible)
    if (remaining > 0 && iterations % 100 === 0) {
      minX = w; maxX = 0; minY = h; maxY = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask[y * w + x] === 1) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }
  }
  
  // === POST-PROCESSING: Seamless blending pass ===
  // Light Poisson-like blending to smooth any patch boundary seams
  // We use the original mask to know which pixels were inpainted
  const originalMask = new Uint8Array(totalPixels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (maskPixels[idx + 3] > 10) {
        originalMask[y * w + x] = 1;
      }
    }
  }
  // Dilate to match
  const blendMask = new Uint8Array(totalPixels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (originalMask[y * w + x] === 1) {
        for (let dy = -dilationRadius; dy <= dilationRadius; dy++) {
          for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              blendMask[ny * w + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  // Feathered blend: for pixels near the mask boundary, blend with neighbor average
  const BLEND_PASSES = 3;
  for (let pass = 0; pass < BLEND_PASSES; pass++) {
    const tmpDst = new Uint8ClampedArray(dst);
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const off = y * w + x;
        if (blendMask[off] !== 1) continue;
        
        // Check if near boundary (within 2px of a non-masked pixel)
        let nearBoundary = false;
        for (let dy = -2; dy <= 2 && !nearBoundary; dy++) {
          for (let dx = -2; dx <= 2 && !nearBoundary; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h && blendMask[ny * w + nx] === 0) {
              nearBoundary = true;
            }
          }
        }
        
        if (!nearBoundary) continue;
        
        // Weighted average with 4-neighbors
        const idx = off * 4;
        const l = (off - 1) * 4;
        const r = (off + 1) * 4;
        const u = (off - w) * 4;
        const d = (off + w) * 4;
        
        tmpDst[idx]     = Math.round(0.5 * dst[idx]     + 0.125 * (dst[l] + dst[r] + dst[u] + dst[d]));
        tmpDst[idx + 1] = Math.round(0.5 * dst[idx + 1] + 0.125 * (dst[l+1] + dst[r+1] + dst[u+1] + dst[d+1]));
        tmpDst[idx + 2] = Math.round(0.5 * dst[idx + 2] + 0.125 * (dst[l+2] + dst[r+2] + dst[u+2] + dst[d+2]));
        tmpDst[idx + 3] = Math.round(0.5 * dst[idx + 3] + 0.125 * (dst[l+3] + dst[r+3] + dst[u+3] + dst[d+3]));
      }
    }
    
    // Copy back
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const off = y * w + x;
        if (blendMask[off] !== 1) continue;
        const idx = off * 4;
        dst[idx] = tmpDst[idx];
        dst[idx + 1] = tmpDst[idx + 1];
        dst[idx + 2] = tmpDst[idx + 2];
        dst[idx + 3] = tmpDst[idx + 3];
      }
    }
  }
  
  self.postMessage({ result: dst });
};
