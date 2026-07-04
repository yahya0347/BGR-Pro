import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Config Placeholder (User can override or set window.firebaseConfig)
const firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyByiFnvrKM2W8mfd6GJmjyAuSGqF0MPEsQ",
  authDomain: "bg-eraser-pro-64137.firebaseapp.com",
  projectId: "bg-eraser-pro-64137",
  storageBucket: "bg-eraser-pro-64137.firebasestorage.app",
  messagingSenderId: "881998487714",
  appId: "1:881998487714:web:a1b39d4784ef2c8ff8b7fb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// OpenCV.js readiness check
window.cvReady = false;

function initializeOpenCvReadiness() {
  if (typeof cv !== 'undefined') {
    // If runtime initialized hook exists, hook into it
    if (cv.onRuntimeInitialized !== undefined) {
      cv.onRuntimeInitialized = function() {
        window.cvReady = true;
        console.log("OpenCV.js WebAssembly runtime initialized.");
      };
      // Check if already initialized
      if (cv.getBuildInformation) {
        window.cvReady = true;
      }
    } else {
      window.cvReady = true;
      console.log("OpenCV.js initialized synchronously.");
    }
  }
}

window.onOpenCvReady = function() {
  console.log("OpenCV.js script load event fired.");
  initializeOpenCvReadiness();
  // Poll as a safety net in case WASM runtime initialization is delayed
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    initializeOpenCvReadiness();
    if (window.cvReady || attempts > 50) {
      clearInterval(interval);
      if (window.cvReady) {
        console.log("OpenCV.js fully ready.");
      } else {
        console.warn("OpenCV.js failed to initialize in time.");
      }
    }
  }, 100);
};

// Check immediately in case the script was already loaded
initializeOpenCvReadiness();

// Global Application State
const state = {
  isPro: false,
  originalImage: null,      // Base Image object
  originalFilename: 'image',
  transparentImage: null,   // HTMLImageElement or Canvas of the cutout
  processedImage: null,     // Current canvas image including BG fills/watermarks
  
  // BG Remover settings
  bgType: 'transparent',    // 'transparent', 'color', 'image'
  bgColor: '#4f46e5',
  bgGradient: '',
  bgCustomImage: null,      // Image object for custom backdrop
  
  // Watermark Eraser state
  eraserBaseImage: null,    // Image object of current erased image version
  brushStrokes: [],
  appliedStrokes: [],       // Non-destructive applied watermark eraser strokes
  redoStrokes: [],
  isDrawing: false,
  brushSize: 25,
  inpaintWorker: null,
  wmMode: 'brush',          // 'brush' or 'compare'
  wmSliderPercent: 50,      // Slider percentage (0-100)
  
  // Watermark Maker settings
  wmSource: 'text',         // 'text', 'image'
  wmText: 'DRAFT COPY',
  wmFont: 'Inter',
  wmTextColor: '#ffffff',
  wmLogoImage: null,        // Image object for watermark logo
  wmLayout: 'grid',         // 'grid', 'single'
  wmPosition: 'bottom-right',// 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
  wmScale: 30,              // 10 to 200
  wmOpacity: 0.3,           // 0.1 to 1.0
  wmRotation: -30,          // -90 to 90
  
  // Resizer settings
  exportPreset: 'medium',   // 'medium', 'full', 'square', 'banner', 'story', 'custom'
  aspectRatioLocked: true,
  originalAspectRatio: 1,
  exportWidth: 800,
  exportHeight: 600,
  
  // Editor mode tab
  activeTab: 'bg-remover',    // 'bg-remover', 'wm-remover', 'wm-maker'
  bgRemoved: false,

  // Canvas zoom/pan (shared toolbar controls transform whichever tab is active)
  zoom: 1,
  panX: 0,
  panY: 0,
  panMode: false,
  history: [],
  currentHistoryId: null,
  
  // PDF state variables
  pdfDocument: null,
  pdfTotalPages: 1,
  pdfCurrentPage: 1,
  pdfFilename: '',
  
  // PDF Tools Hub state
  pdfFiles: [],
  activePdfTool: null,
  pdfPagesList: [],
  pdfSplitMode: 'range',
  pdfCompressLevel: 'recommended',
  
  // Auth / Credit state variables
  user: null,
  credits: 0,
  unsubscribeCredits: null
};

// Undo/Redo stack for Watermark Eraser
const wmHistory = {
  undoStack: [],
  redoStack: [],
  maxStates: 20,
  
  push(maskCanvas) {
    const ctx = maskCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    this.undoStack.push(imgData);
    if (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    this.updateButtons();
  },
  
  undo() {
    if (this.undoStack.length <= 1) return; // Keep at least the initial state (empty black mask)
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);
    
    const previousState = this.undoStack[this.undoStack.length - 1];
    const maskCanvas = elements.wmRemoverMaskCanvas;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      ctx.putImageData(previousState, 0, 0);
    }
    
    runWatermarkInpaint(true); // run inpaint with the restored mask
    this.updateButtons();
  },
  
  redo() {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    
    const maskCanvas = elements.wmRemoverMaskCanvas;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext('2d');
      ctx.putImageData(nextState, 0, 0);
    }
    
    runWatermarkInpaint(true);
    this.updateButtons();
  },
  
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateButtons();
  },
  
  updateButtons() {
    const undoBtn = document.getElementById('undoBrush');
    if (undoBtn) {
      const hasStrokes = state.brushStrokes && state.brushStrokes.length > 0;
      const hasHistory = this.undoStack.length > 1;
      undoBtn.disabled = !hasStrokes && !hasHistory;
    }
  }
};

