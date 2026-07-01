import re

with open('app.js', 'r') as f:
    js = f.read()

# Replace backToUploadBtn logic
old_logic = """  // Back to upload button (triggers file selector directly instead of leaving workspace)
  elements.backToUploadBtn.addEventListener('click', () => {
    elements.fileInput.click();
  });"""

new_logic = """  // Back to upload button (Home button) resets to upload landing
  elements.backToUploadBtn.addEventListener('click', () => {
    state.originalImage = null;
    state.transparentImage = null;
    state.eraserBaseImage = null;
    state.brushStrokes = [];
    state.redoStrokes = [];
    state.bgRemoved = false;
    wmHistory.clear();
    
    if (elements.editorWorkspace) elements.editorWorkspace.classList.remove('active');
    if (elements.uploadLanding) elements.uploadLanding.classList.add('active');
  });"""

js = js.replace(old_logic, new_logic)

# Also fix the init logic where it looks for localStorage
init_logic = """  // Check if we came from landing page with an image
  const storedImage = localStorage.getItem('eraserpro_uploaded_image');
  if (storedImage) {
    processUploadedImage(storedImage);
    localStorage.removeItem('eraserpro_uploaded_image');
  }"""

new_init_logic = """  // Initially show upload landing and hide workspace
  if (elements.editorWorkspace) elements.editorWorkspace.classList.remove('active');
  if (elements.uploadLanding) elements.uploadLanding.classList.add('active');
"""

js = js.replace(init_logic, new_init_logic)

with open('app.js', 'w') as f:
    f.write(js)

