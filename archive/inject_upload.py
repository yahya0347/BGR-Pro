import re

with open('index.html', 'r') as f:
    html = f.read()

# Remove the dummy uploadLanding if it exists
html = re.sub(r'<div id="uploadLanding"></div>\n?', '', html)
html = re.sub(r'<div id="fileInput"></div>\n?', '', html)
html = re.sub(r'<div id="dropZone"></div>\n?', '', html)
html = re.sub(r'<div id="btnUploadCTA"></div>\n?', '', html)

upload_landing_html = """
<!-- Upload Landing Area -->
<main id="uploadLanding" class="flex-1 relative workspace-section active flex flex-col items-center justify-center bg-background z-50">
    <div class="max-w-2xl w-full mx-auto px-4 text-center">
        <h1 class="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">Upload an Image</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant mb-8">Drag and drop an image here, or click to browse your files.</p>
        
        <div id="dropZone" class="w-full h-64 rounded-2xl border-2 border-dashed border-primary bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-colors duration-200">
            <span class="material-symbols-outlined text-5xl text-primary mb-4">cloud_upload</span>
            <div class="font-label-lg text-label-lg text-primary">Click or drag image to upload</div>
            <div class="font-body-md text-body-md text-on-surface-variant mt-2">Supports JPG, PNG, WEBP (Max 10MB)</div>
        </div>
        
        <button id="btnUploadCTA" class="mt-8 px-8 py-3 bg-primary text-on-primary rounded-full font-label-lg text-label-lg shadow-md hover:shadow-lg hover:bg-primary/90 transition-all duration-200">
            Browse Files
        </button>
        <input type="file" id="fileInput" accept="image/png, image/jpeg, image/webp" class="hidden">
    </div>
</main>
"""

# Inject before editorWorkspace
# We need to make sure editorWorkspace does NOT have 'active' by default.
html = html.replace('<main id="editorWorkspace" class="flex-1 relative workspace-section active canvas-workspace"', 
                   upload_landing_html + '\n<main id="editorWorkspace" class="flex-1 relative workspace-section canvas-workspace"')

with open('index.html', 'w') as f:
    f.write(html)