// UI Elements mapping
const elements = {
  // Navigation
  subStatusBadge: document.getElementById('subStatusBadge'),
  headerUpgradeBtn: document.getElementById('headerUpgradeBtn'),
  headerManageBtn: document.getElementById('headerManageBtn'),
  
  // Upload panel
  uploadLanding: document.getElementById('uploadLanding'),
  editorWorkspace: document.getElementById('editorWorkspace'),
  myProjectsView: document.getElementById('myProjectsView'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  sampleItems: document.querySelectorAll('.sample-item'),
  
  // Tab panels
  tabBtns: document.querySelectorAll('.tab-btn'),
  workspaceViews: document.querySelectorAll('.workspace-view'),
  configSections: document.querySelectorAll('.sidebar-config-section'),
  
  // Loading Overlay
  processingOverlay: document.getElementById('processingOverlay'),
  processingStatus: document.getElementById('processingStatus'),
  processingProgress: document.getElementById('processingProgress'),
  progressBar: document.getElementById('progressBar'),

  // AI Processing Overlay (canvas-level "AI is thinking" animation)
  aiProcessingOverlay: document.getElementById('aiProcessingOverlay'),
  aiProcessingText: document.getElementById('aiProcessingText'),

  // BG Remover UI
  imgBefore: document.getElementById('imgBefore'),
  bgRemoverCanvas: document.getElementById('bgRemoverCanvas'),
  bgRemoverResultContainer: document.getElementById('bgRemoverResultContainer'),
  comparisonSlider: document.getElementById('comparisonSlider'),
  bgTypeBtns: document.querySelectorAll('[data-bg-type]'),
  bgColorConfig: document.getElementById('bg-color-config'),
  bgImageConfig: document.getElementById('bg-image-config'),
  bgColorPicker: document.getElementById('bgColorPicker'),
  colorPresets: document.querySelectorAll('.color-preset'),
  bgImageInput: document.getElementById('bgImageInput'),
  btnUploadBackdrop: document.getElementById('btnUploadBackdrop'),
  backdropPresets: document.querySelectorAll('.backdrop-preset'),
  
  // Watermark Eraser UI
  wmRemoverBaseCanvas: document.getElementById('wmRemoverBaseCanvas'),
  wmRemoverBrushCanvas: document.getElementById('wmRemoverBrushCanvas'),
  brushSizeSlider: document.getElementById('brushSize'),
  brushSizeVal: document.getElementById('brushSizeVal'),
  undoBrushBtn: document.getElementById('undoBrush'),
  clearBrushBtn: document.getElementById('clearBrush'),
  btnEraseWatermark: document.getElementById('btnEraseWatermark'),
  wmRemoverCompareImg: document.getElementById('wmRemoverCompareImg'),
  wmComparisonSlider: document.getElementById('wmComparisonSlider'),
  wmModeSwitcher: document.getElementById('wmModeSwitcher'),
  toggleDetectText: document.getElementById('toggleDetectText'),
  toggleDetectLogo: document.getElementById('toggleDetectLogo'),
  btnAIDetectRemove: document.getElementById('btnAIDetectRemove'),
  
  // Watermark Maker UI
  wmMakerCanvas: document.getElementById('wmMakerCanvas'),
  wmSourceBtns: document.querySelectorAll('[data-wm-source]'),
  wmTextConfig: document.getElementById('wm-text-config'),
  wmImageConfig: document.getElementById('wm-image-config'),
  wmText: document.getElementById('wmText'),
  wmFont: document.getElementById('wmFont'),
  wmTextColor: document.getElementById('wmTextColor'),
  wmTextColorHex: document.getElementById('wmTextColorHex'),
  wmLogoInput: document.getElementById('wmLogoInput'),
  btnUploadWMLogo: document.getElementById('btnUploadWMLogo'),
  wmLogoPreviewContainer: document.getElementById('wmLogoPreviewContainer'),
  wmLogoPreview: document.getElementById('wmLogoPreview'),
  btnClearWMLogo: document.getElementById('btnClearWMLogo'),
  wmLayoutBtns: document.querySelectorAll('[data-wm-layout]'),
  wmSinglePositionGroup: document.getElementById('wm-single-position-group'),
  wmPosition: document.getElementById('wmPosition'),
  wmSizeSlider: document.getElementById('wmSize'),
  wmSizeVal: document.getElementById('wmSizeVal'),
  wmOpacitySlider: document.getElementById('wmOpacity'),
  wmOpacityVal: document.getElementById('wmOpacityVal'),
  wmRotationSlider: document.getElementById('wmRotation'),
  wmRotationVal: document.getElementById('wmRotationVal'),
  
  // Export Settings
  resolutionPreset: document.getElementById('resolutionPreset'),
  customResolutionPanel: document.getElementById('customResolutionPanel'),
  customWidth: document.getElementById('customWidth'),
  customHeight: document.getElementById('customHeight'),
  aspectRatioLock: document.getElementById('aspectRatioLock'),
  btnDownloadImage: document.getElementById('btnDownloadImage'),
  sidebarProBanner: document.getElementById('sidebarProBanner'),
  backToUploadBtn: document.getElementById('backToUploadBtn'),
  backToCanvasBtn: document.getElementById('backToCanvasBtn'),
  exportFormat: document.getElementById('exportFormat'),
  exportColorSpace: document.getElementById('exportColorSpace'),
  
  // PDF Page Modal
  pdfPageModal: document.getElementById('pdfPageModal'),
  closePdfModalBtn: document.getElementById('closePdfModalBtn'),
  pdfTotalPages: document.getElementById('pdfTotalPages'),
  btnPrevPdfPage: document.getElementById('btnPrevPdfPage'),
  pdfCurrentPageDisplay: document.getElementById('pdfCurrentPageDisplay'),
  btnNextPdfPage: document.getElementById('btnNextPdfPage'),
  btnConfirmPdfPage: document.getElementById('btnConfirmPdfPage'),
  
  // Subscription Modal
  checkoutModal: document.getElementById('checkoutModal'),
  closeCheckoutBtn: document.getElementById('closeCheckoutBtn'),
  checkoutForm: document.getElementById('checkoutForm'),
  btnSubmitCheckout: document.getElementById('btnSubmitCheckout'),
  checkoutSuccessScreen: document.getElementById('checkoutSuccessScreen'),
  btnDismissSuccess: document.getElementById('btnDismissSuccess'),
  cardNumberInput: null,
  cardExpiryInput: null,

  // PDF Tools Hub
  navModeStudio: document.getElementById('navModeStudio'),
  navModePdf: document.getElementById('navModePdf'),
  pdfToolsLanding: document.getElementById('pdfToolsLanding'),
  pdfEditorWorkspace: document.getElementById('pdfEditorWorkspace'),
  pdfToolCards: document.querySelectorAll('.pdf-tool-card'),
  pdfHubFileInput: document.getElementById('pdfHubFileInput'),
  pdfDropZone: document.getElementById('pdfDropZone'),
  pdfPagesPreviewGrid: document.getElementById('pdfPagesPreviewGrid'),
  pdfPagesViewport: document.getElementById('pdfPagesViewport'),
  btnBackToPdfHub: document.getElementById('btnBackToPdfHub'),
  btnAddPdfFile: document.getElementById('btnAddPdfFile'),
  btnExecutePdfTool: document.getElementById('btnExecutePdfTool'),
  btnRotateAllCw: document.getElementById('btnRotateAllCw'),
  pdfConfigSections: document.querySelectorAll('#pdfEditorWorkspace .sidebar-config-section'),
  pdfSplitModeGroup: document.getElementById('pdfSplitModeGroup'),
  pdfSplitRangePanel: document.getElementById('pdfSplitRangePanel'),
  pdfSplitStartPage: document.getElementById('pdfSplitStartPage'),
  pdfSplitEndPage: document.getElementById('pdfSplitEndPage'),
  pdfWatermarkText: document.getElementById('pdfWatermarkText'),
  pdfWatermarkSize: document.getElementById('pdfWatermarkSize'),
  pdfWatermarkOpacity: document.getElementById('pdfWatermarkOpacity'),
  pdfCompressModeGroup: document.getElementById('pdfCompressModeGroup'),
  pdfToImgFormat: document.getElementById('pdfToImgFormat'),
  pdfToImgResolution: document.getElementById('pdfToImgResolution'),
  pdfToImgColorSpace: document.getElementById('pdfToImgColorSpace'),
  
  // Auth Modal elements
  authModal: document.getElementById('authModal'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  btnHeaderAuth: document.getElementById('btnHeaderAuth'),
  creditsBadge: document.getElementById('creditsBadge'),
  creditsCount: document.getElementById('creditsCount')
};

/* ==========================================================================
   Initialization and Global Events
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Check if we came from index.html with an uploaded image
  const storedImage = localStorage.getItem('eraserpro_uploaded_image');
  const storedFilename = localStorage.getItem('eraserpro_uploaded_filename');
  if (storedImage) {
    const img = new Image();
    img.onload = () => {
      state.originalFilename = (storedFilename || 'image').replace(/\.[^/.]+$/, "");
      state.originalFileType = 'image/png'; // generic fallback
      processUploadedImage(img);
      localStorage.removeItem('eraserpro_uploaded_image');
      localStorage.removeItem('eraserpro_uploaded_filename');
    };
    img.src = storedImage;
  }

  // Configure Global PDF.js Worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  
  initSubscription();
  initUploadHandlers();
  initTabHandlers();
  initBGRemoverHandlers();
  initWMEraserHandlers();
  initWMMakerHandlers();
  initResizerHandlers();
  initCheckoutHandlers();
  initPdfModalHandlers();
  initPdfHubHandlers();
  
  // Window resize handler to maintain editor responsiveness
  window.addEventListener('resize', () => {
    if (state.originalImage) {
      if (state.activeTab === 'bg-remover') {
        renderBGRemoverCanvas();
        fitBGRemoverCanvasToView();
      } else if (state.activeTab === 'wm-remover') {
        initWatermarkEraserBase();
      } else if (state.activeTab === 'wm-maker') {
        renderWMMakerCanvas();
        fitWMMakerCanvasToView();
      }
    }
    // Re-sync the AI processing overlay's bounding box in case its own
    // render path above didn't already trigger applyZoomPan().
    if (elements.aiProcessingOverlay && elements.aiProcessingOverlay.classList.contains('visible')) {
      positionAIProcessingOverlay();
    }
  });
});

// Setup subscription / credit state and Auth State Changed listener
function initSubscription() {
  // ── 1) Setup Auth State Change Listener ────────────────────────────
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    if (user) {
      // Initialize the user and ensure they have 3 free credits
      try {
        const token = await user.getIdToken();
        fetch('/api/init-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          }
        }).then(res => res.json())
          .then(data => {
            console.log("User doc checked/initialized:", data);
          })
          .catch(err => console.error("Error calling init-user:", err));
      } catch (e) {
        console.error("Failed to get ID token for user initialization:", e);
      }
      
      // Listen to real-time credit updates from Firestore
      if (state.unsubscribeCredits) {
        state.unsubscribeCredits();
        state.unsubscribeCredits = null;
      }
      state.unsubscribeCredits = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          state.credits = docSnap.data().credits || 0;
        } else {
          state.credits = 0;
        }
        updateCreditsUI();
      }, (error) => {
        console.error("Firestore credits listener error:", error);
      });
      
    } else {
      // Guest mode
      if (state.unsubscribeCredits) {
        state.unsubscribeCredits();
        state.unsubscribeCredits = null;
      }
      state.credits = 0;
      updateCreditsUI();
    }
  });

  // ── 2) Setup Auth Modal Events ─────────────────────────────────────
  const authModal = elements.authModal;
  if (authModal) {
    // Open auth modal
    if (elements.btnHeaderAuth) {
      elements.btnHeaderAuth.addEventListener('click', () => {
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('registerError').classList.add('hidden');
        document.getElementById('authVerificationBanner').classList.add('hidden');
        authModal.showModal();
      });
    }
    
    // Close auth modal
    const closeBtn = document.getElementById('closeAuthModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => authModal.close());
    }
    
    // Auth Tab Switcher
    const authTabBtns = document.querySelectorAll('.auth-tab-btn');
    authTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        authTabBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = 'white';
        
        const tab = btn.getAttribute('data-auth-tab');
        if (tab === 'login') {
          document.getElementById('loginForm').classList.remove('hidden');
          document.getElementById('registerForm').classList.add('hidden');
        } else {
          document.getElementById('loginForm').classList.add('hidden');
          document.getElementById('registerForm').classList.remove('hidden');
        }
      });
    });
    
    // Handle Login Form Submit
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const pass = document.getElementById('loginPassword').value;
      const errEl = document.getElementById('loginError');
      errEl.classList.add('hidden');
      
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        authModal.close();
        showToastNotification('Successfully signed in!');
      } catch (err) {
        console.error(err);
        errEl.innerText = err.message.replace("Firebase: ", "");
        errEl.classList.remove('hidden');
      }
    });
    
    // Handle Register Form Submit
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('registerEmail').value;
      const pass = document.getElementById('registerPassword').value;
      const confirmPass = document.getElementById('registerConfirmPassword').value;
      const errEl = document.getElementById('registerError');
      errEl.classList.add('hidden');
      
      if (pass !== confirmPass) {
        errEl.innerText = "Passwords do not match.";
        errEl.classList.remove('hidden');
        return;
      }
      
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        // Send email verification
        await sendEmailVerification(cred.user);
        document.getElementById('authVerificationBanner').classList.remove('hidden');
        showToastNotification('Account created! Please check your email to verify your account.');
      } catch (err) {
        console.error(err);
        errEl.innerText = err.message.replace("Firebase: ", "");
        errEl.classList.remove('hidden');
      }
    });
    
    // Handle Google Sign In
    document.getElementById('btnGoogleSignIn').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
        authModal.close();
        showToastNotification('Signed in with Google!');
      } catch (err) {
        console.error(err);
        alert('Google Sign-In failed: ' + err.message);
      }
    });
  }

  // ── 3) Setup Credits purchase and controls ─────────────────────────
  const checkoutModal = elements.checkoutModal;
  if (checkoutModal) {
    // Open/Close
    if (elements.headerUpgradeBtn) {
      elements.headerUpgradeBtn.addEventListener('click', () => {
        checkoutModal.showModal();
      });
    }
    if (elements.closeCheckoutBtn) {
      elements.closeCheckoutBtn.addEventListener('click', () => checkoutModal.close());
    }
    if (elements.btnDismissSuccess) {
      elements.btnDismissSuccess.addEventListener('click', () => {
        elements.checkoutSuccessScreen.classList.add('hidden');
        elements.checkoutForm.classList.remove('hidden');
        checkoutModal.close();
      });
    }
    
    // Buy 150 Credits Pack
    document.getElementById('btnBuyPack150').addEventListener('click', async () => {
      await redirectToStripeCheckout('pack150');
    });
    
    // Pay-As-You-Go Picker and purchase
    const inputQty = document.getElementById('inputQuantityPAYG');
    const totalPriceEl = document.getElementById('paygTotalPrice');
    const paygSubtextEl = document.getElementById('paygSubtext');

    const updatePAYGPrice = () => {
      const qty = parseInt(inputQty.value) || 0;
      const price = (qty * 0.50).toFixed(2);
      totalPriceEl.innerText = `$${price}`;
      if (paygSubtextEl) {
        paygSubtextEl.innerText = `${qty} credit${qty === 1 ? '' : 's'} for $${price} ($0.50/credit)`;
      }
    };
    
    document.getElementById('btnDecPAYG').addEventListener('click', () => {
      let val = parseInt(inputQty.value) || 10;
      if (val > 1) {
        inputQty.value = val - 1;
        updatePAYGPrice();
      }
    });
    
    document.getElementById('btnIncPAYG').addEventListener('click', () => {
      let val = parseInt(inputQty.value) || 10;
      inputQty.value = val + 1;
      updatePAYGPrice();
    });
    
    inputQty.addEventListener('input', updatePAYGPrice);
    
    document.getElementById('btnBuyPAYG').addEventListener('click', async () => {
      const qty = parseInt(inputQty.value) || 10;
      await redirectToStripeCheckout('payg', qty);
    });
  }

  // Handle logout
  if (elements.headerManageBtn) {
    elements.headerManageBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out?')) {
        try {
          await signOut(auth);
          showToastNotification('Logged out successfully.');
        } catch (err) {
          console.error(err);
        }
      }
    });
  }
  
  // Check success query param (Stripe redirect back)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('checkout_success') === 'true') {
    elements.checkoutForm.classList.add('hidden');
    elements.checkoutSuccessScreen.classList.remove('hidden');
    elements.checkoutModal.showModal();
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function updateCreditsUI() {
  const subBadge = elements.subStatusBadge;
  const creditsBadge = document.getElementById('creditsBadge');
  const creditsCount = document.getElementById('creditsCount');
  const authBtn = document.getElementById('btnHeaderAuth');
  const buyBtn = elements.headerUpgradeBtn;
  const logoutBtn = elements.headerManageBtn;
  
  if (state.user) {
    if (subBadge) subBadge.classList.add('hidden');
    if (creditsBadge) creditsBadge.classList.remove('hidden');
    if (creditsCount) creditsCount.innerText = `${state.credits} Credits`;
    if (authBtn) authBtn.classList.add('hidden');
    if (buyBtn) buyBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    
    state.isPro = state.credits > 0;
  } else {
    if (subBadge) subBadge.classList.remove('hidden');
    if (creditsBadge) creditsBadge.classList.add('hidden');
    if (authBtn) authBtn.classList.remove('hidden');
    if (buyBtn) buyBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    
    state.isPro = false;
  }
  
  updateSubUI();
}

async function redirectToStripeCheckout(type, quantity = 0) {
  if (!state.user) {
    showToastNotification('Please sign in to purchase credits.');
    elements.authModal.showModal();
    return;
  }
  
  showGlobalLoader('Preparing Checkout...', 'Redirecting to secure Stripe checkout...');
  try {
    const token = await state.user.getIdToken();
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, quantity })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create checkout session.');
    
    window.location.href = data.url;
  } catch (err) {
    hideGlobalLoader();
    alert('Stripe redirect failed: ' + err.message);
  }
}

function updateSubUI() {
  if (state.isPro) {
    // Nav Status Update
    elements.subStatusBadge.className = 'sub-badge pro-badge-active';
    elements.subStatusBadge.querySelector('span').innerText = 'PRO Active';
    elements.subStatusBadge.querySelector('i').className = 'fa-solid fa-crown';
    
    // Header Buttons toggle
    elements.headerUpgradeBtn.classList.add('hidden');
    elements.headerManageBtn.classList.remove('hidden');
    
    // Sidebar banner hide
    elements.sidebarProBanner.classList.add('hidden');
  } else {
    // Nav Status Update
    elements.subStatusBadge.className = 'sub-badge free-badge';
    elements.subStatusBadge.querySelector('span').innerText = 'Free Tier';
    elements.subStatusBadge.querySelector('i').className = 'fa-solid fa-circle-dot';
    
    // Header Buttons toggle
    elements.headerUpgradeBtn.classList.remove('hidden');
    elements.headerManageBtn.classList.add('hidden');
    
    // Sidebar banner show
    elements.sidebarProBanner.classList.remove('hidden');
    
    // Enforce Free resolution restrictions on select
    if (elements.resolutionPreset.value !== 'medium') {
      elements.resolutionPreset.value = 'medium';
      elements.customResolutionPanel.classList.add('hidden');
    }
  }

  // Hide/Show ads depending on Pro subscription status
  const adSlots = document.querySelectorAll('.adsense-slot');
  adSlots.forEach(slot => {
    if (state.isPro) {
      slot.classList.add('hidden');
    } else {
      slot.classList.remove('hidden');
    }
  });
}

/* ==========================================================================
   Image Upload and Landing Core
   ========================================================================== */
function initUploadHandlers() {
  // Landing Tabs click handlers
  const landingTabBtns = document.querySelectorAll('.landing-tab-btn');
  const uploadTitle = document.getElementById('uploadTitle');
  const uploadDesc = document.getElementById('uploadDesc');
  const heroGraphic = document.getElementById('landingHeroGraphic');
  const heroGraphicImg = document.getElementById('heroGraphicImg');
  const heroGraphicBadge = document.getElementById('heroGraphicBadge');
  const btnUploadCTA = document.getElementById('btnUploadCTA');
  
  landingTabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent triggering upload click if inside upload-card
      // These are real <a href="..."> links (crawlable to their own dedicated
      // SEO pages) that also drive the in-page tab switch on a left-click;
      // suppress the navigation so clicking one here stays on this page.
      e.preventDefault();
      const tab = btn.getAttribute('data-landing-tab');
      state.activeTab = tab;
      
      // Update active class on landing tabs
      landingTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update titles, descriptions and hero graphics dynamically
      if (tab === 'bg-remover') {
        uploadTitle.innerText = 'Remove Image Background';
        uploadDesc.innerText = '100% Automatically and Free';
        if (heroGraphic) heroGraphic.className = 'landing-hero-graphic bg-mode';
        if (heroGraphicImg) heroGraphicImg.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80';
        if (heroGraphicBadge) heroGraphicBadge.innerText = 'BG REMOVED';
        if (btnUploadCTA) btnUploadCTA.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload Image';
      } else if (tab === 'wm-remover') {
        uploadTitle.innerText = 'Erase Image Watermark';
        uploadDesc.innerText = 'Clean watermarks and texts in seconds';
        if (heroGraphic) heroGraphic.className = 'landing-hero-graphic wm-remover-mode';
        if (heroGraphicImg) heroGraphicImg.src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=150&h=150&q=80';
        if (heroGraphicBadge) heroGraphicBadge.innerText = 'ERASED';
        if (btnUploadCTA) btnUploadCTA.innerHTML = '<i class="fa-solid fa-eraser"></i> Upload Image';
      } else if (tab === 'wm-maker') {
        uploadTitle.innerText = 'Add Image Watermark';
        uploadDesc.innerText = 'Protect photos with custom logo or text';
        if (heroGraphic) heroGraphic.className = 'landing-hero-graphic wm-maker-mode';
        if (heroGraphicImg) heroGraphicImg.src = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=150&h=150&q=80';
        if (heroGraphicBadge) heroGraphicBadge.innerText = 'PROTECTED';
        if (btnUploadCTA) btnUploadCTA.innerHTML = '<i class="fa-solid fa-stamp"></i> Upload Image';
      }
    });
  });

  // Click upload area
  elements.dropZone.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  // File input change
  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageFile(file);
      elements.fileInput.value = ''; // Reset value to allow uploading same file consecutively
    }
  });
  
  // Drag over effects
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });
  
  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });
  
  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      handleImageFile(file);
    }
  });
  
  // Sample Images click
  elements.sampleItems.forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      showGlobalLoader('Downloading sample image...', 'Downloading assets...');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        state.originalFilename = 'sample';
        processUploadedImage(img);
        hideGlobalLoader();
      };
      img.onerror = () => {
        hideGlobalLoader();
        alert('Failed to load sample image. Please try uploading your own image.');
      };
      img.src = url;
    });
  });
  
  // Back to upload button (Home button) resets to upload landing
  elements.backToUploadBtn.addEventListener('click', () => {
    state.originalImage = null;
    state.transparentImage = null;
    state.eraserBaseImage = null;
    state.brushStrokes = [];
    state.redoStrokes = [];
    state.bgRemoved = false;
    wmHistory.clear();
    
    if (elements.editorWorkspace) elements.editorWorkspace.classList.remove('active');
    if (elements.myProjectsView) elements.myProjectsView.classList.remove('active');
    if (elements.uploadLanding) elements.uploadLanding.classList.add('active');
  });

  // Floating "← filename" pill top-left of the canvas also navigates back to upload/home
  if (elements.backToCanvasBtn) {
    elements.backToCanvasBtn.addEventListener('click', () => {
      state.originalImage = null;
      state.transparentImage = null;
      state.eraserBaseImage = null;
      state.brushStrokes = [];
      state.redoStrokes = [];
      state.bgRemoved = false;
      wmHistory.clear();

      if (elements.editorWorkspace) elements.editorWorkspace.classList.remove('active');
      if (elements.myProjectsView) elements.myProjectsView.classList.remove('active');
      if (elements.uploadLanding) elements.uploadLanding.classList.add('active');
    });
  }

  // Logo click listener (acts as "home" button to reset workspace and return to landing page)
  const logo = document.getElementById('navLogoHome');
  if (logo) {
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      // Reset workspace state
      state.originalImage = null;
      state.transparentImage = null;
      state.eraserBaseImage = null;
      state.brushStrokes = [];
      state.redoStrokes = [];
      state.bgRemoved = false;
      state.currentHistoryId = null;
      wmHistory.clear();
      
      // Update history UI (will hide the bar)
      updateHistoryUI();
      
      // Switch panels
      elements.uploadLanding.classList.add('active');
      elements.editorWorkspace.classList.remove('active');
      if (elements.myProjectsView) elements.myProjectsView.classList.remove('active');
    });
  }

  initMyProjectsView();
  initHistoryStripActions();
}

// "+" and download buttons docked at the top/bottom of the shared right-side
// history strip (see updateHistoryUI/loadHistoryItem for the thumbnail list
// itself). One instance, reused by all 3 editor tools.
function initHistoryStripActions() {
  const addBtn = document.getElementById('historyAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      elements.fileInput.click();
    });
  }

  const downloadBtn = document.getElementById('historyDownloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      triggerImageDownload();
    });
  }
}

/* ==========================================================================
   My Projects — saved work history (bottom-nav "My Projects" tab)
   Reads from window.ProjectHistory (project-history.js, IndexedDB-backed).
   ========================================================================== */
const PROJECT_TYPE_ICONS = { editor: 'image', pdf: 'picture_as_pdf', convert: 'picture_as_pdf' };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function openMyProjectsView() {
  if (!elements.myProjectsView) return;
  if (elements.uploadLanding) elements.uploadLanding.classList.remove('active');
  if (elements.editorWorkspace) elements.editorWorkspace.classList.remove('active');
  elements.myProjectsView.classList.add('active');
  renderProjectsList();
}

async function renderProjectsList() {
  const listEl = document.getElementById('projectsList');
  const emptyEl = document.getElementById('projectsEmptyState');
  if (!listEl || !emptyEl) return;

  const items = window.ProjectHistory ? await window.ProjectHistory.list() : [];

  if (items.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');

  listEl.innerHTML = items.map((item) => {
    const icon = PROJECT_TYPE_ICONS[item.type] || 'description';
    const thumb = item.thumbnail
      ? `<img src="${item.thumbnail}" alt="">`
      : `<span class="material-symbols-outlined">${icon}</span>`;
    return `
      <div class="project-card" data-id="${escapeHtml(item.id)}">
        <div class="project-card-thumb">${thumb}</div>
        <div class="project-card-info">
          <p class="project-card-title" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</p>
          <p class="project-card-meta">${escapeHtml(item.toolLabel)} · ${escapeHtml(window.ProjectHistory.formatWhen(item.createdAt))}</p>
        </div>
        <div class="project-card-actions">
          <button type="button" class="project-card-action" data-action="redownload" title="Re-download" aria-label="Re-download"><span class="material-symbols-outlined">download</span></button>
          <button type="button" class="project-card-action" data-action="reopen" title="Open" aria-label="Open"><span class="material-symbols-outlined">open_in_new</span></button>
          <button type="button" class="project-card-action" data-action="delete" title="Delete" aria-label="Delete"><span class="material-symbols-outlined">delete</span></button>
        </div>
      </div>`;
  }).join('');
}

function initMyProjectsView() {
  if (!elements.myProjectsView) return;

  const navLink = document.querySelector('.mobile-bottom-nav a[data-nav="projects"]');
  if (navLink) {
    navLink.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', '#myProjects');
      openMyProjectsView();
    });
  }

  const emptyCta = document.getElementById('projectsEmptyCta');
  if (emptyCta) {
    emptyCta.addEventListener('click', () => {
      elements.backToUploadBtn.click();
    });
  }

  const listEl = document.getElementById('projectsList');
  if (listEl) {
    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.project-card-action');
      if (!btn || !window.ProjectHistory) return;
      const card = btn.closest('.project-card');
      const id = card && card.getAttribute('data-id');
      if (!id) return;
      const action = btn.getAttribute('data-action');

      if (action === 'redownload') {
        await window.ProjectHistory.redownload(id);
      } else if (action === 'reopen') {
        await window.ProjectHistory.open(id);
      } else if (action === 'delete') {
        await window.ProjectHistory.remove(id);
        renderProjectsList();
      }
    });
  }

  // Deep link from the PDF Hub pages: ../index.html#myProjects
  if (window.location.hash === '#myProjects') openMyProjectsView();
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#myProjects') openMyProjectsView();
  });
}

