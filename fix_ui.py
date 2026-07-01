import re

with open('editor.html', 'r') as f:
    html = f.read()

# 1. Change Lumina to EraserPro
html = html.replace('Lumina Editor Workspace', 'EraserPro Editor Workspace')
html = html.replace('Lumina Editor', 'EraserPro')

# 2. Remove Developers link
html = re.sub(r'<a[^>]*>Developers</a>', '', html)

# 3. Add Tooltips to bottom toolbar
html = html.replace('data-tab="bg-remover"', 'data-tab="bg-remover" title="Background Remover"')
html = html.replace('data-tab="wm-remover"', 'data-tab="wm-remover" title="Watermark Eraser"')
html = html.replace('data-tab="wm-maker"', 'data-tab="wm-maker" title="Watermark Maker"')

# 4. Link Home button
html = html.replace('<a class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded" href="#">Home</a>',
                    '<a id="backToUploadBtn" style="cursor:pointer;" class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded">Home</a>')
html = html.replace('href="#"', 'href="javascript:void(0)"')

# 5. We need to make sure the dummy elements don't steal the IDs from the real ones.
# In the previous step, I added dummy elements. Let's REMOVE the dummy elements for the ones that ARE present in the UI.
# Or better, just let `app.js` bind to the real elements if they have the ID. But ID must be unique.
# Let's find the dummy-elements block and remove it entirely. Then we will only add dummies for things truly missing.
dummy_start = html.find('<div id="dummy-elements"')
if dummy_start != -1:
    dummy_end = html.find('</div>\n</body>', dummy_start) + 6
    if dummy_end > 6:
        html = html[:dummy_start] + html[dummy_end:]

with open('editor.html', 'w') as f:
    f.write(html)
