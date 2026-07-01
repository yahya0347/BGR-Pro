import re
with open('editor.html', 'r') as f:
    html = f.read()

html = html.replace('BG Remover</span>', 'Background Remover</span>')
html = html.replace('WM Eraser</span>', 'Watermark Eraser</span>')
html = html.replace('WM Maker</span>', 'Watermark Maker</span>')

# Also fix Developer option. I already removed <a ...>Developers</a> but maybe it was a different tag? Let's check.