// Convert uploaded file to Image object
function handleImageFile(file) {
  state.originalFilename = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
  state.originalFileType = file.type;
  
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    loadPdfFile(file);
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      processUploadedImage(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Run when image object is successfully loaded
function processUploadedImage(img) {
  state.originalImage = img;
  state.originalAspectRatio = img.width / img.height;
  
  // Default fallbacks
  state.transparentImage = img;
  state.eraserBaseImage = img;
  state.bgRemoved = false;
  state.aiDetectionRun = false;
  state.brushStrokes = [];
  state.appliedStrokes = [];
  wmHistory.clear();
  
  // Toggle checkerboard background based on whether image format supports transparency
  const isTransparent = state.originalFileType === 'image/png' || state.originalFileType === 'image/webp' || state.originalFileType === 'image/gif';
  const patternBgs = document.querySelectorAll('.canvas-bg-pattern');
  patternBgs.forEach(bg => {
    if (isTransparent) {
      bg.classList.add('checkerboard-bg');
      bg.style.backgroundColor = 'transparent';
    } else {
      bg.classList.remove('checkerboard-bg');
      bg.style.backgroundColor = '#f8fafc'; // Light dotted-grid background fallback color
    }
  });
  
  // Default sizes
  state.exportWidth = img.width;
  state.exportHeight = img.height;
  elements.customWidth.value = img.width;
  elements.customHeight.value = img.height;
  
  // Configure Before image in slide comparison
  elements.imgBefore.src = img.src;
  
  // Create and push a new history item
  const id = 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const newItem = {
    id: id,
    originalImage: img,
    transparentImage: img,
    eraserBaseImage: img,
    bgRemoved: false,
    filename: state.originalFilename || 'image',
    aspectRatio: state.originalAspectRatio
  };
  state.history.push(newItem);
  state.currentHistoryId = id;
  
  // Show editor panel
  elements.uploadLanding.classList.remove('active');
  elements.editorWorkspace.classList.add('active');
  
  // Initialize view mode
  setViewMode('removed');
  
  // Switch to the selected tab (will trigger BG removal if bg-remover is active)
  switchTab(state.activeTab);
  
  // Update history list UI
  updateHistoryUI();
}

/* ==========================================================================
   AI Background Removal Integration
   ========================================================================== */
async function runAIBackgroundRemoval(imgSource) {
  showAIProcessingOverlay('AI is removing your background...');

  const targetHistoryId = state.currentHistoryId;

  try {
    // Draw image to a canvas to get base64 data URL. Downscaled to a safe
    // max dimension first: Vercel Serverless Functions hard-cap both request
    // AND response bodies at 4.5MB (FUNCTION_PAYLOAD_TOO_LARGE otherwise),
    // and a full-resolution phone photo re-encoded losslessly as PNG +
    // base64 (~33% overhead) blows past that routinely. remove.bg's own
    // free/no-credit tier is capped to "preview" resolution anyway, so this
    // costs nothing there while making full-credit "auto" requests reliable
    // for large source images too.
    const MAX_API_DIMENSION = 1600;
    const srcW = imgSource.naturalWidth || imgSource.width;
    const srcH = imgSource.naturalHeight || imgSource.height;
    const apiScale = Math.min(1, MAX_API_DIMENSION / Math.max(srcW, srcH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW * apiScale);
    canvas.height = Math.round(srcH * apiScale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);

    // Extract base64 representation of image (lossless PNG — JPEG re-encoding
    // introduces chroma-block artifacts that remove.bg then bakes into the
    // alpha mask edges, causing grainy/splotchy fringing around hair etc.)
    const dataURL = canvas.toDataURL('image/png');
    const base64Data = dataURL.split(',')[1];

    // Call the Vercel Serverless Function
    const response = await fetch('/api/remove-bg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: base64Data })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Retrieve processed binary PNG blob
    const blob = await response.blob();

    const resultUrl = URL.createObjectURL(blob);
    const transparentImg = new Image();
    transparentImg.onload = () => {
      state.transparentImage = transparentImg;
      state.eraserBaseImage = transparentImg; // Start eraser history with the cutout
      state.bgRemoved = true;
      
      // Update history item
      const item = state.history.find(h => h.id === targetHistoryId);
      if (item) {
        item.transparentImage = transparentImg;
        item.eraserBaseImage = transparentImg;
        item.bgRemoved = true;
      }
      
      // Initialize Background Remover canvas
      renderBGRemoverCanvas();
      fitBGRemoverCanvasToView();

      // Auto-trigger layout setup for other workspaces
      initWatermarkEraserBase();
      renderWMMakerCanvas();
      fitWMMakerCanvasToView();

      updateHistoryUI();
      hideAIProcessingOverlay();
    };
    transparentImg.src = resultUrl;

  } catch (error) {
    console.error('AI background removal failed:', error);
    hideAIProcessingOverlay({ immediate: true });

    // Styled fallback modal (replaces the old native alert()/confirm()).
    const useSampleCutout = await showBgRemovalFallbackModal(imgSource);

    if (!useSampleCutout) {
      // Switch back to original transparent
      state.transparentImage = imgSource;
      state.eraserBaseImage = imgSource;
      state.bgRemoved = true;

      // Update history item
      const item = state.history.find(h => h.id === targetHistoryId);
      if (item) {
        item.transparentImage = imgSource;
        item.eraserBaseImage = imgSource;
        item.bgRemoved = true;
      }

      renderBGRemoverCanvas();
      fitBGRemoverCanvasToView();
      initWatermarkEraserBase();
      renderWMMakerCanvas();
      fitWMMakerCanvasToView();

      updateHistoryUI();
    }
    // If useSampleCutout is true, applyMagicCutoutFallback() (invoked by the
    // modal itself) has already updated state and re-rendered the canvases.
  }
}

// Styled replacement for the native alert()/confirm() previously shown when
// the remove.bg call fails. Resolves true if the user asked for (and got) a
// successful Magic Cutout fallback, false if they cancelled/closed the modal.
function showBgRemovalFallbackModal(imgSource) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('bgRemovalFallbackModal');
    const stateChoice = document.getElementById('bgFallbackStateChoice');
    const stateLoading = document.getElementById('bgFallbackStateLoading');
    const stateError = document.getElementById('bgFallbackStateError');
    const errorText = document.getElementById('bgFallbackErrorText');
    const btnTry = document.getElementById('btnBgFallbackTry');
    const btnCancel = document.getElementById('btnBgFallbackCancel');
    const btnClose = document.getElementById('btnBgFallbackClose');
    const btnCloseX = document.getElementById('closeBgFallbackModalBtn');
    if (!dialog || !stateChoice || !stateLoading || !stateError || !btnTry || !btnCancel || !btnClose || !btnCloseX) {
      resolve(false);
      return;
    }

    let settled = false;

    function showState(which) {
      stateChoice.classList.toggle('hidden', which !== 'choice');
      stateLoading.classList.toggle('hidden', which !== 'loading');
      stateError.classList.toggle('hidden', which !== 'error');
    }

    function cleanup() {
      btnTry.removeEventListener('click', onTry);
      btnCancel.removeEventListener('click', onCancel);
      btnClose.removeEventListener('click', onCancel);
      btnCloseX.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onDialogClose);
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function onCancel() {
      finish(false);
      dialog.close();
    }

    // Catches ESC / backdrop-driven native close too, so the Promise never
    // hangs if the user dismisses the dialog some way other than our buttons.
    function onDialogClose() {
      finish(false);
    }

    async function onTry() {
      showState('loading');
      try {
        await applyMagicCutoutFallback(imgSource);
        finish(true);
        dialog.close();
      } catch (e) {
        console.error('Magic Cutout fallback failed:', e);
        errorText.textContent = 'Something went wrong applying the local cutout' + (e && e.message ? ': ' + e.message : '.') + ' Please try a different image.';
        showState('error');
      }
    }

    btnTry.addEventListener('click', onTry);
    btnCancel.addEventListener('click', onCancel);
    btnClose.addEventListener('click', onCancel);
    btnCloseX.addEventListener('click', onCancel);
    dialog.addEventListener('close', onDialogClose);

    showState('choice');
    dialog.showModal();
  });
}

// Local, in-browser fallback for when the cloud API call fails: cuts out
// pixels near the top-left corner's color (a crude but dependency-free
// background guess). Returns a Promise so callers (the fallback modal) can
// show a loading state and surface a real error instead of failing silently.
function applyMagicCutoutFallback(img) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample top-left corner color as background color target
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      const threshold = 40; // color distance threshold

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        const dist = Math.sqrt(
          Math.pow(r - bgR, 2) +
          Math.pow(g - bgG, 2) +
          Math.pow(b - bgB, 2)
        );

        if (dist < threshold) {
          data[i+3] = 0; // Set alpha to transparent
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        state.transparentImage = fallbackImg;
        state.eraserBaseImage = fallbackImg;
        state.bgRemoved = true;

        // Update history item
        const item = state.history.find(h => h.id === state.currentHistoryId);
        if (item) {
          item.transparentImage = fallbackImg;
          item.eraserBaseImage = fallbackImg;
          item.bgRemoved = true;
        }

        renderBGRemoverCanvas();
        fitBGRemoverCanvasToView();
        initWatermarkEraserBase();
        renderWMMakerCanvas();
        fitWMMakerCanvasToView();
        updateHistoryUI();
        resolve();
      };
      fallbackImg.onerror = () => reject(new Error('Failed to load the processed image.'));
      fallbackImg.src = canvas.toDataURL();
    } catch (e) {
      reject(e);
    }
  });
}

function showGlobalLoader(statusText, progressText) {
  elements.processingOverlay.classList.remove('hidden');
  elements.processingStatus.innerText = statusText;
  elements.processingProgress.innerText = progressText;
}

function hideGlobalLoader() {
  elements.processingOverlay.classList.add('hidden');
}

// ── AI Processing Overlay ───────────────────────────────────────────────
// Canvas-level "AI is thinking" animation for Background Eraser / Watermark
// Remover / Watermark Maker AI actions. Runs for at least AI_OVERLAY_MIN_MS
// so fast responses don't feel like a flicker; loops indefinitely (via CSS
// infinite animations) if the real work takes longer.
const AI_OVERLAY_MIN_MS = 20000;
let aiOverlayShownAt = 0;
let aiOverlayHideTimer = null;

function showAIProcessingOverlay(text) {
  const el = elements.aiProcessingOverlay;
  if (!el) return;

  if (aiOverlayHideTimer) {
    clearTimeout(aiOverlayHideTimer);
    aiOverlayHideTimer = null;
  }
  if (elements.aiProcessingText) {
    elements.aiProcessingText.innerText = text || 'AI is working on your image...';
  }

  if (!el.classList.contains('visible')) {
    el.classList.remove('hidden');
    positionAIProcessingOverlay();
    void el.offsetWidth; // force reflow so the opacity transition plays
    el.classList.add('visible');
    aiOverlayShownAt = Date.now();
  } else {
    positionAIProcessingOverlay();
  }
  // If already visible (e.g. scan -> erase chained calls), keep the original
  // aiOverlayShownAt so the minimum-duration clock isn't reset mid-flow.
}

function hideAIProcessingOverlay(options = {}) {
  const el = elements.aiProcessingOverlay;
  if (!el) return;

  if (aiOverlayHideTimer) {
    clearTimeout(aiOverlayHideTimer);
    aiOverlayHideTimer = null;
  }

  const elapsed = Date.now() - aiOverlayShownAt;
  const wait = options.immediate ? 0 : Math.max(0, AI_OVERLAY_MIN_MS - elapsed);

  aiOverlayHideTimer = setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('hidden'), 550); // let the opacity fade finish first
    aiOverlayHideTimer = null;
  }, wait);
}

/* ==========================================================================
   Tab Selection Control
   ========================================================================== */
