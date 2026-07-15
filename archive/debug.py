from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    def handle_console(msg):
        print(f"CONSOLE [{msg.type}]: {msg.text}")
        
    def handle_page_error(err):
        print(f"PAGE ERROR: {err}")
        
    page.on("console", handle_console)
    page.on("pageerror", handle_page_error)
    
    # We will load file:// instead of http server
    page.goto(f"file:///Users/macbookairm1/Desktop/PROJETS%20/bg-eraser-pro/editor.html", wait_until="domcontentloaded")
    
    # wait a bit for JS to execute
    page.wait_for_timeout(2000)
    
    browser.close()
