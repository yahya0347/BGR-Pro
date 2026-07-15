import re
with open('transplanted_editor.html', 'r') as f:
    html = f.read()

additional_canvases = """
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
"""

# Replace the current wmRemover view with all three
pattern = r'<!-- WATERMARK REMOVER VIEW -->.*?</div>\s*</div>\s*</div>'
html = re.sub(pattern, additional_canvases, html, flags=re.DOTALL)

with open('transplanted_editor.html', 'w') as f:
    f.write(html)