function initTabHandlers() {
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  
  // Update Editor Tab Button styles
  elements.tabBtns.forEach(b => {
    if (b.getAttribute('data-tab') === tab) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Toggle workspace canvases
  elements.workspaceViews.forEach(view => {
    if (view.id === `view-${tab}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });
  
  // Toggle Config Settings on the right
  elements.configSections.forEach(section => {
    if (section.id === `config-${tab}`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });
  
  // Perform initial renders or auto-triggers on tab changes
  if (tab === 'bg-remover') {
    if (!state.bgRemoved && state.originalImage) {
      // Auto-trigger background removal if it hasn't run yet, passing the current edited base image
      runAIBackgroundRemoval(state.eraserBaseImage || state.originalImage);
    } else {
      renderBGRemoverCanvas();
      fitBGRemoverCanvasToView();
    }
  } else if (tab === 'wm-remover') {
    setTimeout(() => {
      initWatermarkEraserBase();
      window.dispatchEvent(new Event('resize'));
    }, 50);
  } else if (tab === 'wm-maker') {
    renderWMMakerCanvas();
    fitWMMakerCanvasToView();
  }

  applyZoomPan();
  updateHistoryUI();
}

/* ==========================================================================
   Tool 1: Background Remover Panel & Custom Backdrops
   ========================================================================== */
function initBGRemoverHandlers() {
  // BG Type toggle
  elements.bgTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const bgType = btn.getAttribute('data-bg-type');
      state.bgType = bgType;
      
      elements.bgTypeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle configurations sub-panels
      elements.bgColorConfig.classList.add('hidden');
      elements.bgImageConfig.classList.add('hidden');
      
      if (bgType === 'color') {
        elements.bgColorConfig.classList.remove('hidden');
      } else if (bgType === 'image') {
        elements.bgImageConfig.classList.remove('hidden');
      }
      
      renderBGRemoverCanvas();
    });
  });
  
  // Custom Solid Color Pick
  elements.bgColorPicker.addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    state.bgGradient = '';
    
    // Clear active presets
    elements.colorPresets.forEach(preset => preset.classList.remove('active'));
    renderBGRemoverCanvas();
  });
  
  // Preset Colors/Gradients Click
  elements.colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      elements.colorPresets.forEach(p => p.classList.remove('active'));
      preset.classList.add('active');
      
      const grad = preset.getAttribute('data-gradient');
      const col = preset.getAttribute('data-color');
      
      if (grad) {
        state.bgGradient = grad;
        state.bgColor = '';
      } else {
        state.bgColor = col;
        state.bgGradient = '';
        elements.bgColorPicker.value = col;
      }
      renderBGRemoverCanvas();
    });
  });
  
  // Backdrop Image Select
  elements.btnUploadBackdrop.addEventListener('click', () => {
    elements.bgImageInput.click();
  });
  
  elements.bgImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          state.bgCustomImage = img;
          elements.backdropPresets.forEach(p => p.classList.remove('active'));
          renderBGRemoverCanvas();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  // Preset Backdrop Images Click
  elements.backdropPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      elements.backdropPresets.forEach(p => p.classList.remove('active'));
      preset.classList.add('active');
      
      const url = preset.getAttribute('data-bg-url');
      showGlobalLoader('Loading backdrop...', 'Please wait');
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        state.bgCustomImage = img;
        renderBGRemoverCanvas();
        hideGlobalLoader();
      };
      img.onerror = () => {
        hideGlobalLoader();
        alert('Failed to load backdrop image preset.');
      };
      img.src = url;
    });
  });
  
  // Original vs Removed Background View Switcher
  const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-view-mode');
      setViewMode(mode);
    });
  });
}

function setViewMode(mode) {
  const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
  viewToggleBtns.forEach(btn => {
    if (btn.getAttribute('data-view-mode') === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const originalWrapper = document.getElementById('previewOriginalWrapper');
  const removedWrapper = document.getElementById('bgRemoverResultContainer');

  if (mode === 'original') {
    originalWrapper.classList.remove('hidden');
    removedWrapper.classList.add('hidden');
  } else {
    originalWrapper.classList.add('hidden');
    removedWrapper.classList.remove('hidden');
  }
}

// Render background removals overlay to final canvas preview
function renderBGRemoverCanvas() {
  if (!state.transparentImage) return;
  
  const canvas = elements.bgRemoverCanvas;
  const ctx = canvas.getContext('2d');
  
  const imgWidth = state.transparentImage.width;
  const imgHeight = state.transparentImage.height;
  
  // Set dimensions matching original image aspect ratio
  canvas.width = imgWidth;
  canvas.height = imgHeight;

  // Give the canvas + its wrapper a definite native-pixel CSS size (mirrors the
  // Watermark Remover tab's approach in initWatermarkEraserBase). Without this,
  // the percentage width/height chain up through .preview-container/.canvas-box
  // is ambiguous, leaving the canvas unconstrained and clipped instead of
  // scaled/centered by the zoom transform in applyZoomPan().
  canvas.style.width = `${imgWidth}px`;
  canvas.style.height = `${imgHeight}px`;
  if (elements.bgRemoverResultContainer) {
    elements.bgRemoverResultContainer.style.width = `${imgWidth}px`;
    elements.bgRemoverResultContainer.style.height = `${imgHeight}px`;
  }

  // Step 1: Draw Background
  if (state.bgType === 'transparent') {
    ctx.clearRect(0, 0, imgWidth, imgHeight);
  } else if (state.bgType === 'color') {
    if (state.bgGradient) {
      // Split CSS linear gradient string to colors (simple parsing)
      // Standard linear gradient (135deg, col1 0%, col2 100%)
      const grad = ctx.createLinearGradient(0, 0, imgWidth, imgHeight);
      if (state.bgGradient.includes('#ff9a9e')) {
        grad.addColorStop(0, '#ff9a9e'); grad.addColorStop(1, '#fecfef');
      } else if (state.bgGradient.includes('#a1c4fd')) {
        grad.addColorStop(0, '#a1c4fd'); grad.addColorStop(1, '#c2e9fb');
      } else if (state.bgGradient.includes('#f6d365')) {
        grad.addColorStop(0, '#f6d365'); grad.addColorStop(1, '#fda085');
      } else if (state.bgGradient.includes('#4facfe')) {
        grad.addColorStop(0, '#4facfe'); grad.addColorStop(1, '#00f2fe');
      } else if (state.bgGradient.includes('#667eea')) {
        grad.addColorStop(0, '#667eea'); grad.addColorStop(1, '#764ba2');
      } else {
        grad.addColorStop(0, '#4f46e5'); grad.addColorStop(1, '#818cf8');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, imgWidth, imgHeight);
    } else {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, imgWidth, imgHeight);
    }
  } else if (state.bgType === 'image' && state.bgCustomImage) {
    // Fit backdrop image to canvas size using cover scaling
    const bg = state.bgCustomImage;
    const bgRatio = bg.width / bg.height;
    const canvasRatio = imgWidth / imgHeight;
    let dx = 0, dy = 0, dWidth = imgWidth, dHeight = imgHeight;
    
    if (bgRatio > canvasRatio) {
      const scale = imgHeight / bg.height;
      dWidth = bg.width * scale;
      dx = (imgWidth - dWidth) / 2;
    } else {
      const scale = imgWidth / bg.width;
      dHeight = bg.height * scale;
      dy = (imgHeight - dHeight) / 2;
    }
    
    ctx.drawImage(bg, dx, dy, dWidth, dHeight);
  }
  
  // Step 2: Overlay Transparent Subject Cutout
  ctx.drawImage(state.transparentImage, 0, 0);
  
  // Save global processed buffer
  state.processedImage = canvas;
}

/* Helper to make a panel draggable relative to its parent container */
function makeElementDraggable(elmnt, dragTrigger) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const trigger = dragTrigger || elmnt;
  
  trigger.addEventListener('mousedown', dragMouseDown);
  trigger.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    e = e || window.event;
    // Don't drag if clicking buttons, links, or inputs inside the panel
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
    
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Bounds checking relative to parent
    const parent = elmnt.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elmntRect = elmnt.getBoundingClientRect();
    
    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;
    
    // Constrain to parent bounds
    if (newTop < 8) newTop = 8;
    if (newTop > parentRect.height - elmntRect.height - 8) newTop = parentRect.height - elmntRect.height - 8;
    if (newLeft < 8) newLeft = 8;
    if (newLeft > parentRect.width - elmntRect.width - 8) newLeft = parentRect.width - elmntRect.width - 8;
    
    elmnt.style.top = `${newTop}px`;
    elmnt.style.left = `${newLeft}px`;
    elmnt.style.right = 'auto'; // override absolute initial right/bottom alignment
    elmnt.style.bottom = 'auto';
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }

  function dragTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.addEventListener('touchend', closeDragTouch);
    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
  }

  function elementTouchDrag(e) {
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    
    const parent = elmnt.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const elmntRect = elmnt.getBoundingClientRect();
    
    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;
    
    if (newTop < 8) newTop = 8;
    if (newTop > parentRect.height - elmntRect.height - 8) newTop = parentRect.height - elmntRect.height - 8;
    if (newLeft < 8) newLeft = 8;
    if (newLeft > parentRect.width - elmntRect.width - 8) newLeft = parentRect.width - elmntRect.width - 8;
    
    elmnt.style.top = `${newTop}px`;
    elmnt.style.left = `${newLeft}px`;
    elmnt.style.right = 'auto';
    elmnt.style.bottom = 'auto';
  }

  function closeDragTouch() {
    document.removeEventListener('touchend', closeDragTouch);
    document.removeEventListener('touchmove', elementTouchDrag);
  }
}

/* ==========================================================================
   Tool 2: Watermark Eraser Canvas and Custom Laplace Inpainter
   ========================================================================== */
function initWatermarkEraserBase() {
  if (!state.eraserBaseImage) return;
  
  const baseCanvas = elements.wmRemoverBaseCanvas;
  const container = baseCanvas.closest('.canvas-box') || baseCanvas.parentElement;
  
  if (container) {
    const containerRect = container.getBoundingClientRect();
    if (containerRect.height === 0 || containerRect.width === 0) {
      requestAnimationFrame(initWatermarkEraserBase);
      return;
    }
  }
  
  const brushCanvas = elements.wmRemoverBrushCanvas;
  const w = state.eraserBaseImage.width;
  const h = state.eraserBaseImage.height;
  
  // Set dimensions matching original image
  baseCanvas.width = w;
  baseCanvas.height = h;
  brushCanvas.width = w;
  brushCanvas.height = h;
  
  // Fit this canvas to the available container space (same shared formula
  // used by Background Eraser and Watermark Maker, see computeFitZoom).
  const screenScale = computeFitZoom(container, w, h);

  // Canvas layout dimensions should be exactly the original image dimensions
  baseCanvas.style.width = `${w}px`;
  baseCanvas.style.height = `${h}px`;
  brushCanvas.style.width = `${w}px`;
  brushCanvas.style.height = `${h}px`;
  
  const layersDiv = baseCanvas.parentElement;
  layersDiv.style.width = `${w}px`;
  layersDiv.style.height = `${h}px`;
  
  // Set default zoom to fit the screen
  state.zoom = screenScale;
  state.panX = 0;
  state.panY = 0;
  state.panMode = false;
  const panToggleBtn = document.getElementById('panToggleBtn');
  if (panToggleBtn) {
    panToggleBtn.classList.remove('active');
    elements.wmRemoverBrushCanvas.style.cursor = 'crosshair';
  }
  applyZoomPan();
  
  const baseCtx = baseCanvas.getContext('2d');
  baseCtx.drawImage(state.eraserBaseImage, 0, 0);
  
  // Setup Undo History initially
  if (!elements.wmRemoverMaskCanvas) {
    elements.wmRemoverMaskCanvas = document.createElement('canvas');
  }
  elements.wmRemoverMaskCanvas.width = w;
  elements.wmRemoverMaskCanvas.height = h;
  const maskCtx = elements.wmRemoverMaskCanvas.getContext('2d');
  
  if (wmHistory.undoStack.length === 0) {
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, w, h);
    wmHistory.push(elements.wmRemoverMaskCanvas);
  }
  
  // Clear brush canvas
  const brushCtx = brushCanvas.getContext('2d');
  brushCtx.clearRect(0, 0, w, h);
  
  // Initialize comparison image and active mode
  const compareImg = elements.wmRemoverCompareImg;
  if (compareImg && state.originalImage) {
    compareImg.src = state.originalImage.src;
  }
  setWMEraserMode(state.wmMode || 'brush');
}

// Shared "fit image to the available canvas area" formula used by all 3
// editor tools (Background Eraser, Watermark Remover, Watermark Maker) so
// switching tabs always lands on the same, consistent zoom level instead of
// each tool computing its own scale. Returns a zoom multiplier such that an
// image of imgWidth x imgHeight fills ~90% of containerEl's box (falling
// back to a viewport-relative box if containerEl isn't measurable yet).
function computeFitZoom(containerEl, imgWidth, imgHeight) {
  let maxW = window.innerWidth * 0.9;
  let maxH = window.innerHeight * 0.55 * 0.9;
  if (containerEl) {
    const rect = containerEl.getBoundingClientRect();
    if (rect.width > 0) maxW = rect.width * 0.9;
    if (rect.height > 0) maxH = rect.height * 0.9;
  }

  const scaleW = maxW / imgWidth;
  const scaleH = maxH / imgHeight;
  return Math.min(scaleW, scaleH);
}

// Scale + center the BG Remover canvas to fit inside the visible viewport.
function fitBGRemoverCanvasToView() {
  if (!state.transparentImage) return;

  const canvasBox = elements.bgRemoverCanvas.closest('.canvas-box') || document.querySelector('.canvas-box');
  state.zoom = computeFitZoom(canvasBox, state.transparentImage.width, state.transparentImage.height);
  state.panX = 0;
  state.panY = 0;
  applyZoomPan();
}

function applyZoomPan() {
  // The zoomable target differs per workspace tab since each view has its
  // own DOM structure (bg-remover / wm-remover / wm-maker).
  let target = null;
  if (state.activeTab === 'bg-remover') {
    target = elements.bgRemoverResultContainer;
  } else if (state.activeTab === 'wm-remover') {
    target = elements.wmRemoverBaseCanvas ? elements.wmRemoverBaseCanvas.parentElement : null; // .canvas-layers
  } else if (state.activeTab === 'wm-maker') {
    target = elements.wmMakerCanvas;
  }

  if (target) {
    target.style.transformOrigin = 'center center';
    target.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  }

  // Update the zoom level label
  const zoomLevelVal = document.getElementById('zoomLevelVal');
  if (zoomLevelVal) {
    zoomLevelVal.innerText = `${Math.round(state.zoom * 100)}%`;
  }

  // Update the image dimension readout ("2752 x 1536 px")
  const dimsVal = document.getElementById('canvasDimensionsVal');
  if (dimsVal) {
    let img = null;
    if (state.activeTab === 'bg-remover') {
      img = state.transparentImage;
    } else if (state.activeTab === 'wm-remover') {
      img = state.eraserBaseImage;
    } else if (state.activeTab === 'wm-maker') {
      img = state.processedImage || state.transparentImage;
    }
    dimsVal.textContent = img ? `${img.width}×${img.height} px` : '';
  }

  // Keep the AI processing overlay matched to the image's current bounding box
  positionAIProcessingOverlay();
}

// Size + position the AI processing overlay to exactly match the visible
// image's bounding box (not the whole canvas-box), so it keeps the image's
// own aspect ratio/position through zoom, pan, and window resize.
//
// .canvas-layers (the Watermark Remover zoom/pan target) animates its
// `transform` via a short CSS transition (styles.css `transition: transform
// 0.05s ease-out`). Reading getBoundingClientRect() synchronously right
// after applyZoomPan() writes a new transform can therefore catch a
// pre/mid-transition box instead of the final one, and nothing else would
// ever re-measure it afterward. So we measure immediately (for a responsive
// feel while zoom/pan happens continuously, e.g. wheel/drag) and then
// re-measure again once the transition has had time to settle.
let aiOverlayResyncTimer = null;

function positionAIProcessingOverlay() {
  const el = elements.aiProcessingOverlay;
  if (!el) return;

  const canvasBox = el.parentElement;
  if (!canvasBox) return;

  const applyMeasuredRect = () => {
    let target = null;
    if (state.activeTab === 'bg-remover') {
      target = elements.bgRemoverResultContainer;
    } else if (state.activeTab === 'wm-remover') {
      target = elements.wmRemoverBaseCanvas ? elements.wmRemoverBaseCanvas.parentElement : null;
    } else if (state.activeTab === 'wm-maker') {
      target = elements.wmMakerCanvas;
    }

    const targetRect = target ? target.getBoundingClientRect() : null;

    if (targetRect && targetRect.width > 0 && targetRect.height > 0) {
      const boxRect = canvasBox.getBoundingClientRect();
      el.style.left = `${targetRect.left - boxRect.left}px`;
      el.style.top = `${targetRect.top - boxRect.top}px`;
      el.style.width = `${targetRect.width}px`;
      el.style.height = `${targetRect.height}px`;
    } else {
      // Image not measurable yet (not rendered) — fall back to filling the canvas box
      el.style.left = '0';
      el.style.top = '0';
      el.style.width = '100%';
      el.style.height = '100%';
    }
  };

  applyMeasuredRect();

  clearTimeout(aiOverlayResyncTimer);
  aiOverlayResyncTimer = setTimeout(applyMeasuredRect, 140);
}

function initWMEraserHandlers() {
  const brushCanvas = elements.wmRemoverBrushCanvas;
  const brushCtx = brushCanvas.getContext('2d');
  
  // Brush size slider listener
  elements.brushSizeSlider.addEventListener('input', (e) => {
    state.brushSize = parseInt(e.target.value);
    elements.brushSizeVal.innerText = `${state.brushSize}px`;
  });
  
  // Clear brush overlays, strokes history, and reset to original image state
  elements.clearBrushBtn.addEventListener('click', () => {
    state.brushStrokes = [];
    state.appliedStrokes = [];
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    
    // Reset back to brush mode
    setWMEraserMode('brush');
    
    if (state.eraserBaseImage) {
      const baseCanvas = elements.wmRemoverBaseCanvas;
      const baseCtx = baseCanvas.getContext('2d');
      baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseCtx.drawImage(state.eraserBaseImage, 0, 0);
      
      // Reset state and transparent caches
      state.transparentImage = state.eraserBaseImage;
      
      // Update history item
      const item = state.history.find(h => h.id === state.currentHistoryId);
      if (item) {
        item.transparentImage = state.eraserBaseImage;
      }
      
      // Reset undo history stacks
      wmHistory.clear();
      wmHistory.push([]); // Push empty appliedStrokes as the initial state
      
      // Re-render and update UI
      renderBGRemoverCanvas();
      updateHistoryUI();
    }
    
    wmHistory.updateButtons();
  });
  
  // Mode switcher event listeners
  if (elements.wmModeSwitcher) {
    const modeBtns = elements.wmModeSwitcher.querySelectorAll('.btn-toggle');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-wm-mode');
        setWMEraserMode(mode);
      });
    });
  }

  // Draggable comparison slider bindings
  let isDraggingSlider = false;
  
  const onStartDrag = (e) => {
    isDraggingSlider = true;
    e.preventDefault();
  };
  
  const onMoveDrag = (e) => {
    if (!isDraggingSlider) return;
    const container = elements.wmRemoverBaseCanvas.parentElement; // .canvas-layers
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : 0));
    let x = clientX - rect.left;
    
    x = Math.max(0, Math.min(rect.width, x));
    const pct = (x / rect.width) * 100;
    
    updateSliderPosition(pct);
  };
  
  const onEndDrag = () => {
    isDraggingSlider = false;
  };
  
  if (elements.wmComparisonSlider) {
    elements.wmComparisonSlider.addEventListener('mousedown', onStartDrag);
    elements.wmComparisonSlider.addEventListener('touchstart', onStartDrag);
    
    window.addEventListener('mousemove', onMoveDrag);
    window.addEventListener('touchmove', onMoveDrag, { passive: false });
    
    window.addEventListener('mouseup', onEndDrag);
    window.addEventListener('touchend', onEndDrag);
  }

  // AI Auto-Detection Trigger
  if (elements.btnAIDetectRemove) {
    elements.btnAIDetectRemove.addEventListener('click', () => {
      runAIWatermarkDetection();
    });
  }
  
  elements.undoBrushBtn.addEventListener('click', (e) => {
    if (state.brushStrokes.length > 0) {
      // Undo drawing stroke
      state.brushStrokes.pop();
      redrawBrushCanvas();
      wmHistory.updateButtons();
    } else {
      // Undo inpaint action
      wmHistory.undo();
      // Switch back to brush mode when undoing inpainting so they see the editor
      setWMEraserMode('brush');
    }
  });
  
  // Brushing Mouse/Touch Listeners
  const getCoordinates = (e) => {
    const rect = brushCanvas.getBoundingClientRect();
    const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : (e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : 0));
    const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : (e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientY : 0));
    
    // Scale matching the display aspect ratio relative to absolute canvas resolution
    const x = ((clientX - rect.left) / rect.width) * brushCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * brushCanvas.height;
    
    return { x, y };
  };
  
  const getCanvasBrushSize = () => {
    const rect = brushCanvas.getBoundingClientRect();
    if (!rect.width) return state.brushSize;
    // Scale brush size relative to display vs absolute canvas resolution
    return state.brushSize * (brushCanvas.width / rect.width);
  };
  
  let currentStroke = [];
  
  const startDrawing = (e) => {
    if (state.wmMode === 'compare') return;
    if (state.panMode || window.isSpacePressed || e.button === 1 || e.button === 2 || (e.touches && e.touches.length > 1)) return;
    state.isDrawing = true;
    const { x, y } = getCoordinates(e);
    const canvasBrushSize = getCanvasBrushSize();
    
    brushCtx.beginPath();
    brushCtx.arc(x, y, canvasBrushSize / 2, 0, Math.PI * 2);
    brushCtx.fillStyle = 'rgba(239, 68, 68, 0.45)'; // Semi-transparent Red Highlight
    brushCtx.fill();
    
    currentStroke = [{ x, y, size: canvasBrushSize }];
    
    brushCtx.beginPath();
    brushCtx.moveTo(x, y);
  };
  
  const draw = (e) => {
    if (state.wmMode === 'compare') return;
    if (!state.isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvasBrushSize = getCanvasBrushSize();
    
    if (currentStroke.length > 0) {
      const lastPoint = currentStroke[currentStroke.length - 1];
      brushCtx.beginPath();
      brushCtx.moveTo(lastPoint.x, lastPoint.y);
      brushCtx.lineTo(x, y);
      brushCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      brushCtx.lineWidth = canvasBrushSize;
      brushCtx.lineCap = 'round';
      brushCtx.lineJoin = 'round';
      brushCtx.stroke();
    }
    
    currentStroke.push({ x, y, size: canvasBrushSize });
  };
  
  const stopDrawing = () => {
    if (state.isDrawing) {
      state.isDrawing = false;
      if (currentStroke.length > 0) {
        state.brushStrokes.push(currentStroke);
        currentStroke = [];
        wmHistory.updateButtons();
      }
    }
  };
  
  const redrawBrushCanvas = () => {
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    state.brushStrokes.forEach(stroke => {
      if (stroke.length === 0) return;
      
      const first = stroke[0];
      brushCtx.beginPath();
      brushCtx.arc(first.x, first.y, first.size / 2, 0, Math.PI * 2);
      brushCtx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      brushCtx.fill();
      
      if (stroke.length > 1) {
        brushCtx.beginPath();
        brushCtx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.length; i++) {
          brushCtx.lineTo(stroke[i].x, stroke[i].y);
        }
        brushCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        brushCtx.lineWidth = first.size;
        brushCtx.lineCap = 'round';
        brushCtx.lineJoin = 'round';
        brushCtx.stroke();
      }
    });
  };
  
  brushCanvas.addEventListener('mousedown', startDrawing);
  brushCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDrawing);
  
  brushCanvas.addEventListener('touchstart', startDrawing);
  brushCanvas.addEventListener('touchmove', draw);
  window.addEventListener('touchend', stopDrawing);

  // Initialize Zoom & Pan Handlers
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const panToggleBtn = document.getElementById('panToggleBtn');
  const canvasBox = brushCanvas.closest('.canvas-box');
  
  if (zoomInBtn && zoomOutBtn && zoomFitBtn && panToggleBtn) {
    zoomInBtn.addEventListener('click', () => {
      state.zoom = Math.min(5.0, state.zoom + 0.15);
      applyZoomPan();
    });
    
    zoomOutBtn.addEventListener('click', () => {
      state.zoom = Math.max(0.2, state.zoom - 0.15);
      applyZoomPan();
    });
    
    zoomFitBtn.addEventListener('click', () => {
      let maxW = window.innerWidth * 0.9;
      let maxH = window.innerHeight * 0.55 * 0.9;
      if (canvasBox) {
        const rect = canvasBox.getBoundingClientRect();
        if (rect.width > 0) maxW = rect.width * 0.9;
        if (rect.height > 0) maxH = rect.height * 0.9;
      }
      const scaleW = maxW / state.eraserBaseImage.width;
      const scaleH = maxH / state.eraserBaseImage.height;
      state.zoom = Math.min(scaleW, scaleH);
      state.panX = 0;
      state.panY = 0;
      applyZoomPan();
    });
    
    panToggleBtn.addEventListener('click', () => {
      state.panMode = !state.panMode;
      panToggleBtn.classList.toggle('active', state.panMode);
      if (state.panMode) {
        brushCanvas.style.cursor = 'grab';
      } else {
        brushCanvas.style.cursor = 'crosshair';
      }
    });
  }

  // Wheel Zoom (Mouse scroll zoom)
  if (canvasBox) {
    canvasBox.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 0.05;
      if (e.deltaY < 0) {
        state.zoom = Math.min(5.0, state.zoom + zoomFactor);
      } else {
        state.zoom = Math.max(0.2, state.zoom - zoomFactor);
      }
      applyZoomPan();
    }, { passive: false });
  }

  // Drag Pan Mechanics
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;
  
  const startPan = (clientX, clientY) => {
    isPanning = true;
    startPanX = clientX - state.panX;
    startPanY = clientY - state.panY;
    if (state.panMode) {
      brushCanvas.style.cursor = 'grabbing';
    }
  };
  
  const movePan = (clientX, clientY) => {
    if (!isPanning) return;
    state.panX = clientX - startPanX;
    state.panY = clientY - startPanY;
    applyZoomPan();
  };
  
  const endPan = () => {
    if (isPanning) {
      isPanning = false;
      if (state.panMode) {
        brushCanvas.style.cursor = 'grab';
      } else if (window.isSpacePressed) {
        brushCanvas.style.cursor = 'grab';
      } else {
        brushCanvas.style.cursor = 'crosshair';
      }
    }
  };
  
  // Hook up panning drag handlers
  brushCanvas.addEventListener('mousedown', (e) => {
    const isSpacePressed = window.isSpacePressed;
    const isMiddleOrRightClick = e.button === 1 || e.button === 2;
    if (state.panMode || isSpacePressed || isMiddleOrRightClick) {
      e.preventDefault();
      startPan(e.clientX, e.clientY);
    }
  });
  
  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      e.preventDefault();
      movePan(e.clientX, e.clientY);
    }
  });
  
  window.addEventListener('mouseup', endPan);
  
  // Touch Panning & Pinch-to-Zoom
  let touchStartDist = 0;
  let touchStartZoom = 1.0;
  let isPinching = false;
  
  brushCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPinching = true;
      e.preventDefault();
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartZoom = state.zoom;
      
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      startPan(midX, midY);
    } else if (e.touches.length === 1 && state.panMode) {
      e.preventDefault();
      startPan(e.touches[0].clientX, e.touches[0].clientY);
    }
  });
  
  brushCanvas.addEventListener('touchmove', (e) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist;
      state.zoom = Math.max(0.2, Math.min(5.0, touchStartZoom * factor));
      
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      movePan(midX, midY);
    } else if (isPanning && e.touches.length === 1 && state.panMode) {
      e.preventDefault();
      movePan(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  
  brushCanvas.addEventListener('touchend', (e) => {
    if (isPinching) isPinching = false;
    endPan();
  });

  // Track spacebar globally
  if (!window.hasSpaceListeners) {
    window.hasSpaceListeners = true;
    window.isSpacePressed = false;
    
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          window.isSpacePressed = true;
          if (state.activeTab === 'wm-remover') {
            e.preventDefault();
            brushCanvas.style.cursor = 'grab';
          }
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        window.isSpacePressed = false;
        if (state.activeTab === 'wm-remover') {
          brushCanvas.style.cursor = state.panMode ? 'grab' : 'crosshair';
        }
      }
    });
  }
  
  // Inpaint trigger event
  elements.btnEraseWatermark.addEventListener('click', () => {
    runWatermarkInpaint();
  });

  // Make the floating panel draggable
  const floatingPanel = document.getElementById('floatingEraserPanel');
  const dragHeader = document.getElementById('floatingEraserHeader');
  if (floatingPanel && dragHeader) {
    makeElementDraggable(floatingPanel, dragHeader);
  }
}

