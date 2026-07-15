import re

with open('app.js', 'r') as f:
    js_content = f.read()

with open('editor.html', 'r') as f:
    html_content = f.read()

# Extract all IDs that app.js tries to get
ids = re.findall(r"document\.getElementById\(['\"](.*?)['\"]\)", js_content)
ids = list(set(ids))

missing_ids = []
for id_val in ids:
    if f'id="{id_val}"' not in html_content and f"id='{id_val}'" not in html_content:
        missing_ids.append(id_val)

dummy_html = '<div id="dummy-elements" style="display: none;">\n'
for id_val in missing_ids:
    dummy_html += f'  <div id="{id_val}"></div>\n'
dummy_html += '</div>\n'

html_content = html_content.replace('</body>', dummy_html + '</body>')

with open('editor.html', 'w') as f:
    f.write(html_content)

print(f"Added {len(missing_ids)} dummy elements.")
