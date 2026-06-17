# FIX INSTRUCTIONS — EraserPro AI (Watermark & Background Studio)

> **For: Antigravity IDE**
> **Goal:** Fix the two bugs below correctly in ONE pass. Adapt the code to the
> existing project structure — do NOT rewrite the whole app. Only change what is
> described here. Verify against the Acceptance Criteria before finishing.

---

## SCOPE — Fix ONLY these two bugs

1. **BUG 1:** Background remover → when user downloads as **JPG**, a **black image**
   is saved instead of the photo.
2. **BUG 2:** Watermark eraser → erasing the watermark **damages / corrupts the
   underlying background** instead of cleanly reconstructing it.

Do not touch billing, ads, or unrelated UI in this task.

---

## BUG 1 — JPG download saves a BLACK image

### Symptom
After background removal, the image has transparent pixels (alpha channel).
Exporting/downloading as **JPG** produces a fully black (or partly black) file.
PNG download works fine.

### Root Cause
**JPEG has no alpha channel.** When a canvas containing transparent pixels is
exported with `canvas.toBlob('image/jpeg')` or `toDataURL('image/jpeg')`, every
transparent pixel is rendered as **black**. This is expected browser behaviour,
not a corruption bug.

### Required Fix
Before exporting to JPG, **composite the image onto an opaque background**
(white by default, or the user's chosen background-fill color). Only do this for
JPEG. PNG/WEBP keep transparency.

Replace the export logic with a single helper used by ALL downloads:

```javascript
/**
 * Exports a canvas to a Blob.
 * @param {HTMLCanvasElement} sourceCanvas - the canvas holding the final image
 * @param {string} format - 'image/png' | 'image/jpeg' | 'image/webp'
 * @param {string} bgColor - background color for JPEG (default white)
 * @param {number} quality - 0..1 (used by jpeg/webp)
 */
function exportCanvasToBlob(sourceCanvas, format, bgColor = '#FFFFFF', quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
      reject(new Error('Export canvas is empty (width/height = 0).'));
      return;
    }

    let canvasToExport = sourceCanvas;

    // JPEG cannot store transparency -> transparent pixels become BLACK.
    // Fix: flatten onto an opaque background first.
    if (format === 'image/jpeg') {
      const flat = document.createElement('canvas');
      flat.width = sourceCanvas.width;
      flat.height = sourceCanvas.height;
      const ctx = flat.getContext('2d');
      ctx.fillStyle = bgColor;                 // opaque background
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(sourceCanvas, 0, 0);       // image on top
      canvasToExport = flat;
    }

    canvasToExport.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('toBlob returned null — canvas may be tainted (CORS) or too large.'));
        } else {
          resolve(blob);
        }
      },
      format,
      quality
    );
  });
}
```

Then wire the download button to it, e.g.:

```javascript
async function downloadImage(format) {
  try {
    // If user picked a background-fill color in the UI, pass it here.
    const bg = currentBackgroundColor || '#FFFFFF';
    const blob = await exportCanvasToBlob(finalCanvas, format, bg);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eraserpro.${format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1]}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert('Download failed: ' + e.message);
  }
}
```

### Extra gotcha to also handle (same bug family)
If the source image was loaded from a remote URL (e.g. the Unsplash sample
images) **without** `crossOrigin = 'anonymous'`, the canvas becomes **tainted**
and `toBlob` returns `null` → which can also present as a failed/black download.
Ensure every `Image` used to draw onto an exportable canvas sets:

```javascript
const img = new Image();
img.crossOrigin = 'anonymous';   // BEFORE setting img.src
img.src = url;
```

### Acceptance Criteria — BUG 1
- [ ] Remove background, download as **JPG** → photo appears on a **white**
      (or chosen-color) background, **NOT black**.
- [ ] Same image as **PNG** → transparency preserved.
- [ ] Same image as **WEBP** → transparency preserved.
- [ ] Downloading a sample (remote) image as JPG also works (no taint error).

---

## BUG 2 — Watermark eraser damages the background

### Symptom
When the user brushes over a watermark and clicks **Erase Watermark**, the
brushed area is wiped/smeared and the **original background underneath is
destroyed** (solid patch, hole, or smudge) instead of being cleanly filled.

### Root Cause (one or both)
1. The brush is painting **directly onto the image pixels** (destructive),
   instead of onto a **separate mask layer**. So the original data is lost.
2. The "erase" step **fills the masked area with a flat color / clears to
   transparent / naive blur**, instead of doing real **inpainting** that
   reconstructs the area from surrounding pixels.

### Required Fix — Architecture (this is the important part)
Keep **three** separate things, never overwrite the original:

| Layer            | Purpose                                                    |
|------------------|------------------------------------------------------------|
| `originalImage`  | Pristine source pixels. **Never modified.**                |
| `maskCanvas`     | Same size as image. Brush paints **white** here (= remove).|
| `displayCanvas`  | What the user sees = result of inpaint(original, mask).     |

Brush strokes go to **`maskCanvas` only**. The result is always recomputed as
`inpaint(originalImage, maskCanvas)`. This makes the eraser non-destructive and
Undo/Clear trivial (just edit the mask).

### Required Fix — Use real inpainting (OpenCV.js)
Use OpenCV.js `cv.inpaint` (Telea algorithm). It reconstructs the masked region
from neighbouring pixels — this is what makes the background look intact.

**1. Load OpenCV.js once (in `<head>` or before the editor loads):**
```html
<script async src="https://docs.opencv.org/4.x/opencv.js" onload="onOpenCvReady()"></script>
```
Gate the editor until ready:
```javascript
let cvReady = false;
function onOpenCvReady() { cvReady = true; }
```

**2. Brush onto the mask (NOT the image):**
```javascript
// maskCanvas is the SAME pixel dimensions as the image.
// Background of maskCanvas must start fully BLACK (0,0,0).
function paintMask(x, y, brushSize) {
  const mctx = maskCanvas.getContext('2d');
  mctx.fillStyle = '#FFFFFF';          // white = "remove this area"
  mctx.beginPath();
  mctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
  mctx.fill();
  renderInpaint();                     // live preview (or call on mouseup for perf)
}
```
> Make sure brush coordinates are scaled from the displayed (CSS) size to the
> real canvas pixel size, otherwise the mask lands in the wrong place.

**3. Run inpainting from the ORIGINAL + mask:**
```javascript
function renderInpaint() {
  if (!cvReady) { alert('AI engine still loading, try again in a second.'); return; }

  // Always read from a canvas holding the PRISTINE original image.
  const src    = cv.imread(originalCanvas);   // RGBA
  const maskM  = cv.imread(maskCanvas);       // RGBA

  // inpaint needs 8UC3 source + 8UC1 mask
  const srcRGB = new cv.Mat();
  cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);

  const maskGray = new cv.Mat();
  cv.cvtColor(maskM, maskGray, cv.COLOR_RGBA2GRAY);
  cv.threshold(maskGray, maskGray, 10, 255, cv.THRESH_BINARY);

  // Slightly grow the mask so watermark edges are fully covered.
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  cv.dilate(maskGray, maskGray, kernel);

  const dst = new cv.Mat();
  const inpaintRadius = 3;
  cv.inpaint(srcRGB, maskGray, dst, inpaintRadius, cv.INPAINT_TELEA);

  cv.imshow(displayCanvas, dst);   // show result

  // free memory (REQUIRED in OpenCV.js or it leaks/crashes)
  src.delete(); maskM.delete(); srcRGB.delete();
  maskGray.delete(); dst.delete(); kernel.delete();
}
```

**4. Undo / Clear** = just clear or pop strokes from `maskCanvas`, then call
`renderInpaint()`. The original is never touched, so recovery is perfect.

**5. Download** = export `displayCanvas` using the BUG 1 helper above.

### Why the old code broke the background (explain in commit msg)
The previous code either painted on the image directly or filled the brushed
region with a flat value, so there was no real reconstruction — that flat patch
IS the "damaged background" the user sees. Inpainting from surrounding pixels
fixes it.

### Acceptance Criteria — BUG 2
- [ ] Brushing over a watermark and erasing reconstructs the area; surrounding
      background stays intact (no black hole, no solid patch, no transparent gap).
- [ ] The original image is never mutated — **Undo** and **Clear** fully restore.
- [ ] Brush mark lands exactly under the cursor at all zoom/display sizes.
- [ ] No OpenCV memory leak (every `cv.Mat` is `.delete()`-ed).
- [ ] Result can be downloaded as PNG **and** JPG correctly (uses BUG 1 fix).

---

## GLOBAL DO-NOT LIST (avoid breaking things)
- ❌ Do NOT paint the brush directly onto the image canvas.
- ❌ Do NOT fill the erased area with a solid color or `clearRect`.
- ❌ Do NOT export JPEG straight from a transparent canvas.
- ❌ Do NOT forget `crossOrigin = 'anonymous'` on remote images.
- ❌ Do NOT skip `cv.Mat.delete()` — it will crash on repeated use.
- ❌ Do NOT change pricing, AdSense, Stripe, or other unrelated features here.

## FINAL VERIFICATION (run before declaring done)
1. Upload a real photo with a visible watermark.
2. Brush only the watermark → Erase → background looks clean & continuous.
3. Undo → watermark returns; Clear → fully back to original.
4. Download as JPG → real photo on white bg (not black).
5. Download as PNG → transparent where expected.
6. Repeat erase 5+ times on different images → no crash, no slowdown buildup.

If all 6 pass, the task is complete.