// Copy red brush strokes onto our offscreen black-and-white mask canvas
function applyBrushToMask(brushCanvas, maskCanvas) {
  const bCtx = brushCanvas.getContext('2d');
  const mCtx = maskCanvas.getContext('2d');
  
  const w = brushCanvas.width;
  const h = brushCanvas.height;
  
  const bData = bCtx.getImageData(0, 0, w, h);
  const mData = mCtx.getImageData(0, 0, w, h);
  
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // If brush canvas pixel has any alpha
    if (bData.data[idx + 3] > 10) {
      mData.data[idx] = 255;     // R
      mData.data[idx + 1] = 255; // G
      mData.data[idx + 2] = 255; // B
      mData.data[idx + 3] = 255; // A (fully opaque white)
    }
  }
  mCtx.putImageData(mData, 0, 0);
}

// Run watermark inpainting — tries LaMa AI backend first, falls back to local OpenCV
function runWatermarkInpaint(isUndoOrRedo = false) {
  // Only show the full "AI is thinking" treatment for a fresh erase — undo/redo
  // replays a cached mask and should feel instant, not re-trigger a 20s animation.
  if (!isUndoOrRedo) {
    showAIProcessingOverlay('AI is erasing the watermark...');
  }

  const baseCanvas = elements.wmRemoverBaseCanvas;
  const brushCanvas = elements.wmRemoverBrushCanvas;

  const brushCtx = brushCanvas.getContext('2d');
  
  const w = baseCanvas.width;
  const h = baseCanvas.height;
  
  if (!isUndoOrRedo) {
    // Commit current active strokes to the persistent mask canvas
    if (elements.wmRemoverMaskCanvas) {
      applyBrushToMask(brushCanvas, elements.wmRemoverMaskCanvas);
    }
    state.brushStrokes = [];
    brushCtx.clearRect(0, 0, w, h);
  }
  
  // Build the original image + mask as data URIs
  const originalCanvas = document.createElement('canvas');
  originalCanvas.width = w;
  originalCanvas.height = h;
  const origCtx = originalCanvas.getContext('2d');
  origCtx.drawImage(state.eraserBaseImage, 0, 0);
  
  const imageDataURL = originalCanvas.toDataURL('image/png');
  const maskDataURL  = elements.wmRemoverMaskCanvas.toDataURL('image/png');
  
  // ── Gate: Pro users get AI LaMa, free users get local OpenCV ────────
  if (!isProUser()) {
    _runOpenCvFallback(originalCanvas, baseCanvas, isUndoOrRedo);
    return;
  }
  
  // ── Try LaMa backend first ──────────────────────────────────────────
  _tryLamaInpaint(imageDataURL, maskDataURL)
    .then(resultDataURI => {
      // LaMa succeeded — draw the result onto the display canvas
      const resultImg = new Image();
      resultImg.onload = () => {
        const ctx = baseCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(resultImg, 0, 0, w, h);
        _handleInpaintResult(baseCanvas, isUndoOrRedo);
      };
      resultImg.onerror = () => {
        console.warn('LaMa result image failed to load, falling back to OpenCV.');
        _runOpenCvFallback(originalCanvas, baseCanvas, isUndoOrRedo);
      };
      resultImg.src = resultDataURI;
    })
    .catch(err => {
      console.warn('LaMa AI backend unavailable, falling back to local OpenCV:', err.message || err);
      if (err.message === 'NO_CREDITS') {
        hideAIProcessingOverlay({ immediate: true });
        elements.checkoutModal.showModal();
        showToastNotification('You have run out of credits. Please purchase a credit pack.');
      } else if (err.message === 'UNAUTHORIZED') {
        hideAIProcessingOverlay({ immediate: true });
        elements.authModal.showModal();
        showToastNotification('Please sign in to use the AI Watermark Eraser.');
      } else {
        showToastNotification('AI cleanup failed. Using local mode instead.');
        _runOpenCvFallback(originalCanvas, baseCanvas, isUndoOrRedo);
      }
    });
}

// PHASE 1 placeholder — replace with real subscription check in Phase 2.
function isProUser() {
  return true;
}

// ── LaMa backend call ─────────────────────────────────────────────────
async function _tryLamaInpaint(imageDataURL, maskDataURL) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.user) {
    const token = await state.user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log('Calling AI backend...');
  const res = await fetch('/api/inpaint', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ image: imageDataURL, mask: maskDataURL })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || ('Server ' + res.status));
  
  return data.resultBase64; // data URI — no CORS/taint issues
}

// ── Local OpenCV fallback ─────────────────────────────────────────────
function _runOpenCvFallback(originalCanvas, baseCanvas, isUndoOrRedo) {
  if (!window.cvReady) {
    hideAIProcessingOverlay({ immediate: true });
    showToastNotification('AI engines unavailable. Please reload the page and try again.');
    return;
  }

  setTimeout(() => {
    try {
      const w = baseCanvas.width;
      const h = baseCanvas.height;
      const maskCanvas = elements.wmRemoverMaskCanvas;
      
      const src = cv.imread(originalCanvas);
      const maskM = cv.imread(maskCanvas);
      
      const srcRGB = new cv.Mat();
      cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);
      
      const maskGray = new cv.Mat();
      cv.cvtColor(maskM, maskGray, cv.COLOR_RGBA2GRAY);
      cv.threshold(maskGray, maskGray, 10, 255, cv.THRESH_BINARY);
      
      const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
      cv.dilate(maskGray, maskGray, kernel);
      
      const dst = new cv.Mat();
      cv.inpaint(srcRGB, maskGray, dst, 3, cv.INPAINT_TELEA);
      
      cv.imshow(baseCanvas, dst);
      
      // Free OpenCV matrices immediately
      src.delete();
      maskM.delete();
      srcRGB.delete();
      maskGray.delete();
      dst.delete();
      kernel.delete();
      
      _handleInpaintResult(baseCanvas, isUndoOrRedo);
      
    } catch (error) {
      console.error("OpenCV inpainting error:", error);
      hideAIProcessingOverlay({ immediate: true });
      alert("Watermark erasure failed: " + error.message);
    }
  }, 50);
}

// ── Shared post-inpaint handler ───────────────────────────────────────
function _handleInpaintResult(baseCanvas, isUndoOrRedo) {
  // Push mask state to history (only on new erase, not undo/redo)
  if (!isUndoOrRedo) {
    wmHistory.push(elements.wmRemoverMaskCanvas);
  }
  
  // Update local cache with the inpainted result
  const updatedImg = new Image();
  updatedImg.onload = () => {
    state.transparentImage = updatedImg;
    // DO NOT overwrite state.eraserBaseImage! Keep it pristine!
    
    const item = state.history.find(h => h.id === state.currentHistoryId);
    if (item) {
      item.transparentImage = updatedImg;
    }
    
    renderBGRemoverCanvas();
    updateHistoryUI();
    
    if (!isUndoOrRedo) {
      setWMEraserMode('compare');
    }

    // Undo/redo never opened the overlay, so close it instantly if it's
    // still showing from an unrelated action instead of inheriting its wait.
    hideAIProcessingOverlay({ immediate: isUndoOrRedo });
  };
  updatedImg.src = baseCanvas.toDataURL();
}

// ==========================================================================
// PixelBin-Style Upgrades: Slider, Mode Switcher & AI Auto-Detection
// ==========================================================================
function setWMEraserMode(mode) {
  state.wmMode = mode;
  
  if (elements.wmModeSwitcher) {
    const modeBtns = elements.wmModeSwitcher.querySelectorAll('.btn-toggle');
    modeBtns.forEach(btn => {
      if (btn.getAttribute('data-wm-mode') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  
  const compareImg = elements.wmRemoverCompareImg;
  const slider = elements.wmComparisonSlider;
  const brushCanvas = elements.wmRemoverBrushCanvas;
  
  if (mode === 'compare') {
    if (compareImg && state.originalImage) {
      compareImg.src = state.originalImage.src;
      compareImg.style.display = 'block';
    }
    if (slider) {
      slider.style.display = 'block';
      updateSliderPosition(state.wmSliderPercent || 50);
    }
    if (brushCanvas) {
      brushCanvas.style.display = 'none';
    }
  } else {
    if (compareImg) compareImg.style.display = 'none';
    if (slider) slider.style.display = 'none';
    if (brushCanvas) brushCanvas.style.display = 'block';
  }
}

function updateSliderPosition(percent) {
  state.wmSliderPercent = percent;
  const slider = elements.wmComparisonSlider;
  const compareImg = elements.wmRemoverCompareImg;
  
  if (slider) {
    slider.style.left = `${percent}%`;
  }
  if (compareImg) {
    compareImg.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  }
}

function runAIWatermarkDetection() {
  const baseCanvas = elements.wmRemoverBaseCanvas;
  if (!baseCanvas) return;
  
  const w = baseCanvas.width;
  const h = baseCanvas.height;
  
  const baseCtx = baseCanvas.getContext('2d');
  const imgData = baseCtx.getImageData(0, 0, w, h);
  
  const detectText = elements.toggleDetectText.checked;
  const detectLogo = elements.toggleDetectLogo.checked;
  
  if (!detectText && !detectLogo) {
    showToastNotification('Please select at least one detection layer (Text or Logo).');
    return;
  }
  
  showAIProcessingOverlay('AI is scanning for watermarks...');

  setTimeout(() => {
    try {
      const mask = detectWatermarkMask(imgData, detectText, detectLogo);
      
      const brushCanvas = elements.wmRemoverBrushCanvas;
      const brushCtx = brushCanvas.getContext('2d');
      brushCtx.clearRect(0, 0, w, h);
      
      const brushImgData = brushCtx.createImageData(w, h);
      let count = 0;
      for (let i = 0; i < w * h; i++) {
        if (mask[i] === 1) {
          const idx = i * 4;
          brushImgData.data[idx] = 239;     // R
          brushImgData.data[idx + 1] = 68;  // G
          brushImgData.data[idx + 2] = 68;  // B
          brushImgData.data[idx + 3] = 115; // A (0.45 opacity)
          count++;
        }
      }
      
      if (count > 0) {
        brushCtx.putImageData(brushImgData, 0, 0);

        // Push dummy brush stroke to support undo history stack triggers
        state.brushStrokes.push([{ x: 0, y: 0, size: 0 }]);

        showToastNotification(`AI successfully highlighted watermark areas. Erasing...`);
        // Keep the same overlay running straight into the erase pass — no
        // hide/show flicker between "scanning" and "erasing".
        runWatermarkInpaint();
      } else {
        hideAIProcessingOverlay({ immediate: true });
        showToastNotification('No watermarks automatically detected. Please use Brush Mode to paint manually.');
      }
    } catch (err) {
      console.error(err);
      hideAIProcessingOverlay({ immediate: true });
      showToastNotification('Detection failed. Try manual brushing.');
    }
  }, 150);
}

function detectWatermarkMask(imgData, detectText, detectLogo) {
  const width = imgData.width;
  const height = imgData.height;
  const src = imgData.data;
  
  const mask = new Uint8Array(width * height);
  const edges = new Float32Array(width * height);
  const grayscale = new Uint8Array(width * height);
  
  // Grayscale conversion
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    grayscale[i] = Math.round(0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2]);
  }
  
  // Sobel Edge Filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      const val00 = grayscale[(y - 1) * width + (x - 1)];
      const val01 = grayscale[(y - 1) * width + x];
      const val02 = grayscale[(y - 1) * width + (x + 1)];
      
      const val10 = grayscale[y * width + (x - 1)];
      const val12 = grayscale[y * width + (x + 1)];
      
      const val20 = grayscale[(y + 1) * width + (x - 1)];
      const val21 = grayscale[(y + 1) * width + x];
      const val22 = grayscale[(y + 1) * width + (x + 1)];
      
      const gx = (val02 + 2 * val12 + val22) - (val00 + 2 * val10 + val20);
      const gy = (val20 + 2 * val21 + val22) - (val00 + 2 * val01 + val02);
      
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  
  // Block-based density & contrast analysis (16x16 blocks)
  const blockSize = 16;
  const blocksW = Math.ceil(width / blockSize);
  const blocksH = Math.ceil(height / blockSize);
  
  const blockStats = [];
  for (let by = 0; by < blocksH; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      let edgeSum = 0;
      let edgeCount = 0;
      let valSum = 0;
      let minVal = 255;
      let maxVal = 0;
      
      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX = Math.min(width, startX + blockSize);
      const endY = Math.min(height, startY + blockSize);
      const count = (endX - startX) * (endY - startY);
      
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const offset = y * width + x;
          edgeSum += edges[offset];
          if (edges[offset] > 35) edgeCount++;
          const val = grayscale[offset];
          valSum += val;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
      }
      
      blockStats.push({
        bx, by,
        edgeDensity: edgeCount / count,
        contrast: maxVal - minVal,
        isText: false,
        isLogo: false
      });
    }
  }
  
  // Calculate threshold averages
  let totalContrast = 0;
  let totalDensity = 0;
  for (let i = 0; i < blockStats.length; i++) {
    totalContrast += blockStats[i].contrast;
    totalDensity += blockStats[i].edgeDensity;
  }
  const avgContrast = totalContrast / blockStats.length;
  const avgDensity = totalDensity / blockStats.length;
  
  // Mark candidate blocks
  for (let i = 0; i < blockStats.length; i++) {
    const b = blockStats[i];
    
    // Watermarks stand out from global averages
    const isHighContrast = b.contrast > Math.max(30, avgContrast * 1.4);
    const isHighDensity = b.edgeDensity > Math.max(0.04, avgDensity * 1.5);
    
    if (isHighContrast && isHighDensity) {
      if (detectText && b.edgeDensity > 0.06) {
        b.isText = true;
      }
      if (detectLogo && b.contrast > 45) {
        b.isLogo = true;
      }
    }
  }
  
  // Filter noise using connected component clustering (BFS)
  const visited = new Uint8Array(blocksW * blocksH);
  
  for (let by = 0; by < blocksH; by++) {
    for (let bx = 0; bx < blocksW; bx++) {
      const idx = by * blocksW + bx;
      const b = blockStats[idx];
      
      if (visited[idx] === 0 && (b.isText || b.isLogo)) {
        const cluster = [];
        const queue = [{ x: bx, y: by }];
        visited[idx] = 1;
        
        while (queue.length > 0) {
          const curr = queue.shift();
          const currIdx = curr.y * blocksW + curr.x;
          cluster.push(blockStats[currIdx]);
          
          // Check 4 neighbors
          const neighbors = [];
          if (curr.x > 0) neighbors.push({ x: curr.x - 1, y: curr.y });
          if (curr.x < blocksW - 1) neighbors.push({ x: curr.x + 1, y: curr.y });
          if (curr.y > 0) neighbors.push({ x: curr.x, y: curr.y - 1 });
          if (curr.y < blocksH - 1) neighbors.push({ x: curr.x, y: curr.y + 1 });
          
          for (let n of neighbors) {
            const nIdx = n.y * blocksW + n.x;
            const nb = blockStats[nIdx];
            if (visited[nIdx] === 0 && (nb.isText || nb.isLogo)) {
              visited[nIdx] = 1;
              queue.push(n);
            }
          }
        }
        
        // Watermarks span at least 2 connected blocks
        if (cluster.length >= 2) {
          for (let cb of cluster) {
            const startX = cb.bx * blockSize;
            const startY = cb.by * blockSize;
            const endX = Math.min(width, startX + blockSize);
            const endY = Math.min(height, startY + blockSize);
            
            for (let my = startY; my < endY; my++) {
              for (let mx = startX; mx < endX; mx++) {
                mask[my * width + mx] = 1;
              }
            }
          }
        }
      }
    }
  }
  
  // Dilation (5px) to ensure complete cover of antialiased edges
  const dilatedMask = new Uint8Array(width * height);
  const r = 5;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              dilatedMask[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }
  
  return dilatedMask;
}

