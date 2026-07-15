import re

with open('new_editor.html', 'r') as f:
    html = f.read()

# 1. Scripts
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
html = html.replace('</body>', '<script type="module" src="app.js?v=37"></script>\n</body>')

# 2. Main ID
html = html.replace('<main class="flex-1 relative', '<main id="editorWorkspace" class="flex-1 relative workspace-section active canvas-workspace"')

# 3. Titles and Developer links
html = html.replace('Lumina Editor Workspace', 'EraserPro Editor Workspace')
html = html.replace('Lumina Editor', 'EraserPro')
html = re.sub(r'<a[^>]*>Developers</a>', '', html)

# 4. Connect Buttons
# Home button
html = html.replace('<a class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded" href="#">Home</a>',
                    '<a id="backToUploadBtn" style="cursor:pointer;" class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded" href="javascript:void(0)">Home</a>')

# Export button
html = html.replace('<button class="px-4 py-2 font-label-md text-label-md bg-primary-container text-on-primary rounded-[16px] hover:opacity-90 transition-opacity">\n                Export\n            </button>',
                    '<button id="btnDownloadImage" class="px-4 py-2 font-label-md text-label-md bg-primary-container text-on-primary rounded-[16px] hover:opacity-90 transition-opacity">Export</button>')

# Clear / Undo brush
html = html.replace('<button class="flex-1 py-1.5 font-label-md text-label-md bg-surface-container-lowest shadow-sm rounded-md text-on-surface">Auto</button>',
                    '<button id="clearBrush" class="flex-1 py-1.5 font-label-md text-label-md bg-surface-container-lowest shadow-sm rounded-md text-on-surface">Clear Brush</button>')
html = html.replace('<button class="flex-1 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Manual</button>',
                    '<button id="undoBrush" class="flex-1 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Undo Brush</button>')

# Erase watermark
html = html.replace('Apply for 1 🪙', 'Erase Watermark')
html = html.replace('<button class="w-full py-2.5 mt-2 bg-primary-container text-on-primary', '<button id="btnEraseWatermark" class="w-full py-2.5 mt-2 bg-primary-container text-on-primary')

# Bottom toolbar
html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group">', 
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group tab-btn" data-tab="bg-remover" title="Background Remover">')

html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center bg-primary-container text-on-primary transition-colors shadow-sm">',
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center bg-primary-container text-on-primary transition-colors shadow-sm tab-btn active" data-tab="wm-remover" title="Watermark Eraser">')

html = html.replace('<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group">\n<span class="material-symbols-outlined text-[20px] mb-0.5">approval</span>',
                    '<button class="w-12 h-12 rounded-full flex flex-col items-center justify-center text-on-surface-variant hover:bg-[#e0e7ff] hover:text-primary-container transition-colors group tab-btn" data-tab="wm-maker" title="Watermark Maker">\n<span class="material-symbols-outlined text-[20px] mb-0.5">approval</span>')

html = html.replace('BG Remover</span>', 'Background Remover</span>')
html = html.replace('WM Eraser</span>', 'Watermark Eraser</span>')
html = html.replace('WM Maker</span>', 'Watermark Maker</span>')

# Zoom controls
html = html.replace('<span class="font-mono-label text-mono-label text-on-surface-variant">90%</span>',
                    '<span id="zoomLevelVal" class="font-mono-label text-mono-label text-on-surface-variant">100%</span>')
html = html.replace('<span class="font-mono-label text-mono-label text-on-surface-variant">1856x2304 px</span>',
                    '<button id="zoomInBtn" class="font-mono-label text-mono-label text-on-surface-variant hover:text-primary">+</button><div class="w-px h-4 bg-outline-variant"></div><button id="zoomOutBtn" class="font-mono-label text-mono-label text-on-surface-variant hover:text-primary">-</button>')

# Brush size slider
brush_slider = """
<div class="mt-4 mb-2 flex items-center justify-between">
    <label for="brushSize" class="text-sm font-medium">Brush Size</label>
    <span id="brushSizeVal" class="text-sm">25px</span>
</div>
<input type="range" id="brushSize" min="5" max="100" value="25" class="w-full accent-primary">
"""
html = html.replace('Our AI auto detects all the watermarks in the image and removes them seamlessly.', brush_slider)

# Canvas Transplant
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
    
    <!-- BG REMOVER VIEW (Hidden) -->
    <div class="workspace-view" id="view-bg-remover" style="display:none;">
        <div class="preview-container">
            <div class="preview-image-wrapper" id="bgRemoverResultContainer">
                <canvas id="bgRemoverCanvas" class="checkerboard-bg"></canvas>
            </div>
        </div>
    </div>

    <!-- WATERMARK MAKER VIEW (Hidden) -->
    <div class="workspace-view" id="view-wm-maker" style="display:none;">
        <div class="editor-canvas-wrapper">
            <canvas id="wmMakerCanvas" class="checkerboard-bg"></canvas>
        </div>
    </div>
</div>
"""
img_pattern = r'<img alt="Main artwork canvas"[^>]+>'
html = re.sub(img_pattern, canvas_html, html)

with open('editor.html', 'w') as f:
    f.write(html)
