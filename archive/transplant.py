import re

with open('new_editor.html', 'r') as f:
    html = f.read()

# 1. Add script tags from old editor to the head
scripts = """
  <!-- FontAwesome for Premium Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script async src="https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.3/dist/opencv.js" onload="onOpenCvReady()"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
"""
html = html.replace('</head>', scripts + '\n</head>')

# 2. Add app.js at the end of body
app_js = '<script type="module" src="app.js"></script>'
html = html.replace('</body>', app_js + '\n</body>')

# 3. Add main ID for app.js to find the workspace
html = html.replace('<main class="flex-1 relative', '<main id="editorWorkspace" class="flex-1 relative workspace-section active canvas-workspace"')

# 4. Canvas transplant
# Find the center image area
canvas_html = """
<div class="canvas-box" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative;">
    <!-- Loading Overlay -->
    <div class="loading-overlay hidden" id="processingOverlay" style="position: absolute; z-index: 100; background: rgba(0,0,0,0.5); color: white; display: none;">
      <h3 id="processingStatus">Processing...</h3>
    </div>
    
    <!-- WATERMARK REMOVER VIEW -->
    <div class="workspace-view active" id="view-wm-remover" style="position: relative;">
        <div class="editor-canvas-wrapper" style="position: relative; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.08);">
            <div class="canvas-bg-pattern" style="position: relative;">
                <div class="canvas-layers" style="position: relative;">
                    <canvas id="wmRemoverBaseCanvas"></canvas>
                    <canvas id="wmRemoverBrushCanvas" style="position: absolute; top: 0; left: 0; z-index: 10;"></canvas>
                </div>
            </div>
        </div>
    </div>
</div>
"""
# Replace the image tag with our canvas box
img_pattern = r'<img alt="Main artwork canvas"[^>]+>'
html = re.sub(img_pattern, canvas_html, html)

# 5. Connect buttons
# Export button
html = html.replace('>Export</button>', ' id="btnDownloadImage">Export</button>')

# The "Remove Watermark" panel buttons
html = html.replace('<button class="flex-1 py-1.5 font-label-md text-label-md bg-surface-container-lowest shadow-sm rounded-md text-on-surface">Auto</button>',
                    '<button id="clearBrush" class="flex-1 py-1.5 font-label-md text-label-md bg-surface-container-lowest shadow-sm rounded-md text-on-surface">Clear Brush</button>')
html = html.replace('<button class="flex-1 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Manual</button>',
                    '<button id="undoBrush" class="flex-1 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Undo Brush</button>')

# Add brush size slider below the segmented control
brush_slider = """
<div class="mt-4 mb-2 flex items-center justify-between">
    <label for="brushSize" class="text-sm font-medium">Brush Size</label>
    <span id="brushSizeVal" class="text-sm">25px</span>
</div>
<input type="range" id="brushSize" min="5" max="100" value="25" class="w-full accent-primary">
"""
html = html.replace('Our AI auto detects all the watermarks in the image and removes them seamlessly.', brush_slider)

html = html.replace('Apply for 1 🪙', 'Erase Watermark')
html = html.replace('<button class="w-full py-2.5 mt-2 bg-primary-container text-on-primary', '<button id="btnEraseWatermark" class="w-full py-2.5 mt-2 bg-primary-container text-on-primary')

# Connect the bottom toolbar buttons as Tool switchers
html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group">', 
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group tab-btn" data-tab="bg-remover">')

html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center bg-primary-container text-on-primary transition-colors shadow-sm">',
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center bg-primary-container text-on-primary transition-colors shadow-sm tab-btn active" data-tab="wm-remover">')

html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group">\n<span class="material-symbols-outlined text-[20px] mb-0.5">approval</span>',
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group tab-btn" data-tab="wm-maker">\n<span class="material-symbols-outlined text-[20px] mb-0.5">approval</span>')

# Connect zoom controls (using the bottom right pill)
html = html.replace('<span class="font-mono-label text-mono-label text-on-surface-variant">90%</span>',
                    '<span id="zoomLevelVal" class="font-mono-label text-mono-label text-on-surface-variant">100%</span>')
html = html.replace('<span class="font-mono-label text-mono-label text-on-surface-variant">1856x2304 px</span>',
                    '<button id="zoomInBtn" class="font-mono-label text-mono-label text-on-surface-variant hover:text-primary">+</button><div class="w-px h-4 bg-outline-variant"></div><button id="zoomOutBtn" class="font-mono-label text-mono-label text-on-surface-variant hover:text-primary">-</button>')


with open('transplanted_editor.html', 'w') as f:
    f.write(html)
print("Transplant successful.")