// Simple dynamic Toast notification
function showToastNotification(message, duration = 3500) {
  let toastContainer = document.getElementById('toast-notification-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-notification-container';
    toastContainer.style = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; font-family: "Inter", sans-serif; pointer-events: none;';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.style = 'background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); color: #ffffff; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); transform: translateY(20px); opacity: 0; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-width: 320px; pointer-events: auto;';
  toast.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-circle-info" style="color:var(--accent-primary);"></i> <span>${message}</span></div>`;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/* ==========================================================================
   Tool 3: Watermark Maker Panel
   ========================================================================== */
function initWMMakerHandlers() {
  // Source Toggle (Text vs Image Logo)
  elements.wmSourceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-wm-source');
      state.wmSource = src;
      
      elements.wmSourceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle settings grids
      elements.wmTextConfig.classList.add('hidden');
      elements.wmImageConfig.classList.add('hidden');
      
      if (src === 'text') {
        elements.wmTextConfig.classList.remove('hidden');
      } else {
        elements.wmImageConfig.classList.remove('hidden');
      }
      
      renderWMMakerCanvas();
    });
  });
  
  // Watermark text change
  elements.wmText.addEventListener('input', (e) => {
    state.wmText = e.target.value;
    renderWMMakerCanvas();
  });
  
  // Font Family selector
  elements.wmFont.addEventListener('change', (e) => {
    state.wmFont = e.target.value;
    renderWMMakerCanvas();
  });
  
  // Font Color picker
  elements.wmTextColor.addEventListener('input', (e) => {
    state.wmTextColor = e.target.value;
    elements.wmTextColorHex.innerText = e.target.value;
    renderWMMakerCanvas();
  });
  
  // Image Logo Upload
  elements.btnUploadWMLogo.addEventListener('click', () => {
    elements.wmLogoInput.click();
  });
  
  elements.wmLogoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          state.wmLogoImage = img;
          elements.wmLogoPreview.src = ev.target.result;
          elements.wmLogoPreviewContainer.classList.remove('hidden');
          renderWMMakerCanvas();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  elements.btnClearWMLogo.addEventListener('click', () => {
    state.wmLogoImage = null;
    elements.wmLogoInput.value = '';
    elements.wmLogoPreviewContainer.classList.add('hidden');
    renderWMMakerCanvas();
  });
  
  // Watermark Layout Toggle (Tiled vs Single)
  elements.wmLayoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-wm-layout');
      state.wmLayout = layout;
      
      elements.wmLayoutBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (layout === 'single') {
        elements.wmSinglePositionGroup.classList.remove('hidden');
      } else {
        elements.wmSinglePositionGroup.classList.add('hidden');
      }
      
      renderWMMakerCanvas();
    });
  });
  
  // Position dropdown for single layout
  elements.wmPosition.addEventListener('change', (e) => {
    state.wmPosition = e.target.value;
    renderWMMakerCanvas();
  });
  
  // Size Scale slider
  elements.wmSizeSlider.addEventListener('input', (e) => {
    state.wmScale = parseInt(e.target.value);
    elements.wmSizeVal.innerText = state.wmScale;
    renderWMMakerCanvas();
  });
  
  // Opacity slider
  elements.wmOpacitySlider.addEventListener('input', (e) => {
    state.wmOpacity = parseFloat(e.target.value) / 10;
    elements.wmOpacityVal.innerText = state.wmOpacity;
    renderWMMakerCanvas();
  });
  
  // Rotation slider
  elements.wmRotationSlider.addEventListener('input', (e) => {
    state.wmRotation = parseInt(e.target.value);
    elements.wmRotationVal.innerText = `${state.wmRotation}°`;
    renderWMMakerCanvas();
  });
}

// Render Watermarks on Canvas Overlay
function renderWMMakerCanvas() {
  if (!state.transparentImage) return;
  
  const canvas = elements.wmMakerCanvas;
  const ctx = canvas.getContext('2d');
  
  // Set dimensions matching currently processed background image size
  const w = state.processedImage ? state.processedImage.width : state.transparentImage.width;
  const h = state.processedImage ? state.processedImage.height : state.transparentImage.height;
  
  canvas.width = w;
  canvas.height = h;

  // Layout box = the image's natural pixel size (explicit px, not a %
  // max-height, to avoid relying on this canvas's flex ancestors having a
  // definite height -- same technique Watermark Remover already uses for
  // its base/brush canvases). Visual fit/zoom is then purely a
  // transform:scale(state.zoom) on top, applied by applyZoomPan(); see
  // fitWMMakerCanvasToView() for the "fit to container" step, called on tab
  // switch / initial load / resize -- not on every render, so live edits
  // (text, opacity, position, etc.) don't reset the user's current zoom/pan.
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  // Draw base image contents (BG removal layout output)
  if (state.processedImage) {
    ctx.drawImage(state.processedImage, 0, 0);
  } else {
    ctx.drawImage(state.transparentImage, 0, 0);
  }
  
  // Apply Watermark overlay drawing
  ctx.save();
  ctx.globalAlpha = state.wmOpacity;
  
  if (state.wmSource === 'text') {
    // Configure typography settings
    // Font size relative to width scale (default 30px on 1000px width)
    const relativeFontSize = (state.wmScale / 1000) * w;
    ctx.font = `${relativeFontSize}px '${state.wmFont}', sans-serif`;
    ctx.fillStyle = state.wmTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textWidth = ctx.measureText(state.wmText).width;
    
    if (state.wmLayout === 'grid') {
      // Tiled Repeater Pattern
      // Space between tiles based on size scale
      const stepX = textWidth * 2.2;
      const stepY = relativeFontSize * 4.5;
      
      for (let y = -stepY; y < h + stepY * 2; y += stepY) {
        for (let x = -stepX; x < w + stepX * 2; x += stepX) {
          ctx.save();
          // Translate to center of tile cell
          ctx.translate(x, y);
          ctx.rotate((state.wmRotation * Math.PI) / 180);
          ctx.fillText(state.wmText, 0, 0);
          ctx.restore();
        }
      }
    } else {
      // Single Badge Placement
      const pos = getSinglePositionCoords(w, h, textWidth, relativeFontSize);
      ctx.translate(pos.x, pos.y);
      ctx.rotate((state.wmRotation * Math.PI) / 180);
      ctx.fillText(state.wmText, 0, 0);
    }
    
  } else if (state.wmSource === 'image' && state.wmLogoImage) {
    // Watermark Logo Image scaling
    const logo = state.wmLogoImage;
    const logoAspectRatio = logo.width / logo.height;
    
    // Scale width relative to main canvas width
    const logoWidth = (state.wmScale / 1000) * w * 3; 
    const logoHeight = logoWidth / logoAspectRatio;
    
    if (state.wmLayout === 'grid') {
      const stepX = logoWidth * 2.5;
      const stepY = logoHeight * 2.5;
      
      for (let y = -stepY; y < h + stepY * 2; y += stepY) {
        for (let x = -stepX; x < w + stepX * 2; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((state.wmRotation * Math.PI) / 180);
          ctx.drawImage(logo, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
          ctx.restore();
        }
      }
    } else {
      const pos = getSinglePositionCoords(w, h, logoWidth, logoHeight);
      ctx.translate(pos.x, pos.y);
      ctx.rotate((state.wmRotation * Math.PI) / 180);
      ctx.drawImage(logo, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
    }
  }
  
  ctx.restore();
}

// Scale + center the Watermark Maker canvas to fit inside the visible
// viewport. Mirrors fitBGRemoverCanvasToView so all 3 editor tools land on
// the same, consistent zoom level on tab switch / initial load / resize.
function fitWMMakerCanvasToView() {
  if (!state.transparentImage) return;

  const canvas = elements.wmMakerCanvas;
  const w = state.processedImage ? state.processedImage.width : state.transparentImage.width;
  const h = state.processedImage ? state.processedImage.height : state.transparentImage.height;

  const container = canvas.closest('.canvas-box') || canvas.parentElement;
  state.zoom = computeFitZoom(container, w, h);
  state.panX = 0;
  state.panY = 0;
  applyZoomPan();
}

// Calculate absolute position mapping helper for Single Watermarks
function getSinglePositionCoords(w, h, objW, objH) {
  // Margin distance from edges (e.g. 5% of dimensions)
  const marginX = w * 0.05;
  const marginY = h * 0.05;
  
  switch (state.wmPosition) {
    case 'center':
      return { x: w / 2, y: h / 2 };
    case 'top-left':
      return { x: marginX + objW / 2, y: marginY + objH / 2 };
    case 'top-right':
      return { x: w - marginX - objW / 2, y: marginY + objH / 2 };
    case 'bottom-left':
      return { x: marginX + objW / 2, y: h - marginY - objH / 2 };
    case 'bottom-right':
    default:
      return { x: w - marginX - objW / 2, y: h - marginY - objH / 2 };
  }
}

/* ==========================================================================
   Resizer Exporter and Resolution Limits
   ========================================================================== */
function initResizerHandlers() {
  // Resolution Preset Picker
  elements.resolutionPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    state.exportPreset = val;
    
    // Check if free user is trying to select PRO sizes
    if (!state.isPro && val !== 'medium') {
      // Force change value back to free preview
      elements.resolutionPreset.value = 'medium';
      state.exportPreset = 'medium';
      
      // Open Upgrade Dialog
      elements.checkoutSuccessScreen.classList.add('hidden');
      elements.checkoutForm.classList.remove('hidden');
      elements.checkoutModal.showModal();
      return;
    }
    
    // Toggle custom panels
    if (val === 'custom') {
      elements.customResolutionPanel.classList.remove('hidden');
    } else {
      elements.customResolutionPanel.classList.add('hidden');
      updateResolutionDimensionsByPreset(val);
    }
  });
  
  // Custom Resolution input changes
  elements.customWidth.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (isNaN(val) || val < 10) return;
    
    state.exportWidth = val;
    if (state.aspectRatioLocked && state.originalImage) {
      state.exportHeight = Math.round(val / state.originalAspectRatio);
      elements.customHeight.value = state.exportHeight;
    }
  });
  
  elements.customHeight.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (isNaN(val) || val < 10) return;
    
    state.exportHeight = val;
    if (state.aspectRatioLocked && state.originalImage) {
      state.exportWidth = Math.round(val * state.originalAspectRatio);
      elements.customWidth.value = state.exportWidth;
    }
  });
  
  // Aspect Ratio Lock Toggle button
  elements.aspectRatioLock.addEventListener('click', () => {
    state.aspectRatioLocked = !state.aspectRatioLocked;
    
    if (state.aspectRatioLocked) {
      elements.aspectRatioLock.classList.add('active');
      // Force recalculation of height matching ratio
      state.exportHeight = Math.round(state.exportWidth / state.originalAspectRatio);
      elements.customHeight.value = state.exportHeight;
    } else {
      elements.aspectRatioLock.classList.remove('active');
    }
  });
  
  // Trigger main download event
  elements.btnDownloadImage.addEventListener('click', () => {
    triggerImageDownload();
  });
}

function updateResolutionDimensionsByPreset(preset) {
  if (!state.originalImage) return;
  
  const w = state.originalImage.width;
  const h = state.originalImage.height;
  
  switch (preset) {
    case 'medium': // Capped at max 800px width/height (Free)
      if (w > h) {
        state.exportWidth = Math.min(800, w);
        state.exportHeight = Math.round(state.exportWidth / state.originalAspectRatio);
      } else {
        state.exportHeight = Math.min(800, h);
        state.exportWidth = Math.round(state.exportHeight * state.originalAspectRatio);
      }
      break;
    case 'full': // Original resolution
      state.exportWidth = w;
      state.exportHeight = h;
      break;
    case 'square': // 500x500 square cropping
      state.exportWidth = 500;
      state.exportHeight = 500;
      break;
    case 'banner': // 1000x500 banner landscape
      state.exportWidth = 1000;
      state.exportHeight = 500;
      break;
    case 'story': // 500x1000 story portrait
      state.exportWidth = 500;
      state.exportHeight = 1000;
      break;
  }
}

/**
 * Exports a canvas to a Blob.
 * @param {HTMLCanvasElement} sourceCanvas - the canvas holding the final image
 * @param {string} format - 'image/png' | 'image/jpeg' | 'image/webp'
 * @param {string} bgColor - background color for JPEG (default white)
 * @param {number} quality - 0..1 (used by jpeg/webp)
 */
function exportCanvasToBlob(sourceCanvas, format, bgColor = '#FFFFFF', quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (!sourceCanvas || sourceCanvas.width === 0 || sourceCanvas.height === 0) {
      reject(new Error('Export canvas is empty (width/height = 0).'));
      return;
    }

    let canvasToExport = sourceCanvas;

    // JPEG cannot store transparency -> transparent pixels become BLACK.
    // Fix: flatten onto an opaque background first.
    if (format === 'image/jpeg') {
      const flat = document.createElement('canvas');
      flat.width = sourceCanvas.width;
      flat.height = sourceCanvas.height;
      const ctx = flat.getContext('2d');
      ctx.fillStyle = bgColor;                 // opaque background
      ctx.fillRect(0, 0, flat.width, flat.height);
      ctx.drawImage(sourceCanvas, 0, 0);       // image on top
      canvasToExport = flat;
    }

    canvasToExport.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('toBlob returned null — canvas may be tainted (CORS) or too large.'));
        } else {
          resolve(blob);
        }
      },
      format,
      quality
    );
  });
}

// Master Canvas Compiler Exporter
const EDITOR_TOOL_LABELS = {
  'bg-remover': 'Background Eraser',
  'wm-remover': 'Watermark Remover',
  'wm-maker': 'Watermark Maker'
};

// Records a "My Projects" history entry for this export. Best-effort: if
// ProjectHistory (project-history.js) isn't loaded or IndexedDB fails, the
// download itself must not be affected, so failures are swallowed silently.
function recordEditorProjectHistory(sourceCanvas, filename, blob) {
  if (!window.ProjectHistory) return;
  try {
    const thumbCanvas = document.createElement('canvas');
    const maxSize = 200;
    const scale = Math.min(1, maxSize / Math.max(sourceCanvas.width, sourceCanvas.height));
    thumbCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    thumbCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    thumbCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

    window.ProjectHistory.record({
      type: 'editor',
      tool: state.activeTab,
      toolLabel: EDITOR_TOOL_LABELS[state.activeTab] || 'Editor',
      filename: filename,
      thumbnail: thumbnail,
      blob: blob
    });
  } catch (e) {
    console.warn('Failed to record project history', e);
  }
}

