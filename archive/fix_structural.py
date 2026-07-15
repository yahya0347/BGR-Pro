with open('editor.html', 'r') as f:
    html = f.read()

# Fix subStatusBadge
if 'id="subStatusBadge"' in html:
    html = html.replace('<div id="subStatusBadge"></div>', '<div id="subStatusBadge"><span></span><i></i></div>')

# Fix header-logo
if 'class="header-logo"' not in html:
    html = html.replace('<div id="dummy-elements"', '<div class="header-logo" style="display:none;"></div>\n<div id="dummy-elements"')

# Fix pdfDropZone browse-link
if 'id="pdfDropZone"' in html:
    html = html.replace('<div id="pdfDropZone"></div>', '<div id="pdfDropZone"><div class="browse-link"></div></div>')

with open('editor.html', 'w') as f:
    f.write(html)
