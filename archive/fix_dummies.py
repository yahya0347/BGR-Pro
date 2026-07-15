import re

with open('app.js', 'r') as f:
    js_content = f.read()

with open('editor.html', 'r') as f:
    html_content = f.read()

ids = re.findall(r"document\.getElementById\(['\"](.*?)['\"]\)", js_content)
ids = list(set(ids))

missing_ids = []
for id_val in ids:
    if f'id="{id_val}"' not in html_content and f"id='{id_val}'" not in html_content:
        missing_ids.append(id_val)

dummy_html = '<div id="dummy-elements" style="display: none;">\n'
for id_val in missing_ids:
    if id_val == 'subStatusBadge':
        dummy_html += f'  <div id="{id_val}"><span></span><i></i></div>\n'
    elif id_val == 'pdfDropZone':
        dummy_html += f'  <div id="{id_val}"><div class="browse-link"></div></div>\n'
    else:
        dummy_html += f'  <div id="{id_val}"></div>\n'
dummy_html += '  <div class="header-logo"></div>\n'
dummy_html += '</div>\n'

html_content = html_content.replace('</body>', dummy_html + '</body>')

# We also MUST fix `app.js` redirect logic if no image is uploaded.
# Let's add a script right before app.js loads to redirect if no localstorage
redirect_script = """
<script>
  if (!localStorage.getItem('eraserpro_uploaded_image')) {
      // If we directly visit editor without image, it will break. Wait for app.js? No, just alert and go home.
      // Actually app.js doesn't crash, but it won't render anything useful.
  }
</script>
"""
# html_content = html_content.replace('</body>', redirect_script + '</body>')

with open('editor.html', 'w') as f:
    f.write(html_content)