function triggerImageDownload() {
  if (!state.originalImage) return;
  
  // Double check user subscription tier limits before export
  if (!state.isPro && state.exportPreset !== 'medium') {
    elements.checkoutSuccessScreen.classList.add('hidden');
    elements.checkoutForm.classList.remove('hidden');
    elements.checkoutModal.showModal();
    return;
  }
  
  // Configure final canvas layout resolution sizes
  const exportCanvas = document.createElement('canvas');
  const w = state.exportWidth;
  const h = state.exportHeight;
  exportCanvas.width = w;
  exportCanvas.height = h;
  const ctx = exportCanvas.getContext('2d');
  
  // Draw base image source canvas content dynamically downscaled/upscaled to export sizes
  let sourceCanvas;
  if (state.activeTab === 'bg-remover') {
    sourceCanvas = elements.bgRemoverCanvas;
  } else if (state.activeTab === 'wm-remover') {
    sourceCanvas = elements.wmRemoverBaseCanvas;
  } else if (state.activeTab === 'wm-maker') {
    sourceCanvas = elements.wmMakerCanvas;
  }
  
  if (!sourceCanvas) return;
  
  // Check if we require special cropping for layout shifts (e.g. forced square/story bounds)
  if (state.exportPreset === 'square' || state.exportPreset === 'banner' || state.exportPreset === 'story') {
    // Cover scale drawing (centers and crops excess edges of source to match output canvas aspect ratio)
    const srcRatio = sourceCanvas.width / sourceCanvas.height;
    const destRatio = w / h;
    let sx = 0, sy = 0, sWidth = sourceCanvas.width, sHeight = sourceCanvas.height;
    
    if (srcRatio > destRatio) {
      sWidth = sourceCanvas.height * destRatio;
      sx = (sourceCanvas.width - sWidth) / 2;
    } else {
      sHeight = sourceCanvas.width / destRatio;
      sy = (sourceCanvas.height - sHeight) / 2;
    }
    
    ctx.drawImage(sourceCanvas, sx, sy, sWidth, sHeight, 0, 0, w, h);
  } else {
    // Normal scale to full dimension
    ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, w, h);
  }
  
  // Apply CMYK Gamut Mapping if Print-Ready CMYK is selected
  const chosenColorSpace = elements.exportColorSpace ? elements.exportColorSpace.value : 'rgb';
  if (chosenColorSpace === 'cmyk') {
    applyCMYKPrintGamutMapping(exportCanvas);
  }
  
  // Read export format preset
  const chosenFormat = elements.exportFormat ? elements.exportFormat.value : 'png';
  
  if (chosenFormat === 'pdf') {
    // PDF Export format
    const dataURL = exportCanvas.toDataURL('image/png');
    
    // Determine orientation based on canvas bounds
    const orientation = w > h ? 'l' : 'p';
    
    // Import jsPDF
    const { jsPDF } = window.jspdf;
    const pdfDoc = new jsPDF({
      orientation: orientation,
      unit: 'px',
      format: [w, h]
    });
    
    pdfDoc.addImage(dataURL, 'PNG', 0, 0, w, h);
    const pdfFilename = `${state.originalFilename}_processed_${w}x${h}.pdf`;
    pdfDoc.save(pdfFilename);
    recordEditorProjectHistory(exportCanvas, pdfFilename, pdfDoc.output('blob'));
  } else {
    // Normal Image export formats
    let mimeType = 'image/png';
    let fileExt = 'png';
    
    if (chosenFormat === 'jpg') {
      mimeType = 'image/jpeg';
      fileExt = 'jpg';
    } else if (chosenFormat === 'webp') {
      mimeType = 'image/webp';
      fileExt = 'webp';
    }
    
    // Default to white background, or use background color if active
    let bg = '#FFFFFF';
    if (state.activeTab === 'bg-remover' && state.bgType === 'color' && state.bgColor) {
      bg = state.bgColor;
    }
    
    exportCanvasToBlob(exportCanvas, mimeType, bg, 0.92)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const imgFilename = `${state.originalFilename}_processed_${w}x${h}.${fileExt}`;
        link.download = imgFilename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        recordEditorProjectHistory(exportCanvas, imgFilename, blob);
      })
      .catch((err) => {
        console.error(err);
        alert('Download failed: ' + err.message);
      });
  }
}

/* ==========================================================================
   Billing Checkout Modal (Stripe Checkout Mock)
   ========================================================================== */
function initCheckoutHandlers() {
  // Go Pro header link
  elements.headerUpgradeBtn.addEventListener('click', () => {
    elements.checkoutSuccessScreen.classList.add('hidden');
    elements.checkoutForm.classList.remove('hidden');
    elements.checkoutModal.showModal();
  });
  
  // Manage Sub link (Unsub simulation)
  elements.headerManageBtn.addEventListener('click', () => {
    const cancel = confirm('Cancel premium subscription? (This will restore Free limits)');
    if (cancel) {
      localStorage.setItem('eraser_pro_subscribed', 'false');
      state.isPro = false;
      updateSubUI();
    }
  });
  
  // Close Checkout Modal
  elements.closeCheckoutBtn.addEventListener('click', () => {
    elements.checkoutModal.close();
  });
  
  // Fallback for browsers without closedby support
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    elements.checkoutModal.addEventListener('click', (event) => {
      if (event.target !== elements.checkoutModal) return;
      
      const rect = elements.checkoutModal.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isDialogContent) {
        elements.checkoutModal.close();
      }
    });
  }
  
  // Success dismissal button
  elements.btnDismissSuccess.addEventListener('click', () => {
    elements.checkoutModal.close();
  });
}

/* ==========================================================================
   Recent Images History Bar Logic
   ========================================================================== */
function updateHistoryUI() {
  const historyBar = document.getElementById('historyBar');
  const historyList = document.getElementById('historyList');
  if (!historyBar || !historyList) return;
  
  if (state.history.length === 0) {
    historyBar.classList.add('hidden');
    return;
  }
  
  // Show history bar in the editor workspace
  if (elements.editorWorkspace.classList.contains('active')) {
    historyBar.classList.remove('hidden');
  } else {
    historyBar.classList.add('hidden');
  }
  
  historyList.innerHTML = '';
  
  // Render history items (newest first)
  state.history.slice().reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = `history-item ${item.id === state.currentHistoryId ? 'active' : ''}`;
    div.title = item.filename;
    
    const bg = document.createElement('div');
    bg.className = 'history-item-bg';
    
    const img = document.createElement('img');
    // Show transparent cutout if background is removed, otherwise show original
    img.src = item.transparentImage ? item.transparentImage.src : item.originalImage.src;
    
    bg.appendChild(img);
    div.appendChild(bg);
    
    div.addEventListener('click', () => {
      loadHistoryItem(item.id);
    });
    
    historyList.appendChild(div);
  });
}

function loadHistoryItem(id) {
  const item = state.history.find(h => h.id === id);
  if (!item) return;
  
  state.currentHistoryId = item.id;
  state.originalImage = item.originalImage;
  state.transparentImage = item.transparentImage;
  state.eraserBaseImage = item.eraserBaseImage;
  state.bgRemoved = item.bgRemoved;
  state.originalFilename = item.filename;
  state.originalAspectRatio = item.aspectRatio;
  
  // Update Before image source
  elements.imgBefore.src = item.originalImage.src;
  
  // Set export dimensions
  state.exportWidth = item.originalImage.width;
  state.exportHeight = item.originalImage.height;
  elements.customWidth.value = item.originalImage.width;
  elements.customHeight.value = item.originalImage.height;
  
  // Clear brush drawing overlays
  state.brushStrokes = [];
  state.appliedStrokes = [];
  state.redoStrokes = [];
  wmHistory.clear();
  
  // Reset view modes to show removed background
  setViewMode('removed');
  
  // Restore correct tab
  switchTab(state.activeTab);
  updateHistoryUI();
}

/* ==========================================================================
   PDF Support Integration
   ========================================================================== */
async function loadPdfFile(file) {
  showGlobalLoader('Loading PDF...', 'Reading document data...');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      state.pdfDocument = pdf;
      state.pdfTotalPages = pdf.numPages;
      state.pdfCurrentPage = 1;
      state.pdfFilename = state.originalFilename;
      
      hideGlobalLoader();
      
      if (pdf.numPages > 1) {
        elements.pdfTotalPages.innerText = pdf.numPages;
        elements.pdfCurrentPageDisplay.innerText = 1;
        elements.pdfPageModal.showModal();
      } else {
        loadAndRenderPdfPage(1);
      }
    } catch (err) {
      console.error('Failed to parse PDF file:', err);
      hideGlobalLoader();
      alert('Error loading PDF: ' + err.message);
    }
  };
  reader.onerror = () => {
    hideGlobalLoader();
    alert('Failed to read PDF file.');
  };
  reader.readAsArrayBuffer(file);
}

async function loadAndRenderPdfPage(pageNumber) {
  if (!state.pdfDocument) return;
  
  showGlobalLoader('Rendering PDF page...', `Processing page ${pageNumber} of ${state.pdfTotalPages}...`);
  
  try {
    const page = await state.pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 }); // High-quality rendering scale
    
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    const imgUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => {
      state.originalFilename = `${state.pdfFilename}_page_${pageNumber}`;
      processUploadedImage(img);
      hideGlobalLoader();
      if (elements.pdfPageModal && elements.pdfPageModal.open) {
        elements.pdfPageModal.close();
      }
    };
    img.onerror = () => {
      hideGlobalLoader();
      alert('Failed to load rendered PDF page.');
    };
    img.src = imgUrl;
  } catch (err) {
    console.error('PDF rendering failed:', err);
    hideGlobalLoader();
    alert('Failed to render PDF page: ' + err.message);
  }
}

function initPdfModalHandlers() {
  if (!elements.pdfPageModal) return;
  
  elements.closePdfModalBtn.addEventListener('click', () => {
    elements.pdfPageModal.close();
  });
  
  elements.btnPrevPdfPage.addEventListener('click', () => {
    if (state.pdfCurrentPage > 1) {
      state.pdfCurrentPage--;
      elements.pdfCurrentPageDisplay.innerText = state.pdfCurrentPage;
    }
  });
  
  elements.btnNextPdfPage.addEventListener('click', () => {
    if (state.pdfCurrentPage < state.pdfTotalPages) {
      state.pdfCurrentPage++;
      elements.pdfCurrentPageDisplay.innerText = state.pdfCurrentPage;
    }
  });
  
  elements.btnConfirmPdfPage.addEventListener('click', () => {
    loadAndRenderPdfPage(state.pdfCurrentPage);
  });
}

/* ==========================================================================
   CMYK Gamut Mapping / Print-Safe Color Converter
   ========================================================================== */
function applyCMYKPrintGamutMapping(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Convert to HSL
    let [h, s, l] = rgbToHsl(r, g, b);
    
    // CMYK Gamut Mapping: Compress out-of-gamut neon colors to print-safe ranges
    if (s > 0.70) {
      s = 0.70 + (s - 0.70) * 0.35; // compress high saturation
    }
    
    // Convert back to RGB
    const [nr, ng, nb] = hslToRgb(h, s, l);
    data[i] = nr;
    data[i+1] = ng;
    data[i+2] = nb;
  }
  
  ctx.putImageData(imgData, 0, 0);
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/* ==========================================================================
   PDF Tools Hub Logic
   ========================================================================== */

function initPdfHubHandlers() {
  if (!elements.navModeStudio || !elements.navModePdf) return;

  // Mode Switcher between Studio and PDF Tools Hub
  elements.navModeStudio.addEventListener('click', () => {
    elements.navModeStudio.classList.add('active');
    elements.navModePdf.classList.remove('active');
    
    // Hide PDF pages
    elements.pdfToolsLanding.classList.remove('active');
    elements.pdfEditorWorkspace.classList.remove('active');
    
    // Show AI Image Studio page
    if (state.originalImage) {
      elements.editorWorkspace.classList.add('active');
    } else {
      elements.uploadLanding.classList.add('active');
    }
  });

  elements.navModePdf.addEventListener('click', () => {
    elements.navModePdf.classList.add('active');
    elements.navModeStudio.classList.remove('active');
    
    // Hide AI Image Studio page
    elements.uploadLanding.classList.remove('active');
    elements.editorWorkspace.classList.remove('active');
    
    // Show PDF pages
    if (state.activePdfTool) {
      elements.pdfEditorWorkspace.classList.add('active');
    } else {
      elements.pdfToolsLanding.classList.add('active');
    }
  });

  // Clicking cards in landing grid
  elements.pdfToolCards.forEach(card => {
    card.addEventListener('click', () => {
      const tool = card.getAttribute('data-pdf-tool');
      state.activePdfTool = tool;
      
      // Update UI title and configure uploader
      let toolTitle = 'PDF Tool Settings';
      let titleText = 'Upload PDF files';
      let descText = 'or <span class="browse-link">browse PDF files</span> from your computer';
      let isMerge = (tool === 'merge');
      
      switch (tool) {
        case 'merge':
          toolTitle = 'Merge PDF Settings';
          break;
        case 'split':
          toolTitle = 'Split PDF Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'rotate':
          toolTitle = 'Rotate PDF Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'organize':
          toolTitle = 'Organize PDF Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'watermark':
          toolTitle = 'PDF Watermark Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'compress':
          toolTitle = 'Compress PDF Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'pdf-to-img':
          toolTitle = 'PDF to Image Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'pdf-to-word':
          toolTitle = 'PDF to Word Settings';
          titleText = 'Upload PDF file';
          descText = 'or <span class="browse-link">browse a PDF file</span> from your computer';
          break;
        case 'word-to-pdf':
          toolTitle = 'Word to PDF Settings';
          titleText = 'Upload Word file';
          descText = 'or <span class="browse-link">browse a Word (.docx) file</span> from your computer';
          break;
      }
      
      document.getElementById('pdfActiveToolTitle').innerText = toolTitle;
      document.getElementById('pdfHubUploadTitle').innerText = titleText;
      document.getElementById('pdfHubUploadDesc').innerHTML = descText;
      
      elements.pdfHubFileInput.multiple = isMerge;
      if (isMerge) {
        elements.btnAddPdfFile.classList.remove('hidden');
      } else {
        elements.btnAddPdfFile.classList.add('hidden');
      }
      
      const uploadLimits = document.getElementById('pdfHubUploadLimits');
      const uploadIconBox = document.getElementById('pdfHubUploadIconBox');
      const uploadIcon = document.getElementById('pdfHubUploadIcon');
      
      if (tool === 'word-to-pdf') {
        elements.pdfHubFileInput.accept = '.docx';
        if (uploadLimits) uploadLimits.innerText = 'Select a Word document (.docx). Up to 20MB.';
        if (uploadIconBox) {
          uploadIconBox.style.color = '#2563eb';
          uploadIconBox.style.background = 'rgba(37, 99, 235, 0.08)';
        }
        if (uploadIcon) {
          uploadIcon.className = 'fa-solid fa-file-word';
        }
      } else {
        elements.pdfHubFileInput.accept = '.pdf';
        if (uploadLimits) uploadLimits.innerText = isMerge ? 'Select one or more PDF documents. Up to 20MB.' : 'Select a PDF document. Up to 20MB.';
        if (uploadIconBox) {
          uploadIconBox.style.color = '#ef4444';
          uploadIconBox.style.background = 'rgba(239, 68, 68, 0.08)';
        }
        if (uploadIcon) {
          uploadIcon.className = 'fa-solid fa-file-pdf';
        }
      }
      
      // Show tool-specific config section
      elements.pdfConfigSections.forEach(section => {
        if (section.id === `pdf-config-${tool}`) {
          section.classList.add('active');
        } else {
          section.classList.remove('active');
        }
      });
      
      // Reset PDF states for the new tool
      state.pdfFiles = [];
      state.pdfPagesList = [];
      elements.pdfPagesPreviewGrid.innerHTML = '';
      
      elements.pdfDropZone.classList.remove('hidden');
      elements.pdfPagesViewport.classList.add('hidden');
      
      // Navigate to PDF Editor Workspace
      elements.pdfToolsLanding.classList.remove('active');
      elements.pdfEditorWorkspace.classList.add('active');
    });
  });

  // Back to Hub Button
  elements.btnBackToPdfHub.addEventListener('click', () => {
    state.activePdfTool = null;
    state.pdfFiles = [];
    state.pdfPagesList = [];
    elements.pdfPagesPreviewGrid.innerHTML = '';
    
    elements.pdfEditorWorkspace.classList.remove('active');
    elements.pdfToolsLanding.classList.add('active');
  });

  // File Upload Handlers (Click and Drag/Drop)
  elements.pdfDropZone.addEventListener('click', (e) => {
    if (e.target !== elements.pdfHubFileInput && !e.target.classList.contains('browse-link') && !e.target.closest('.browse-link')) {
      elements.pdfHubFileInput.click();
    }
  });
  
  const browseLink = elements.pdfDropZone.querySelector('.browse-link');
  if (browseLink) {
    browseLink.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.pdfHubFileInput.click();
    });
  }

  elements.pdfHubFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadPdfHubFiles(e.target.files);
    }
  });

  elements.pdfDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.pdfDropZone.classList.add('dragover');
  });
  
  elements.pdfDropZone.addEventListener('dragleave', () => {
    elements.pdfDropZone.classList.remove('dragover');
  });
  
  elements.pdfDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.pdfDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      loadPdfHubFiles(e.dataTransfer.files);
    }
  });

  // Split PDF Mode buttons toggles
  if (elements.pdfSplitModeGroup) {
    const splitBtns = elements.pdfSplitModeGroup.querySelectorAll('.btn-toggle');
    splitBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        splitBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.pdfSplitMode = btn.getAttribute('data-split-mode');
        
        if (state.pdfSplitMode === 'range') {
          elements.pdfSplitRangePanel.classList.remove('hidden');
        } else {
          elements.pdfSplitRangePanel.classList.add('hidden');
        }
      });
    });
  }

  // Compression Mode buttons toggles
  if (elements.pdfCompressModeGroup) {
    const compressBtns = elements.pdfCompressModeGroup.querySelectorAll('.btn-toggle');
    compressBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        compressBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.pdfCompressLevel = btn.getAttribute('data-compress-level');
      });
    });
  }

  // Rotate All CW Button
  if (elements.btnRotateAllCw) {
    elements.btnRotateAllCw.addEventListener('click', () => {
      state.pdfPagesList.forEach(p => {
        if (!p.deleted) {
          p.rotation = (p.rotation + 90) % 360;
        }
      });
      renderPdfPagesGrid();
    });
  }

  // Execute PDF Tool Trigger
  elements.btnExecutePdfTool.addEventListener('click', () => {
    executePdfTool();
  });
}

