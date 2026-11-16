/**
 * Order form controller for imastik.
 * Handles quantity & pricing sync, reference photo dropzone,
 * napkin sketch canvas, microphone voice notes, and mailto / server submission modes.
 */

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_MAX_PHOTOS = 8;
const DEFAULT_MAX_FILE_BYTES = 15 * 1024 * 1024;
const MIN_QUANTITY = 5;
const MAX_QUANTITY = 200;
const QUANTITY_STEP = 5;

function roundCents(amount) {
  return Math.round(amount * 100) / 100;
}

export function calculateStickerPrice(quantity) {
  const parsed = Number.parseInt(quantity, 10);
  const n = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Number.isNaN(parsed) ? MIN_QUANTITY : parsed));
  if (n <= 5) return 5;
  if (n <= 10) return roundCents(5 + (n - 5) * 0.6);
  if (n <= 20) return roundCents(8 + (n - 10) * 0.7);
  return roundCents(15 + (n - 20) * 0.75);
}

function formatEuro(amount) {
  return `€${Number(amount).toFixed(2)}`;
}

export function initOrderForm({ reducedMotion = false } = {}) {
  const form = document.getElementById('orderForm');
  const qtyNum = document.getElementById('qtyNum');
  const minusBtn = document.getElementById('minus');
  const plusBtn = document.getElementById('plus');
  const totalEl = document.getElementById('total');
  const summaryLabel = document.getElementById('studioSummaryLabel');
  const summaryPrice = document.getElementById('studioSummaryPrice');
  const priceCards = document.querySelectorAll('.pricecard[data-quantity]');
  const packPills = document.querySelectorAll('.pack-pill[data-pack]');

  const progressBar = document.getElementById('studioProgressBar');
  const progressText = document.getElementById('studioProgressText');
  const nameInput = form?.querySelector('[name="name"]');
  const emailInput = form?.querySelector('[name="email"]');
  const ideaInput = form?.querySelector('[name="idea"]');

  const refsInput = document.getElementById('reference');
  const dropZone = document.getElementById('referenceDrop');
  const gallery = document.getElementById('referenceGallery');
  const fileInfo = document.getElementById('fileInfo');

  const voiceBtn = document.getElementById('voiceToggle');
  const voiceTimer = document.getElementById('voiceTimer');
  const voicePreview = document.getElementById('voicePreview');
  const voiceSave = document.getElementById('voiceSave');
  const voiceHelp = document.getElementById('voiceHelp');

  const napkinCanvas = document.getElementById('napkinCanvas');
  const sketchExpandBtn = document.getElementById('sketchExpand');
  const sketchUndoBtn = document.getElementById('sketchUndo');
  const sketchClearBtn = document.getElementById('sketchClear');
  const sketchSaveLink = document.getElementById('sketchSave');
  const penButtons = document.querySelectorAll('.pen-dot[data-pen]');

  const sketchModal = document.getElementById('sketchModal');
  const napkinCanvasFull = document.getElementById('napkinCanvasFull');
  const sketchModalRotateBtn = document.getElementById('sketchModalRotate');
  const sketchModalUndoBtn = document.getElementById('sketchModalUndo');
  const sketchModalClearBtn = document.getElementById('sketchModalClear');
  const sketchModalDoneBtn = document.getElementById('sketchModalDone');
  const penButtonsModal = document.querySelectorAll('.pen-dot-modal[data-pen]');

  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const attachmentReminder = document.getElementById('attachmentReminder');
  const paymentSteps = document.getElementById('paymentSteps');
  const storePickBanner = document.getElementById('storePickBanner');
  const storePickTitle = document.getElementById('storePickTitle');
  const storePickClear = document.getElementById('storePickClear');
  const errorBox = document.getElementById('formError');
  const resultBox = document.getElementById('orderResult');

  if (!form) return null;

  let qty = MIN_QUANTITY;
  let selectedStoreDesign = null;
  let config = {
    teamEmail: '',
    hasTeamEmail: false,
    orderMode: 'mailto',
    autoEmailEnabled: false,
    maxPhotos: DEFAULT_MAX_PHOTOS,
    maxFileSizeBytes: DEFAULT_MAX_FILE_BYTES,
  };

  // Reference photos: { file: File, url: string }
  let picked = [];

  // Voice recording state
  let recorder = null;
  let stream = null;
  let voiceParts = [];
  let voiceStart = 0;
  let voiceInterval = null;
  let voiceUrl = null;
  let voiceBlob = null;
  let voiceFilename = 'imastik-voice-note.webm';

  // Napkin sketch state
  let sketchColor = '#294b38';
  let hasSketch = false;

  function renderDirectPaymentSteps(inboxEmail) {
    if (!paymentSteps) return;
    paymentSteps.replaceChildren();
    const lead = document.createElement('strong');
    lead.textContent = 'How paying works:';
    const inbox = document.createElement('strong');
    inbox.textContent = inboxEmail || 'imastik.co@gmail.com';
    paymentSteps.append(
      lead,
      ' Submitting your idea is free — no card needed here. When you hit Send, your idea, photos, sketch, and voice note go straight to ',
      inbox,
      ', and we’ll reply with your design preview plus payment options (Revolut, bank transfer, or cash) before printing.',
    );
  }

  // --- Config fetch ---
  fetch('/api/config')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) {
        config = { ...config, teamEmail: 'imastik.co@gmail.com', hasTeamEmail: true };
        return;
      }
      config = { ...config, ...data };
      if (config.orderMode === 'server') {
        if (submitBtnText) submitBtnText.textContent = 'SEND MY ORDER';
        if (attachmentReminder) {
          attachmentReminder.textContent =
            'Your uploaded photos, napkin sketch, and voice note will be sent directly with your order.';
        }
        renderDirectPaymentSteps(config.teamEmail);
      }
    })
    .catch(() => {
      // Static-host / offline fallback uses imastik team email
      config = { ...config, teamEmail: 'imastik.co@gmail.com', hasTeamEmail: true };
    });

  // --- Quantity & pricing ---
  function setQuantity(nextQty) {
    const parsed = Number.parseInt(nextQty, 10);
    qty = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Number.isNaN(parsed) ? MIN_QUANTITY : parsed));
    const totalFormatted = formatEuro(calculateStickerPrice(qty));
    if (qtyNum) qtyNum.textContent = String(qty);
    if (totalEl) totalEl.textContent = totalFormatted;
    if (summaryLabel) {
      summaryLabel.textContent = selectedStoreDesign
        ? `1 Store design (${selectedStoreDesign.title}) · ${qty} copies`
        : `1 custom sticker design · ${qty} copies`;
    }
    if (summaryPrice) summaryPrice.textContent = totalFormatted;

    priceCards.forEach((card) => {
      const cardQty = Number.parseInt(card.dataset.quantity || '5', 10);
      const selected =
        (cardQty === 5 && qty < 10) ||
        (cardQty === 10 && qty >= 10 && qty < 20) ||
        (cardQty === 20 && qty >= 20);
      card.classList.toggle('is-selected', selected);
    });

    packPills.forEach((pill) => {
      const packQty = Number.parseInt(pill.dataset.pack || '5', 10);
      pill.classList.toggle('is-active', qty === packQty);
    });

    if (selectedStoreDesign && storePickTitle) {
      storePickTitle.textContent = `${selectedStoreDesign.title} (${qty} copies · ${totalFormatted})`;
    }
  }

  minusBtn?.addEventListener('click', () => setQuantity(qty - QUANTITY_STEP));
  plusBtn?.addEventListener('click', () => setQuantity(qty + QUANTITY_STEP));

  packPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      setQuantity(Number.parseInt(pill.dataset.pack || '5', 10));
    });
  });

  priceCards.forEach((card) => {
    const select = () => {
      setQuantity(Number.parseInt(card.dataset.quantity || '5', 10));
      document.getElementById('order')?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
      });
    };
    card.addEventListener('click', select);
  });

  setQuantity(MIN_QUANTITY);

  // --- Progress bar & idea prompt pills ---
  function refreshProgress() {
    const count =
      Number(Boolean(nameInput?.value.trim())) +
      Number(Boolean(emailInput?.value.trim())) +
      Number(Boolean(ideaInput?.value.trim()));
    if (progressBar) progressBar.style.width = `${(count / 3) * 100}%`;
    if (progressText) progressText.textContent = `${count} / 3`;
  }

  form.addEventListener('input', refreshProgress);
  form.addEventListener('change', refreshProgress);
  refreshProgress();

  document.querySelectorAll('.idea-prompt').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!ideaInput) return;
      const phrase = btn.dataset.prompt || '';
      ideaInput.value = (ideaInput.value.trim() ? `${ideaInput.value.trim()}\n` : '') + phrase;
      ideaInput.dispatchEvent(new Event('input', { bubbles: true }));
      ideaInput.focus();
      ideaInput.setSelectionRange(ideaInput.value.length, ideaInput.value.length);
    });
  });

  // --- Reference photo gallery ---
  function isValidPhoto(file) {
    return Boolean(file && VALID_IMAGE_TYPES.has(file.type) && file.size <= config.maxFileSizeBytes);
  }

  function refreshGallery(extraNotice = '') {
    if (!gallery || !fileInfo) return;
    gallery.replaceChildren();

    picked.forEach((entry, idx) => {
      const item = document.createElement('div');
      item.className = 'ref-item';

      const img = document.createElement('img');
      img.src = entry.url;
      img.alt = `Preview of ${entry.file.name}`;

      const label = document.createElement('small');
      label.textContent = entry.file.name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${entry.file.name}`);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(entry.url);
        picked.splice(idx, 1);
        refreshGallery();
      });

      item.append(img, label, remove);
      gallery.appendChild(item);
    });

    if (picked.length > 0) {
      fileInfo.textContent =
        config.orderMode === 'server'
          ? `${picked.length} image${picked.length === 1 ? '' : 's'} ready to upload with your order.`
          : `${picked.length} image${picked.length === 1 ? '' : 's'} ready. Remember to attach ${picked.length === 1 ? 'it' : 'them'} to your email draft.${extraNotice}`;
    } else {
      fileInfo.textContent = `Add any photos or inspiration — they are optional.${extraNotice}`;
    }
  }

  function addPhotos(fileList) {
    let skipped = 0;
    for (const file of fileList) {
      if (!isValidPhoto(file) || picked.length >= config.maxPhotos) {
        skipped++;
        continue;
      }
      const duplicate = picked.some(
        (x) =>
          x.file.name === file.name &&
          x.file.size === file.size &&
          x.file.lastModified === file.lastModified,
      );
      if (!duplicate) {
        picked.push({ file, url: URL.createObjectURL(file) });
      }
    }
    const notice = skipped
      ? ` (${skipped} file${skipped === 1 ? '' : 's'} skipped — JPG/PNG/WebP under 15 MB, max ${config.maxPhotos}.)`
      : '';
    refreshGallery(notice);
  }

  refsInput?.addEventListener('change', () => {
    addPhotos(Array.from(refsInput.files || []));
    refsInput.value = '';
  });

  if (dropZone) {
    ['dragenter', 'dragover'].forEach((ev) => {
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
      });
    });
    dropZone.addEventListener('drop', (e) => {
      addPhotos(Array.from(e.dataTransfer?.files || []));
    });
  }

  // --- Voice Note Recorder ---
  function stopVoiceClock() {
    clearInterval(voiceInterval);
    voiceInterval = null;
  }

  voiceBtn?.addEventListener('click', async () => {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      voiceBtn.textContent = 'Record again';
      stopVoiceClock();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (voiceHelp) {
        voiceHelp.textContent =
          'Voice recording requires Safari/Chrome on HTTPS or localhost. You can attach a phone voice memo instead.';
      }
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      voiceParts = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceParts.push(e.data);
      };

      recorder.onstop = () => {
        stopVoiceClock();
        stream?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voiceParts, { type: recorder.mimeType || 'audio/webm' });
        voiceBlob = blob;
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
        voiceFilename = `imastik-voice-note.${ext}`;
        if (voiceUrl) URL.revokeObjectURL(voiceUrl);
        voiceUrl = URL.createObjectURL(blob);
        if (voicePreview) {
          voicePreview.src = voiceUrl;
          voicePreview.hidden = false;
        }
        if (voiceSave) {
          voiceSave.href = voiceUrl;
          voiceSave.download = voiceFilename;
          voiceSave.hidden = false;
        }
        if (voiceHelp) {
          voiceHelp.textContent =
            config.orderMode === 'server'
              ? 'Voice note ready — it will upload automatically with your order.'
              : 'Voice note recorded. Click Save voice note to attach it to your email draft.';
        }
      };

      recorder.start();
      voiceStart = Date.now();
      if (voiceTimer) voiceTimer.textContent = '00:00';
      voiceInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - voiceStart) / 1000);
        if (voiceTimer) {
          voiceTimer.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
        }
      }, 500);
      voiceBtn.textContent = 'Stop recording';
      if (voiceHelp) voiceHelp.textContent = 'Recording… tap Stop when you are done.';
    } catch {
      if (voiceHelp) {
        voiceHelp.textContent =
          'Microphone permission was unavailable. Allow microphone access or record in Voice Memos instead.';
      }
      stream?.getTracks().forEach((t) => t.stop());
    }
  });

  // --- Napkin Sketch Canvas (inline + fullscreen modal) ---
  let inlineDirty = false;
  let modalHasSketch = false;
  let modalRotatedLandscape = false;
  let modalDesktopPortrait = false;
  const sketchStage = napkinCanvasFull?.closest('.sketch-modal-stage') || null;
  const isModalRotated = () => Boolean(sketchModal?.classList.contains('is-rotated'));

  function cloneDoc(sourceDoc) {
    return {
      baseW: Math.max(1, sourceDoc?.baseW || 1),
      baseH: Math.max(1, sourceDoc?.baseH || 1),
      strokes: (sourceDoc?.strokes || []).map((s) => ({
        color: s.color,
        width: s.width,
        points: (s.points || []).map((pt) => ({ x: pt.x, y: pt.y })),
      })),
    };
  }

  function getDocBounds(targetDoc) {
    let minX = 0;
    let minY = 0;
    let maxX = Math.max(1, targetDoc.baseW);
    let maxY = Math.max(1, targetDoc.baseH);
    for (const s of targetDoc.strokes) {
      const r = (s.width || 3) * 0.6;
      for (const pt of s.points) {
        if (pt.x - r < minX) minX = pt.x - r;
        if (pt.y - r < minY) minY = pt.y - r;
        if (pt.x + r > maxX) maxX = pt.x + r;
        if (pt.y + r > maxY) maxY = pt.y + r;
      }
    }
    return { minX, minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  function createSketchSurface(canvas, strokeCssWidth, { onStrokeStart, onUndo, onClear, isRotated } = {}) {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;

    const undoStack = [];
    let drawing = false;
    let activeStroke = null;
    let currentDpr = 1;
    let logicalW = Math.max(1, canvas.width || 1);
    let logicalH = Math.max(1, canvas.height || 1);
    let doc = { baseW: logicalW, baseH: logicalH, strokes: [] };
    let activeView = { scale: 1, offsetX: 0, offsetY: 0 };

    const fillBg = () => {
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const getVisualSize = () => {
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        return { w: canvas.clientWidth, h: canvas.clientHeight };
      }
      const r = canvas.getBoundingClientRect();
      return isRotated?.() ? { w: r.height, h: r.width } : { w: r.width, h: r.height };
    };

    const getScreenToLogicalRatio = () => {
      const vis = getVisualSize();
      return vis.w > 0 ? logicalW / vis.w : 1;
    };

    const computeViewTransform = () => {
      if (doc.strokes.length === 0) {
        return { scale: 1, offsetX: 0, offsetY: 0 };
      }
      const b = getDocBounds(doc);
      const scale = Math.min(logicalW / b.w, logicalH / b.h);
      const offsetX = (logicalW - b.w * scale) / 2 - b.minX * scale;
      const offsetY = (logicalH - b.h * scale) / 2 - b.minY * scale;
      return { scale, offsetX, offsetY };
    };

    const getPixelScales = () => ({
      pxX: logicalW > 0 ? canvas.width / logicalW : 1,
      pxY: logicalH > 0 ? canvas.height / logicalH : 1,
    });

    const worldToCanvas = (pt, view) => {
      const { pxX, pxY } = getPixelScales();
      return {
        x: (pt.x * view.scale + view.offsetX) * pxX,
        y: (pt.y * view.scale + view.offsetY) * pxY,
      };
    };

    const canvasToWorld = (cpt, view) => {
      const { pxX, pxY } = getPixelScales();
      const lx = pxX > 0 ? cpt.x / pxX : cpt.x;
      const ly = pxY > 0 ? cpt.y / pxY : cpt.y;
      return {
        x: view.scale > 0 ? (lx - view.offsetX) / view.scale : lx,
        y: view.scale > 0 ? (ly - view.offsetY) / view.scale : ly,
      };
    };

    const getPoint = (e) => {
      const r = canvas.getBoundingClientRect();
      if (isRotated?.()) {
        return {
          x: r.height > 0 ? ((e.clientY - r.top) * canvas.width) / r.height : 0,
          y: r.width > 0 ? ((r.right - e.clientX) * canvas.height) / r.width : 0,
        };
      }
      return {
        x: r.width > 0 ? ((e.clientX - r.left) * canvas.width) / r.width : 0,
        y: r.height > 0 ? ((e.clientY - r.top) * canvas.height) / r.height : 0,
      };
    };

    const redraw = () => {
      fillBg();
      activeView = computeViewTransform();
      if (doc.strokes.length === 0) return;
      const { pxX } = getPixelScales();
      for (const s of doc.strokes) {
        if (!s.points || s.points.length === 0) continue;
        const lineWidth = Math.max(1.25 * currentDpr, s.width * activeView.scale * pxX);
        if (s.points.length === 1) {
          const cp = worldToCanvas(s.points[0], activeView);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, lineWidth * 0.52, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        } else {
          ctx.beginPath();
          const first = worldToCanvas(s.points[0], activeView);
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < s.points.length; i++) {
            const pt = worldToCanvas(s.points[i], activeView);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = s.color;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }
      }
    };

    const pushUndo = () => {
      if (undoStack.length >= 40) undoStack.shift();
      undoStack.push({
        doc: cloneDoc(doc),
        hadSketch: hasSketch,
      });
    };

    fillBg();

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      pushUndo();
      if (doc.strokes.length === 0) {
        doc.baseW = logicalW;
        doc.baseH = logicalH;
      }
      activeView = computeViewTransform();
      drawing = true;
      hasSketch = true;
      onStrokeStart?.();

      const cPt = getPoint(e);
      const wPt = canvasToWorld(cPt, activeView);
      const logicalLineW = strokeCssWidth * getScreenToLogicalRatio();
      const worldLineW = activeView.scale > 0 ? logicalLineW / activeView.scale : logicalLineW;
      activeStroke = { color: sketchColor, width: worldLineW, points: [wPt] };
      doc.strokes.push(activeStroke);

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported on synthetic pointer events
      }
      const { pxX } = getPixelScales();
      const pixelLineW = Math.max(1.25 * currentDpr, worldLineW * activeView.scale * pxX);
      ctx.beginPath();
      ctx.arc(cPt.x, cPt.y, pixelLineW * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = sketchColor;
      ctx.fill();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!drawing || !activeStroke) return;
      e.preventDefault();
      const cPt = getPoint(e);
      const prevC = worldToCanvas(activeStroke.points[activeStroke.points.length - 1], activeView);
      activeStroke.points.push(canvasToWorld(cPt, activeView));
      const { pxX } = getPixelScales();
      const pixelLineW = Math.max(1.25 * currentDpr, activeStroke.width * activeView.scale * pxX);
      ctx.beginPath();
      ctx.moveTo(prevC.x, prevC.y);
      ctx.lineTo(cPt.x, cPt.y);
      ctx.lineWidth = pixelLineW;
      ctx.strokeStyle = activeStroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => {
      canvas.addEventListener(ev, () => {
        drawing = false;
        activeStroke = null;
      });
    });

    return {
      canvas,
      ctx,
      fillBg,
      isDrawing() {
        return drawing;
      },
      resetHistory() {
        undoStack.length = 0;
      },
      pushUndo,
      getDoc() {
        return cloneDoc(doc);
      },
      undo() {
        const snap = undoStack.pop();
        if (!snap) return;
        doc = cloneDoc(snap.doc);
        hasSketch = doc.strokes.length > 0;
        redraw();
        onUndo?.(hasSketch);
      },
      clear() {
        pushUndo();
        doc = { baseW: logicalW, baseH: logicalH, strokes: [] };
        hasSketch = false;
        activeStroke = null;
        redraw();
        onClear?.();
      },
      copyFrom(sourceSurface) {
        const sourceDoc = sourceSurface?.getDoc?.();
        if (!sourceDoc) return;
        doc = cloneDoc(sourceDoc);
        hasSketch = doc.strokes.length > 0;
        redraw();
      },
      resizeTo(cssWidth, cssHeight, dpr = 1, preserveContent = true) {
        const nextLogicalW = Math.max(1, cssWidth);
        const nextLogicalH = Math.max(1, cssHeight);
        const targetW = Math.max(1, Math.round(nextLogicalW * dpr));
        const targetH = Math.max(1, Math.round(nextLogicalH * dpr));
        if (preserveContent && targetW === canvas.width && targetH === canvas.height && currentDpr === dpr) {
          return false;
        }

        canvas.width = targetW;
        canvas.height = targetH;
        currentDpr = dpr;
        logicalW = nextLogicalW;
        logicalH = nextLogicalH;

        if (!preserveContent || !hasSketch || doc.strokes.length === 0) {
          doc = { baseW: logicalW, baseH: logicalH, strokes: [] };
          undoStack.length = 0;
          fillBg();
          activeView = computeViewTransform();
        } else {
          redraw();
        }
        return true;
      },
    };
  }

  function setPenColor(color) {
    sketchColor = color || '#294b38';
    [...penButtons, ...penButtonsModal].forEach((b) => {
      b.classList.toggle('active', b.dataset.pen === sketchColor);
    });
  }

  const inlineSurface = createSketchSurface(napkinCanvas, 3.2, {
    onStrokeStart: () => {
      inlineDirty = true;
    },
    onUndo: (restoredHadSketch) => {
      inlineDirty = true;
      if (!restoredHadSketch) modalHasSketch = false;
    },
    onClear: () => {
      inlineDirty = false;
      modalHasSketch = false;
    },
  });

  const fullSurface = createSketchSurface(napkinCanvasFull, 4, {
    isRotated: isModalRotated,
    onStrokeStart: () => {
      modalHasSketch = true;
      inlineDirty = false;
    },
    onUndo: (restoredHadSketch) => {
      modalHasSketch = restoredHadSketch;
    },
    onClear: () => {
      modalHasSketch = false;
      inlineDirty = false;
    },
  });

  function getExportCanvas() {
    if (modalHasSketch && !inlineDirty && napkinCanvasFull) {
      return napkinCanvasFull;
    }
    return napkinCanvas;
  }

  if (inlineSurface) {
    [...penButtons, ...penButtonsModal].forEach((btn) => {
      btn.addEventListener('click', () => setPenColor(btn.dataset.pen));
    });

    sketchUndoBtn?.addEventListener('click', () => inlineSurface.undo());
    sketchClearBtn?.addEventListener('click', () => inlineSurface.clear());
    sketchSaveLink?.addEventListener('click', (e) => {
      const targetCanvas = getExportCanvas();
      if (targetCanvas) e.currentTarget.href = targetCanvas.toDataURL('image/png');
    });
  }

  function applyModalOrientation() {
    if (!sketchModal) return;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const portraitViewport = vh > vw;
    const activeRotated = portraitViewport && modalRotatedLandscape;
    const activeDesktopPortrait = !portraitViewport && modalDesktopPortrait;

    if (portraitViewport) {
      sketchModal.style.setProperty('--modal-rot-w', `${vh}px`);
      sketchModal.style.setProperty('--modal-rot-h', `${vw}px`);
    } else {
      sketchModal.style.removeProperty('--modal-rot-w');
      sketchModal.style.removeProperty('--modal-rot-h');
    }

    sketchModal.classList.toggle('is-rotated', activeRotated);
    sketchStage?.classList.toggle('is-portrait-stage', activeDesktopPortrait);
    if (sketchModalRotateBtn) {
      const active = activeRotated || activeDesktopPortrait;
      sketchModalRotateBtn.classList.toggle('is-active', active);
      sketchModalRotateBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function syncFullCanvasSize({ preserve = true } = {}) {
    if (!sketchStage || !fullSurface || !sketchModal || sketchModal.classList.contains('hidden')) return;
    const cw = sketchStage.clientWidth;
    const ch = sketchStage.clientHeight;
    if (cw < 1 || ch < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fullSurface.resizeTo(cw, ch, dpr, preserve);
  }

  function closeSketchModal() {
    if (!sketchModal || sketchModal.classList.contains('hidden')) return;
    if (inlineSurface && fullSurface) {
      inlineSurface.pushUndo();
      inlineSurface.copyFrom(fullSurface);
    }
    sketchModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (sketchModal && fullSurface && inlineSurface) {
    sketchExpandBtn?.addEventListener('click', () => {
      const shouldCopyInline = !hasSketch || inlineDirty || !modalHasSketch;
      sketchModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      applyModalOrientation();
      syncFullCanvasSize({ preserve: !shouldCopyInline });
      if (shouldCopyInline) {
        fullSurface.resetHistory();
        if (hasSketch) {
          fullSurface.copyFrom(inlineSurface);
        } else {
          fullSurface.fillBg();
        }
        inlineDirty = false;
      }
    });

    sketchModalRotateBtn?.addEventListener('click', () => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = document.documentElement.clientHeight || window.innerHeight;
      if (vh > vw) {
        modalRotatedLandscape = !modalRotatedLandscape;
      } else {
        modalDesktopPortrait = !modalDesktopPortrait;
      }
      applyModalOrientation();
      syncFullCanvasSize({ preserve: true });
    });

    if (typeof ResizeObserver === 'function' && sketchStage) {
      const ro = new ResizeObserver(() => {
        if (!sketchModal.classList.contains('hidden') && !fullSurface.isDrawing()) {
          applyModalOrientation();
          syncFullCanvasSize({ preserve: true });
        }
      });
      ro.observe(sketchStage);
    }

    window.addEventListener('resize', () => {
      if (!sketchModal.classList.contains('hidden') && !fullSurface.isDrawing()) {
        applyModalOrientation();
        syncFullCanvasSize({ preserve: true });
      }
    });

    sketchModalUndoBtn?.addEventListener('click', () => fullSurface.undo());
    sketchModalClearBtn?.addEventListener('click', () => fullSurface.clear());
    sketchModalDoneBtn?.addEventListener('click', closeSketchModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !sketchModal.classList.contains('hidden')) {
        closeSketchModal();
      }
    });
  }

  function getSketchBlob() {
    const exportCanvas = getExportCanvas();
    if (!exportCanvas || !hasSketch) return Promise.resolve(null);
    return new Promise((resolve) => {
      exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  // --- Form Submission ---
  function showError(msg) {
    if (!errorBox) return;
    if (!msg) {
      errorBox.classList.add('hidden');
      errorBox.textContent = '';
    } else {
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
    }
  }

  function buildOrderSummaryText({ name, email, idea, sharePermission, storePermission }) {
    const price = formatEuro(calculateStickerPrice(qty));
    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Sticker pack: ${qty} copies (1 ${selectedStoreDesign ? 'Store archive' : 'custom sticker'} design)`,
      `Estimated total: ${price} (paid via Revolut, bank transfer, or cash after design preview approval)`,
      ...(selectedStoreDesign ? [`Selected Store design: ${selectedStoreDesign.title} (#${selectedStoreDesign.id})`] : []),
      '',
      `Idea: ${idea || '(See attached photos / sketch / voice note)'}`,
      '',
      `Timelapse contact: ${
        sharePermission ? 'Yes — you may contact me; separate approval required before sharing.' : 'No'
      }`,
      `Public Store permission: ${
        storePermission ? 'Yes — may list my finished design in the imastik Store after confirmation.' : 'No'
      }`,
    ];
    const attachments = [];
    if (picked.length) attachments.push(`${picked.length} reference image(s)`);
    if (hasSketch) attachments.push('1 napkin sketch PNG');
    if (voiceBlob) attachments.push('1 voice note audio');
    if (attachments.length) {
      lines.push('', `Attachments prepared: ${attachments.join(', ')}.`);
    }
    return lines.join('\n');
  }

  function appendMailtoBackupControls({ name, email, idea, sharePermission, storePermission, autoLaunch = false }) {
    if (!resultBox) return;
    const subjectText = `imastik sticker request — ${name}`;
    const bodyText = buildOrderSummaryText({ name, email, idea, sharePermission, storePermission });
    const recipient = config.hasTeamEmail ? config.teamEmail : '';
    const mailtoHref = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
      subjectText,
    )}&body=${encodeURIComponent(bodyText)}`;

    const actions = document.createElement('div');
    actions.className = 'result-actions';

    const mailLink = document.createElement('a');
    mailLink.className = 'result-btn primary';
    mailLink.href = mailtoHref;
    mailLink.textContent = 'Open Email App';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'result-btn';
    copyBtn.textContent = 'Copy Order Details';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(`${subjectText}\n\n${bodyText}`);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Order Details';
        }, 2000);
      } catch {
        copyBtn.textContent = 'Copy unavailable';
      }
    });

    actions.append(mailLink, copyBtn);
    resultBox.append(actions);

    const downloads = document.createElement('div');
    downloads.className = 'result-downloads';

    const exportCanvas = getExportCanvas();
    if (hasSketch && exportCanvas) {
      const a = document.createElement('a');
      a.className = 'result-btn';
      a.href = exportCanvas.toDataURL('image/png');
      a.download = 'imastik-sketch.png';
      a.textContent = 'Download Sketch PNG';
      downloads.appendChild(a);
    }

    if (voiceUrl) {
      const a = document.createElement('a');
      a.className = 'result-btn';
      a.href = voiceUrl;
      a.download = voiceFilename;
      a.textContent = 'Download Voice Note';
      downloads.appendChild(a);
    }

    if (downloads.childElementCount > 0) {
      const attachHint = document.createElement('p');
      attachHint.textContent = 'Quick downloads to attach to your email:';
      resultBox.append(attachHint, downloads);
    }

    if (autoLaunch && config.hasTeamEmail) {
      window.location.href = mailtoHref;
    }
  }

  async function renderMailtoResult({ name, email, idea, sharePermission, storePermission }) {
    if (!resultBox) return;
    resultBox.replaceChildren();
    resultBox.classList.remove('hidden');

    const heading = document.createElement('h4');
    heading.textContent = 'Your sticker request draft is ready!';

    const copy = document.createElement('p');
    copy.textContent = config.hasTeamEmail
      ? `Next step: send the pre-filled email to ${config.teamEmail} (attach your sketch/voice note if saved). We'll reply with a design preview and Revolut / bank transfer / cash payment details before printing.`
      : 'Next step: click "Open Email App", enter the imastik team email address, and hit send (don\'t forget any downloaded sketch or voice note). We\'ll reply with your design preview and payment options (Revolut, bank transfer, or cash) before printing.';

    resultBox.append(heading, copy);
    appendMailtoBackupControls({ name, email, idea, sharePermission, storePermission, autoLaunch: true });
    resultBox.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
  }

  async function submitToServer({ name, email, idea, sharePermission, storePermission }) {
    const fd = new FormData();
    fd.set('name', name);
    fd.set('email', email);
    fd.set('idea', idea);
    fd.set('quantity', String(qty));
    fd.set('sharePermission', sharePermission ? 'yes' : 'no');
    fd.set('storePermission', storePermission ? 'yes' : 'no');
    if (selectedStoreDesign?.id) {
      fd.set('storeDesignId', selectedStoreDesign.id);
    }

    picked.forEach((entry) => {
      fd.append('photos', entry.file, entry.file.name);
    });

    const sketchBlob = await getSketchBlob();
    if (sketchBlob) {
      fd.append('sketch', sketchBlob, 'imastik-sketch.png');
    }

    if (voiceBlob) {
      fd.append('voiceNote', voiceBlob, voiceFilename);
    }

    const res = await fetch('/api/orders', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Could not submit order. Please try again.');
    }

    if (resultBox) {
      const targetInbox = config.teamEmail || 'imastik.co@gmail.com';
      resultBox.replaceChildren();
      resultBox.classList.remove('hidden');

      const heading = document.createElement('h4');
      heading.textContent = data.emailSent ? `Order sent to ${targetInbox}!` : 'Order saved — finish sending by email';

      const details = document.createElement('p');
      const summaryLine = `Reference ID: ${data.orderId} · ${data.quantity} sticker${
        data.quantity === 1 ? '' : 's'
      } (${data.estimatedPriceFormatted}) · ${data.filesCount} attachment${
        data.filesCount === 1 ? '' : 's'
      }.`;
      details.textContent = data.emailSent
        ? `${summaryLine} We emailed your idea and files directly to ${targetInbox} and will reply to ${email} with your design preview before printing.`
        : `${summaryLine} Automatic email delivery is not active yet — click "Open Email App" below so your request reaches ${targetInbox} right away.`;

      resultBox.append(heading, details);

      if (Array.isArray(data.omittedAttachments) && data.omittedAttachments.length > 0) {
        const omitNote = document.createElement('p');
        omitNote.textContent = `Note: ${data.omittedAttachments.join(', ')} exceeded the 18 MB email size cap and was saved on the server without email attachment.`;
        resultBox.append(omitNote);
      }

      if (!data.emailSent) {
        appendMailtoBackupControls({ name, email, idea, sharePermission, storePermission, autoLaunch: false });
      }

      resultBox.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const name = String(nameInput?.value || '').trim();
    const email = String(emailInput?.value || '').trim();
    const idea = String(ideaInput?.value || '').trim();
    const sharePermission = Boolean(form.querySelector('[name="share_permission"]')?.checked);
    const storePermission = Boolean(form.querySelector('[name="store_permission"]')?.checked);

    if (!name) {
      showError('Please enter your name.');
      nameInput?.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      emailInput?.focus();
      return;
    }

    const previousBtnLabel = submitBtnText?.textContent || '';
    if (submitBtn) submitBtn.disabled = true;
    if (config.orderMode === 'server' && submitBtnText) {
      submitBtnText.textContent = 'SENDING ORDER...';
    }
    try {
      if (config.orderMode === 'server') {
        await submitToServer({ name, email, idea, sharePermission, storePermission });
      } else {
        await renderMailtoResult({ name, email, idea, sharePermission, storePermission });
      }
    } catch (err) {
      showError(err?.message || 'Something went wrong while preparing your order.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitBtnText && previousBtnLabel) {
        submitBtnText.textContent = previousBtnLabel;
      }
    }
  });

  function stripStorePickLine(rawText) {
    return String(rawText || '').replace(/^Store design pick: [^\n]+\n*/i, '');
  }

  function clearStoreSelection() {
    selectedStoreDesign = null;
    storePickBanner?.classList.add('hidden');
    if (ideaInput) {
      ideaInput.value = stripStorePickLine(ideaInput.value);
    }
    setQuantity(qty);
    refreshProgress();
  }

  function selectStoreDesign(design, preferredQty = MIN_QUANTITY) {
    if (!design?.id || !design?.title) return;
    selectedStoreDesign = { id: design.id, title: design.title };
    storePickBanner?.classList.remove('hidden');
    setQuantity(preferredQty);
    if (ideaInput) {
      const rest = stripStorePickLine(ideaInput.value).trimStart();
      const prefix = `Store design pick: ${design.title} (#${design.id})`;
      ideaInput.value = rest ? `${prefix}\n${rest}` : prefix;
    }
    refreshProgress();
    document.getElementById('order')?.scrollIntoView({
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
    const focusTarget = nameInput?.value.trim() ? ideaInput : nameInput;
    focusTarget?.focus({ preventScroll: true });
  }

  storePickClear?.addEventListener('click', clearStoreSelection);

  function addExternalPhotos(fileList) {
    addPhotos(Array.from(fileList || []));
  }

  return { setQuantity, selectStoreDesign, addExternalPhotos };
}
