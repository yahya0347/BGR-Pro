# Complete Start-to-End Guide: AI Background & Watermark Studio Pro

Save this file or keep it in your project directory. This guide explains how to open the code, make edits, preview updates locally, connect Google AdSense, host the site for free, link a custom domain, and manage the subscription pricing.

---

## 1. Project Structure (Where the Files Are)
All your code is located in the folder: `/Users/macbookairm1/.gemini/antigravity/scratch/bg-eraser-pro`

- `index.html`: The webpage structure (UI panels, forms, dialog modals, and ad slots).
- `styles.css`: The styling sheet (colors, glassmorphic layout, buttons, sliders, responsive media queries).
- `app.js`: The application brain (handles file uploads, runs local AI background removal, controls canvas watermarks, handles custom resizing, and handles mock checkout logic).
- `inpaint-worker.js`: A background processor that erases watermarks smoothly without freezing the website.
- `GUIDE.md`: This reference file.

---

## 2. How to Open and Edit the Code
To make changes to text, colors, layout, or features:
1. Download a free code editor like **Visual Studio Code (VS Code)**.
2. Open VS Code, select **File > Open Folder**, and choose the `bg-eraser-pro` folder.
3. **To edit text**: Open `index.html`, find the text you want to change, edit it, and save the file.
4. **To edit colors/styles**: Open `styles.css`, adjust the color variables at the top of the file (under `:root`), and save.
5. **To change the pricing ($3.99/mo) or make it 100% free**:
   - Open `index.html`, search for `$3.99` and change it to your new price.
   - Open `app.js`, search for `isPro` or the resolution presets logic if you want to allow high-res downloads for free.

---

## 3. How to Run and Preview Your Site Locally
Browsers block local AI models and Web Workers if you click the HTML file directly. You must use a local web server to preview:

1. Open your Mac **Terminal** app.
2. Navigate to your project folder by running:
   ```bash
   cd /Users/macbookairm1/.gemini/antigravity/scratch/bg-eraser-pro
   ```
3. Start the local server:
   ```bash
   python3 -m http.server 8000
   ```
4. Open your browser and go to: **[http://localhost:8000](http://localhost:8000)**.
5. Keep the terminal window open while editing. Simply refresh your browser tab to see updates instantly!

---

## 4. How to Connect Google AdSense (Monetization)
I have placed **3 premium AdSense placeholders** in optimized layout slots. To start earning money:
1. Get your AdSense unit code blocks from your Google AdSense Dashboard.
2. Open `index.html` and search for the comment `<!-- ADSENSE BANNER` (Slots 1, 2, and 3).
3. Delete the mock placeholder box inside:
   ```html
   <div class="ad-mock">
     <i class="fa-solid fa-rectangle-ad"></i>
     <span>Google AdSense Banner</span>
   </div>
   ```
4. Paste your actual Google AdSense `<ins>` tag and script block in its place. Save the file.
5. Ensure your domain is approved in your Google AdSense console.

---

## 5. How to Deploy the Site Online (For Free)
You can deploy static websites (HTML/CSS/JS) to the cloud for free using platforms like **Netlify** or **Vercel**.

### Method A: Netlify Drop (Easiest, No Code)
1. Open your browser and go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Open your Finder window showing the folder `/Users/macbookairm1/.gemini/antigravity/scratch`.
3. **Drag the entire `bg-eraser-pro` folder** and drop it onto the Netlify webpage box.
4. It will immediately publish your website and give you a free, shareable link (e.g. `https://cool-app-12345.netlify.app`). 
5. Create a free Netlify account to claim the site, customize the URL, and link your domain.

### Method B: Vercel CLI (Professional)
1. Install the Vercel tool globally in Terminal:
   ```bash
   npm install -g vercel
   ```
2. Navigate to your project folder:
   ```bash
   cd /Users/macbookairm1/.gemini/antigravity/scratch/bg-eraser-pro
   ```
3. Run the deployment command:
   ```bash
   vercel
   ```
4. Log in and accept all default prompt options. Vercel will upload and give you a public URL.

---

## 6. How to Connect Your Domain Name
After purchasing a domain (e.g. `www.mybgeraser.com`) from GoDaddy or Namecheap:

### If using Netlify:
1. Log into your Netlify dashboard and click on your site.
2. Go to **Site Configuration > Domain management > Add domain**.
3. Type in your domain name and click **Verify**.
4. Netlify will show you custom **Name Servers** (like `dns1.p01.nsone.net`, `dns2.p01...`).
5. Log into Namecheap/GoDaddy, edit your domain settings, choose **Custom DNS**, paste Netlify's name servers, and save.

### If using Vercel:
1. Log into Vercel, select your project, go to **Settings > Domains**, type in your domain, and click **Add**.
2. Vercel will ask you to add DNS records at your domain registrar.
3. Log into GoDaddy/Namecheap, go to your domain's DNS Records settings, and add:
   - **A Record**: Host `@`, Value `76.76.21.21`
   - **CNAME Record**: Host `www`, Value `cname.vercel-dns.com`

---

## 7. Enable CORS Headers (CRITICAL FOR AI TOOL)
For security, modern browsers block fast WebAssembly processing unless specific headers are served by your web host.

- **If hosting on Netlify**: Create a file named **`_headers`** (no file extension) in the `bg-eraser-pro` folder and write:
  ```text
  /*
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
  ```
- **If hosting on Vercel**: Create a file named **`vercel.json`** in the `bg-eraser-pro` folder and write:
  ```json
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
        ]
      }
    ]
  }
  ```
Once published with these configuration files, your browser runs the AI background remover models with high speed and hardware acceleration.