async function loadPdfHubFiles(files) {
  let filesArray;
  if (state.activePdfTool === 'word-to-pdf') {
    filesArray = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.docx'));
    if (filesArray.length === 0) {
      alert('Please select valid Word (.docx) files.');
      return;
    }
  } else {
    filesArray = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (filesArray.length === 0) {
      alert('Please select valid PDF files.');
      return;
    }
  }

  const filesToLoad = state.activePdfTool === 'merge' ? filesArray : [filesArray[0]];
  showGlobalLoader('Loading file...', `Parsing document data...`);

  try {
    // If not merge, clear previous files/pages
    if (state.activePdfTool !== 'merge') {
      state.pdfFiles = [];
      state.pdfPagesList = [];
    }

    for (const file of filesToLoad) {
      const arrayBuffer = await new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = (e) => resolve(e.target.result);
        fileReader.onerror = () => reject(new Error('Failed to read file ' + file.name));
        fileReader.readAsArrayBuffer(file);
      });

      if (state.activePdfTool === 'word-to-pdf') {
        const mammothResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        const text = mammothResult.value;
        
        // Chunk to pages
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = '14px Arial';
        
        const paragraphs = text.split('\n');
        const lines = [];
        paragraphs.forEach(p => {
          const words = p.split(' ');
          let currentLine = '';
          words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = tempCtx.measureText(testLine);
            if (metrics.width > 420) {
              lines.push(currentLine);
              currentLine = word + ' ';
            } else {
              currentLine = testLine;
            }
          });
          lines.push(currentLine);
        });
        
        const docxPages = [];
        const linesPerPage = 28;
        for (let i = 0; i < lines.length; i += linesPerPage) {
          docxPages.push(lines.slice(i, i + linesPerPage).join('\n'));
        }
        if (docxPages.length === 0) {
          docxPages.push("Empty Document");
        }
        
        const fileIndex = state.pdfFiles.length;
        state.pdfFiles.push({
          name: file.name,
          isDocx: true,
          text: text,
          pages: docxPages
        });

        for (let i = 1; i <= docxPages.length; i++) {
          const pageId = `page-${fileIndex}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          state.pdfPagesList.push({
            id: pageId,
            fileIndex: fileIndex,
            pageNumber: i,
            rotation: 0,
            deleted: false
          });
        }
      } else {
        const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const fileIndex = state.pdfFiles.length;
        state.pdfFiles.push({
          name: file.name,
          pdfDoc: pdfLibDoc,
          pdfjsDoc: pdfjsDoc,
          arrayBuffer: arrayBuffer
        });

        const numPages = pdfjsDoc.numPages;
        for (let i = 1; i <= numPages; i++) {
          const pageId = `page-${fileIndex}-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          state.pdfPagesList.push({
            id: pageId,
            fileIndex: fileIndex,
            pageNumber: i,
            rotation: 0,
            deleted: false
          });
        }
      }
    }

    // Hide uploader drop zone, show viewport grid
    elements.pdfDropZone.classList.add('hidden');
    elements.pdfPagesViewport.classList.remove('hidden');

    // Update Split inputs max limits if Split is active
    if (state.activePdfTool === 'split' && state.pdfPagesList.length > 0) {
      const totalPages = state.pdfPagesList.filter(p => !p.deleted).length;
      elements.pdfSplitStartPage.max = totalPages;
      elements.pdfSplitStartPage.value = 1;
      elements.pdfSplitEndPage.max = totalPages;
      elements.pdfSplitEndPage.value = totalPages;
    }

    renderPdfPagesGrid();
    hideGlobalLoader();
  } catch (err) {
    console.error('Failed to load files:', err);
    hideGlobalLoader();
    alert('Error parsing document: ' + err.message);
  }
}

function renderPdfPagesGrid() {
  elements.pdfPagesPreviewGrid.innerHTML = '';
  const activePages = state.pdfPagesList.filter(p => !p.deleted);

  if (activePages.length === 0) {
    elements.pdfDropZone.classList.remove('hidden');
    elements.pdfPagesViewport.classList.add('hidden');
    state.pdfFiles = [];
    state.pdfPagesList = [];
    return;
  }

  activePages.forEach((pageObj) => {
    const card = document.createElement('div');
    card.className = 'pdf-page-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', pageObj.id);

    const canvas = document.createElement('canvas');
    card.appendChild(canvas);

    const label = document.createElement('div');
    label.className = 'page-num';
    
    const truncate = (str, n) => (str.length > n) ? str.substr(0, n-1) + '…' : str;
    label.innerText = state.activePdfTool === 'merge' 
      ? `${truncate(state.pdfFiles[pageObj.fileIndex].name, 10)} - p. ${pageObj.pageNumber}`
      : `Page ${pageObj.pageNumber}`;
    card.appendChild(label);

    // Page Actions (Rotate & Delete)
    const actions = document.createElement('div');
    actions.className = 'pdf-page-actions';

    const rotateBtn = document.createElement('button');
    rotateBtn.className = 'pdf-page-action-btn rotate-btn';
    rotateBtn.title = 'Rotate 90°';
    rotateBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pageObj.rotation = (pageObj.rotation + 90) % 360;
      renderPdfPagesGrid();
    });
    actions.appendChild(rotateBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'pdf-page-action-btn delete-btn';
    deleteBtn.title = 'Delete Page';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pageObj.deleted = true;
      
      // Update Split max limit if needed
      if (state.activePdfTool === 'split') {
        const remaining = state.pdfPagesList.filter(p => !p.deleted).length;
        if (remaining > 0) {
          elements.pdfSplitStartPage.max = remaining;
          elements.pdfSplitEndPage.max = remaining;
          if (parseInt(elements.pdfSplitEndPage.value, 10) > remaining) {
            elements.pdfSplitEndPage.value = remaining;
          }
        }
      }
      
      renderPdfPagesGrid();
    });
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    elements.pdfPagesPreviewGrid.appendChild(card);

    // Asynchronously render the thumbnail
    const fileObj = state.pdfFiles[pageObj.fileIndex];
    renderThumbnail(fileObj, pageObj.pageNumber, canvas, pageObj.rotation);

    // HTML5 Drag and Drop events for reordering
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', pageObj.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const srcId = e.dataTransfer.getData('text/plain');
      const targetId = card.getAttribute('data-id');
      
      if (srcId === targetId) return;

      const srcIndex = state.pdfPagesList.findIndex(p => p.id === srcId);
      const targetIndex = state.pdfPagesList.findIndex(p => p.id === targetId);

      if (srcIndex !== -1 && targetIndex !== -1) {
        const [movedPage] = state.pdfPagesList.splice(srcIndex, 1);
        state.pdfPagesList.splice(targetIndex, 0, movedPage);
        renderPdfPagesGrid();
      }
    });
  });
}

async function renderThumbnail(fileObj, pageNum, canvas, rotation) {
  if (fileObj.pdfjsDoc) {
    try {
      const page = await fileObj.pdfjsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.5, rotation: rotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    } catch (err) {
      console.error('Error rendering page thumbnail:', err);
    }
  } else if (fileObj.isDocx) {
    const text = fileObj.pages[pageNum - 1] || '';
    const width = 150;
    const height = 212; // A4 aspect ratio scale 0.5
    
    if (rotation === 90 || rotation === 270) {
      canvas.width = height;
      canvas.height = width;
    } else {
      canvas.width = width;
      canvas.height = height;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    
    ctx.fillStyle = '#64748b';
    const lines = text.split('\n');
    let y = 15;
    lines.slice(0, 18).forEach(line => {
      ctx.font = '5.5px Arial';
      ctx.fillText(line.substring(0, 28), 10, y);
      y += 10;
    });
    
    ctx.restore();
  }
}

async function executePdfTool() {
  const activePages = state.pdfPagesList.filter(p => !p.deleted);
  if (activePages.length === 0) {
    alert('Please upload a PDF file and ensure it has active pages.');
    return;
  }

  showGlobalLoader('Processing PDF...', 'Starting PDF assembly client-side...');

  try {
    if (state.activePdfTool === 'merge') {
      const mergedPdf = await PDFLib.PDFDocument.create();
      for (const page of activePages) {
        const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
        const [copiedPage] = await mergedPdf.copyPages(srcDoc, [page.pageNumber - 1]);
        
        // Apply rotation
        const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
        copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
        
        mergedPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await mergedPdf.save();
      downloadPdfBytes(pdfBytes, 'merged_document.pdf');
    }
    
    else if (state.activePdfTool === 'split') {
      if (state.pdfSplitMode === 'range') {
        const start = parseInt(elements.pdfSplitStartPage.value, 10);
        const end = parseInt(elements.pdfSplitEndPage.value, 10);
        
        if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > activePages.length) {
          hideGlobalLoader();
          alert('Invalid split page range.');
          return;
        }
        
        const splitPdf = await PDFLib.PDFDocument.create();
        for (let i = start; i <= end; i++) {
          const page = activePages[i - 1];
          const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
          const [copiedPage] = await splitPdf.copyPages(srcDoc, [page.pageNumber - 1]);
          
          const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
          copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
          
          splitPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await splitPdf.save();
        downloadPdfBytes(pdfBytes, `split_document_page_${start}_to_${end}.pdf`);
      } 
      else if (state.pdfSplitMode === 'extract') {
        for (let i = 0; i < activePages.length; i++) {
          const page = activePages[i];
          const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
          const singlePdf = await PDFLib.PDFDocument.create();
          
          const [copiedPage] = await singlePdf.copyPages(srcDoc, [page.pageNumber - 1]);
          const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
          copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
          
          singlePdf.addPage(copiedPage);
          
          const pdfBytes = await singlePdf.save();
          downloadPdfBytes(pdfBytes, `extracted_page_${i + 1}.pdf`);
        }
      }
    }
    
    else if (state.activePdfTool === 'rotate') {
      const rotatedPdf = await PDFLib.PDFDocument.create();
      for (const page of activePages) {
        const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
        const [copiedPage] = await rotatedPdf.copyPages(srcDoc, [page.pageNumber - 1]);
        
        const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
        copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
        
        rotatedPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await rotatedPdf.save();
      downloadPdfBytes(pdfBytes, 'rotated_document.pdf');
    }
    
    else if (state.activePdfTool === 'organize') {
      const organizedPdf = await PDFLib.PDFDocument.create();
      for (const page of activePages) {
        const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
        const [copiedPage] = await organizedPdf.copyPages(srcDoc, [page.pageNumber - 1]);
        
        const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
        copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
        
        organizedPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await organizedPdf.save();
      downloadPdfBytes(pdfBytes, 'organized_document.pdf');
    }
    
    else if (state.activePdfTool === 'watermark') {
      const text = elements.pdfWatermarkText.value || 'CONFIDENTIAL';
      const size = parseInt(elements.pdfWatermarkSize.value, 10) || 48;
      const opacity = parseFloat(elements.pdfWatermarkOpacity.value) || 0.3;
      
      const watermarkedPdf = await PDFLib.PDFDocument.create();
      const helveticaFont = await watermarkedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
      
      for (const page of activePages) {
        const srcDoc = state.pdfFiles[page.fileIndex].pdfDoc;
        const [copiedPage] = await watermarkedPdf.copyPages(srcDoc, [page.pageNumber - 1]);
        
        const currentRotation = copiedPage.getRotation() ? (copiedPage.getRotation().angle || 0) : 0;
        copiedPage.setRotation(PDFLib.degrees((currentRotation + page.rotation) % 360));
        
        const { width, height } = copiedPage.getSize();
        const textWidth = helveticaFont.widthOfTextAtSize(text, size);
        
        copiedPage.drawText(text, {
          x: (width - textWidth * Math.cos(Math.PI/6)) / 2,
          y: (height - textWidth * Math.sin(Math.PI/6)) / 2,
          size: size,
          font: helveticaFont,
          color: PDFLib.rgb(0.6, 0.6, 0.6),
          opacity: opacity,
          rotate: PDFLib.degrees(30)
        });
        
        watermarkedPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await watermarkedPdf.save();
      downloadPdfBytes(pdfBytes, 'watermarked_document.pdf');
    }
    
    else if (state.activePdfTool === 'compress') {
      const compressedPdf = await PDFLib.PDFDocument.create();
      
      let scale = 1.2;
      let quality = 0.6;
      
      if (state.pdfCompressLevel === 'extreme') {
        scale = 0.8;
        quality = 0.3;
      } else if (state.pdfCompressLevel === 'low') {
        scale = 1.8;
        quality = 0.8;
      }
      
      for (let i = 0; i < activePages.length; i++) {
        const pageObj = activePages[i];
        const fileObj = state.pdfFiles[pageObj.fileIndex];
        const page = await fileObj.pdfjsDoc.getPage(pageObj.pageNumber);
        
        const viewport = page.getViewport({ scale: scale, rotation: pageObj.rotation });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
        const embeddedImg = await compressedPdf.embedJpg(imgDataUrl);
        
        const newPage = compressedPdf.addPage([embeddedImg.width, embeddedImg.height]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height
        });
      }
      
      const pdfBytes = await compressedPdf.save();
      downloadPdfBytes(pdfBytes, 'compressed_document.pdf');
    }
    
    else if (state.activePdfTool === 'pdf-to-img') {
      const format = elements.pdfToImgFormat.value || 'jpeg';
      const resolution = parseFloat(elements.pdfToImgResolution.value) || 2.0;
      const colorSpace = elements.pdfToImgColorSpace.value || 'rgb';
      
      for (let i = 0; i < activePages.length; i++) {
        const pageObj = activePages[i];
        const fileObj = state.pdfFiles[pageObj.fileIndex];
        const page = await fileObj.pdfjsDoc.getPage(pageObj.pageNumber);
        
        const viewport = page.getViewport({ scale: resolution, rotation: pageObj.rotation });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        if (colorSpace === 'cmyk') {
          applyCMYKPrintGamutMapping(canvas);
        }
        
        const mimeType = `image/${format === 'jpeg' ? 'jpeg' : format}`;
        const imgDataUrl = canvas.toDataURL(mimeType, format === 'png' ? 1.0 : 0.9);
        
        const ext = format === 'jpeg' ? 'jpg' : format;
        const link = document.createElement('a');
        link.href = imgDataUrl;
        link.download = `page_${i + 1}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
    
    else if (state.activePdfTool === 'pdf-to-word') {
      showGlobalLoader('Converting PDF to Word...', 'Extracting text content from pages...');
      let fullHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><title>Converted PDF Document</title><style>body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }</style></head>
        <body>
      `;
      
      for (let i = 0; i < activePages.length; i++) {
        const pageObj = activePages[i];
        const fileObj = state.pdfFiles[pageObj.fileIndex];
        
        const page = await fileObj.pdfjsDoc.getPage(pageObj.pageNumber);
        const textContent = await page.getTextContent();
        
        let lastY = null;
        let pageText = '';
        
        for (const item of textContent.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 10) {
            pageText += '<br>';
          }
          pageText += item.str + ' ';
          lastY = item.transform[5];
        }
        
        fullHtml += `<div class="word-page" style="page-break-after: always; margin-bottom: 40px;">`;
        fullHtml += `<h2>Page ${i + 1}</h2>`;
        fullHtml += `<p>${pageText}</p>`;
        fullHtml += `</div>`;
      }
      
      fullHtml += `</body></html>`;
      
      const blob = new Blob([fullHtml], { type: 'application/msword' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'converted_document.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
    
    else if (state.activePdfTool === 'word-to-pdf') {
      showGlobalLoader('Converting Word to PDF...', 'Generating PDF pages...');
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
      for (let i = 0; i < activePages.length; i++) {
        const pageObj = activePages[i];
        const fileObj = state.pdfFiles[pageObj.fileIndex];
        const pageText = fileObj.pages[pageObj.pageNumber - 1] || '';
        const rotation = pageObj.rotation;
        
        if (i > 0) {
          const orientation = (rotation === 90 || rotation === 270) ? 'l' : 'p';
          doc.addPage('a4', orientation);
        } else {
          if (rotation === 90 || rotation === 270) {
            doc.deletePage(1);
            doc.addPage('a4', 'l');
          }
        }
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const maxLineWidth = pageWidth - (margin * 2);
        
        const lines = doc.splitTextToSize(pageText, maxLineWidth);
        let y = margin;
        
        lines.forEach(line => {
          if (y > pageHeight - margin) {
            doc.addPage('a4', (rotation === 90 || rotation === 270) ? 'l' : 'p');
            y = margin;
          }
          doc.text(line, margin, y);
          y += 6;
        });
      }
      
      doc.save('converted_document.pdf');
    }

    hideGlobalLoader();
  } catch (err) {
    console.error('Error executing PDF tool:', err);
    hideGlobalLoader();
    alert('Failed to process PDF: ' + err.message);
  }
}

function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
  
  // Also bind CTA button
  const btnUploadCTA = document.getElementById('btnUploadCTA');
  if (btnUploadCTA && elements.fileInput) {
      btnUploadCTA.addEventListener('click', () => elements.fileInput.click());
  }
