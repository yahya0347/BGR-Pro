import re

with open('editor.html', 'r') as f:
    html = f.read()

# Remove the Image, Video, Enterprise links
to_remove = """<a class="font-label-md text-label-md text-primary border-b-2 border-primary pb-1 transition-colors duration-200 ease-in-out px-2" href="#">Image</a>
<a class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded" href="#">Video</a>
<a class="font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 ease-in-out px-2 py-1 rounded" href="#">Enterprise</a>"""

html = html.replace(to_remove, '')

# Remove monetization and support buttons
buttons_to_remove = """<button class="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 ease-in-out">
<span class="material-symbols-outlined">monetization_on</span>
</button>
<button class="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors duration-200 ease-in-out">
<span class="material-symbols-outlined">support_agent</span>
</button>"""

html = html.replace(buttons_to_remove, '')

# Fix Upgrade button to have ID
html = html.replace('<button class="px-4 py-2 font-label-md text-label-md bg-[#f59e0b] text-white rounded-[16px] hover:opacity-90 transition-opacity">\n                Upgrade\n            </button>',
                   '<button id="headerUpgradeBtn" class="px-4 py-2 font-label-md text-label-md bg-[#f59e0b] text-white rounded-[16px] hover:opacity-90 transition-opacity">Go Pro</button>')

# Add manage btn next to Upgrade
html = html.replace('Go Pro</button>', 'Go Pro</button>\n<button id="headerManageBtn" class="px-4 py-2 font-label-md text-label-md bg-surface-container-low text-on-surface rounded-[16px] hover:bg-surface-container-high transition-colors hidden">Manage</button>')

# Wrap avatar in btnHeaderAuth
avatar_div = """<div class="w-8 h-8 rounded-full overflow-hidden ml-2 border border-outline-variant">
<img alt="User profile" class="w-full h-full object-cover" data-alt="A small circular user profile picture showing a professional headshot of a person against a neutral background." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUPW-EYoALq29ZWXJI5gcgmkBKfDsqgn3mmHaA0Tg2k8fpfGXrDFz4WNVOkOz4JiIy6cWPOry-vWrCeykrqQO0i9u94Nal0Sr70Bs8q-UjHwMqXIOAQ30P2DvMimvaT8Y_u-MOlEEzd85U8UXA7jtd26GwhYg6upfVs-llRB5he9_yRVkN6pvd7q43JBDh2Q29HvOXDdb-T3h01dZFWEKnSSl4BqabCU1uRpALybHzUFvb_s6Mdnz2wy63282yXIeFhB1lFDk8e7E"/>
</div>"""

auth_btn = f"""<button id="btnHeaderAuth" class="rounded-full flex items-center justify-center hover:opacity-80 transition-opacity">
{avatar_div}
</button>"""

html = html.replace(avatar_div, auth_btn)

# Remove any old dummy elements for headerUpgradeBtn, headerManageBtn, btnHeaderAuth
html = re.sub(r'<div id="headerUpgradeBtn"></div>\n?', '', html)
html = re.sub(r'<div id="headerManageBtn"></div>\n?', '', html)
html = re.sub(r'<div id="btnHeaderAuth"></div>\n?', '', html)


with open('editor.html', 'w') as f:
    f.write(html)

