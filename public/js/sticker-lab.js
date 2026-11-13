/**
 * Interactive Sticker Lab for Sticky Club.
 * Supports draggable shape/text stickers, photo upload with Magic Wand / Brush
 * background removal, die-cut white vinyl border, laptop lid previews, and PNG export.
 */

const STARTER_STICKERS = [
  {
    id: 'starter-1',
    type: 'text',
    text: 'MAKE IT WEIRD',
    shape: 'blob',
    color: '#ffe04a',
    xPct: 24,
    yPct: 48,
    size: 165,
    rotation: -8,
  },
  {
    id: 'starter-2',
    type: 'text',
    text: 'STICKY CLUB',
    shape: 'circle',
    color: '#ff9fc6',
    xPct: 54,
    yPct: 44,
    size: 145,
    rotation: 7,
  },
  {
    id: 'starter-3',
    type: 'text',
    text: '100% YOURS',
    shape: 'star',
    color: '#f04a38',
    xPct: 77,
    yPct: 58,
    size: 150,
    rotation: 12,
  },
];

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 920;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function getTextColorForBg(hex) {
  if (hex === '#f04a38') return '#ffffff';
  return '#19251e';
}

export function initStickerLab({ onAttachMockup }) {
  const stage = document.getElementById('stage');
  const photoUpload = document.getElementById('photoUpload');
  const addTextBtn = document.getElementById('addTextSticker');
  const exportBtn = document.getElementById('exportLabBtn');
  const attachBtn = document.getElementById('attachLabBtn');
  const resetBtn = document.getElementById('resetLabBtn');
  const statusEl = document.getElementById('photoStatus');
  const surfaceBtns = document.querySelectorAll('.surface-btn[data-surface]');

  const textInput = document.getElementById('stickerText');
  const shapeSelect = document.getElementById('stickerShape');
  const colorButtons = document.querySelectorAll('#stickerColors .swatch');
  const sizeInput = document.getElementById('stickerSize');
  const sizeOut = document.getElementById('stickerSizeVal');
  const rotInput = document.getElementById('stickerRotation');
  const rotOut = document.getElementById('stickerRotationVal');
  const bringFrontBtn = document.getElementById('bringFrontBtn');
  const sendBackBtn = document.getElementById('sendBackBtn');
  const duplicateBtn = document.getElementById('duplicateStickerBtn');
  const deleteBtn = document.getElementById('deleteStickerBtn');

  // Photo Cutout Studio elements
  const photoEditor = document.getElementById('photoEditor');
  const cutoutCanvas = document.getElementById('cutoutCanvas');
  const cutoutCtx = cutoutCanvas?.getContext('2d', { willReadFrequently: true });
  const cutoutToolHint = document.getElementById('cutoutToolHint');
  const origPreview = document.getElementById('origPreview');
  const cutoutPreview = document.getElementById('cutoutPreview');
  const cutoutModeBtns = document.querySelectorAll('.cutout-mode[data-mode]');
  const wandTolerance = document.getElementById('wandTolerance');
  const wandToleranceVal = document.getElementById('wandToleranceVal');
  const brushSize = document.getElementById('brushSize');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const stickerBorder = document.getElementById('stickerBorder');
  const stickerBorderVal = document.getElementById('stickerBorderVal');
  const cutoutUndoBtn = document.getElementById('cutoutUndo');
  const cutoutResetBtn = document.getElementById('cutoutReset');
  const addCutoutBtn = document.getElementById('addCutoutToBoard');
  const cancelCutoutBtn = document.getElementById('cancelCutout');

  if (!stage) return null;

  let nextId = 1;
  let stickers = [];
  let selectedId = null;
  let currentSurface = 'sky';

  // Cutout studio state
  const cutoutState = {
    mode: 'wand',
    origData: null,
    workData: null,
    undoStack: [],
    drawing: false,
    width: 0,
    height: 0,
    origDataUrl: '',
  };

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function getSelected() {
    return stickers.find((s) => s.id === selectedId) || null;
  }

  function selectSticker(id) {
    selectedId = id;
    renderStageSelection();
    syncInspector();
  }

  function loadStarterStickers() {
    stickers = STARTER_STICKERS.map((s) => ({ ...s, id: `sticker-${nextId++}` }));
    selectedId = stickers[0]?.id || null;
    renderStage();
    syncInspector();
  }

  function renderStageSelection() {
    stage.querySelectorAll('.piece').forEach((el) => {
      el.classList.toggle('selected', el.dataset.id === selectedId);
    });
  }

  function applyPieceVisual(el, item) {
    const scale = stage.clientWidth < 560 ? 0.72 : 1;
    const width = Math.round(item.size * scale);
    const height = item.type === 'photo'
      ? Math.round(width * (item.aspect || 1))
      : item.shape === 'pill'
        ? Math.round(width * 0.62)
        : width;

    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${item.xPct}%`;
    el.style.top = `${item.yPct}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;

    const shapeEl = el.querySelector('.shape');
    if (item.type === 'photo') {
      shapeEl.className = 'shape photo';
      shapeEl.style.background = 'transparent';
      let img = shapeEl.querySelector('img');
      if (!img) {
        shapeEl.replaceChildren();
        img = document.createElement('img');
        img.alt = item.label || 'Custom photo sticker';
        shapeEl.appendChild(img);
      }
      if (img.src !== item.src) img.src = item.src;
    } else {
      shapeEl.className = `shape ${item.shape}`;
      shapeEl.style.background = item.color;
      let span = shapeEl.querySelector('.labeltext');
      if (!span) {
        shapeEl.replaceChildren();
        span = document.createElement('span');
        span.className = 'labeltext';
        shapeEl.appendChild(span);
      }
      span.textContent = item.text || 'STICKY';
      span.style.color = getTextColorForBg(item.color);
    }
  }

  function renderStage() {
    stage.replaceChildren();
    stickers.forEach((item) => {
      const piece = document.createElement('div');
      piece.className = 'piece';
      piece.dataset.id = item.id;
      piece.tabIndex = 0;
      piece.setAttribute(
        'aria-label',
        item.type === 'photo' ? `Photo sticker: ${item.label || 'photo'}` : `Sticker: ${item.text}`,
      );

      const shape = document.createElement('div');
      shape.className = 'shape';
      piece.appendChild(shape);

      applyPieceVisual(piece, item);
      if (item.id === selectedId) piece.classList.add('selected');

      attachDragHandlers(piece, item);
      stage.appendChild(piece);
    });
  }

  function attachDragHandlers(piece, item) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origXPct = item.xPct;
    let origYPct = item.yPct;

    piece.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      selectSticker(item.id);
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origXPct = item.xPct;
      origYPct = item.yPct;
      piece.classList.add('is-dragging');
      piece.setPointerCapture(e.pointerId);
    });

    piece.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dxPct = ((e.clientX - startX) / rect.width) * 100;
      const dyPct = ((e.clientY - startY) / rect.height) * 100;
      item.xPct = clamp(origXPct + dxPct, 6, 94);
      item.yPct = clamp(origYPct + dyPct, 8, 92);
      piece.style.left = `${item.xPct}%`;
      piece.style.top = `${item.yPct}%`;
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      piece.classList.remove('is-dragging');
    };

    piece.addEventListener('pointerup', endDrag);
    piece.addEventListener('pointercancel', endDrag);
    piece.addEventListener('lostpointercapture', endDrag);

    piece.addEventListener('keydown', (e) => {
      if (selectedId !== item.id) selectSticker(item.id);
      const step = e.shiftKey ? 5 : 2;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        item.xPct = clamp(item.xPct - step, 6, 94);
        applyPieceVisual(piece, item);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        item.xPct = clamp(item.xPct + step, 6, 94);
        applyPieceVisual(piece, item);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        item.yPct = clamp(item.yPct - step, 8, 92);
        applyPieceVisual(piece, item);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        item.yPct = clamp(item.yPct + step, 8, 92);
        applyPieceVisual(piece, item);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelectedSticker();
      }
    });
  }

  function syncInspector() {
    const sel = getSelected();
    const hasSel = Boolean(sel);
    const isText = sel?.type === 'text';

    if (textInput) {
      textInput.disabled = !isText;
      textInput.value = isText ? sel.text : '';
      textInput.placeholder = sel && !isText ? 'Photo cutout selected' : 'Type your inside joke...';
    }
    if (shapeSelect) {
      shapeSelect.disabled = !isText;
      if (isText) shapeSelect.value = sel.shape;
    }
    colorButtons.forEach((btn) => {
      btn.disabled = !isText;
      btn.classList.toggle('active', Boolean(isText && btn.dataset.color === sel.color));
    });
    if (sizeInput && sizeOut) {
      sizeInput.disabled = !hasSel;
      const sz = sel?.size ?? 150;
      sizeInput.value = String(sz);
      sizeOut.textContent = `${sz}px`;
    }
    if (rotInput && rotOut) {
      rotInput.disabled = !hasSel;
      const rot = sel?.rotation ?? 0;
      rotInput.value = String(rot);
      rotOut.textContent = `${rot}°`;
    }
    [bringFrontBtn, sendBackBtn, duplicateBtn, deleteBtn].forEach((btn) => {
      if (btn) btn.disabled = !hasSel;
    });
  }

  function updateSelectedPiece(mutator) {
    const sel = getSelected();
    if (!sel) return;
    mutator(sel);
    const piece = stage.querySelector(`.piece[data-id="${sel.id}"]`);
    if (piece) applyPieceVisual(piece, sel);
    syncInspector();
  }

  function deleteSelectedSticker() {
    if (!selectedId) return;
    stickers = stickers.filter((s) => s.id !== selectedId);
    selectedId = stickers[stickers.length - 1]?.id || null;
    renderStage();
    syncInspector();
    setStatus('Sticker removed.');
  }

  // Inspector bindings
  textInput?.addEventListener('input', () => {
    updateSelectedPiece((s) => {
      if (s.type === 'text') s.text = textInput.value;
    });
  });

  shapeSelect?.addEventListener('change', () => {
    updateSelectedPiece((s) => {
      if (s.type === 'text') s.shape = shapeSelect.value;
    });
  });

  colorButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      updateSelectedPiece((s) => {
        if (s.type === 'text') s.color = btn.dataset.color;
      });
    });
  });

  sizeInput?.addEventListener('input', () => {
    updateSelectedPiece((s) => {
      s.size = Number.parseInt(sizeInput.value, 10) || 150;
    });
  });

  rotInput?.addEventListener('input', () => {
    updateSelectedPiece((s) => {
      s.rotation = Number.parseInt(rotInput.value, 10) || 0;
    });
  });

  bringFrontBtn?.addEventListener('click', () => {
    const idx = stickers.findIndex((s) => s.id === selectedId);
    if (idx < 0 || idx === stickers.length - 1) return;
    const [moved] = stickers.splice(idx, 1);
    stickers.push(moved);
    renderStage();
  });

  sendBackBtn?.addEventListener('click', () => {
    const idx = stickers.findIndex((s) => s.id === selectedId);
    if (idx <= 0) return;
    const [moved] = stickers.splice(idx, 1);
    stickers.unshift(moved);
    renderStage();
  });

  duplicateBtn?.addEventListener('click', () => {
    const sel = getSelected();
    if (!sel) return;
    const copy = {
      ...sel,
      id: `sticker-${nextId++}`,
      xPct: clamp(sel.xPct + 6, 8, 92),
      yPct: clamp(sel.yPct + 6, 10, 90),
    };
    stickers.push(copy);
    selectedId = copy.id;
    renderStage();
    syncInspector();
    setStatus('Duplicated sticker.');
  });

  deleteBtn?.addEventListener('click', deleteSelectedSticker);

  addTextBtn?.addEventListener('click', () => {
    const palette = ['#ffe04a', '#ff9fc6', '#b6f272', '#a8d7f8', '#fffdf5'];
    const shapes = ['blob', 'circle', 'square', 'pill'];
    const item = {
      id: `sticker-${nextId++}`,
      type: 'text',
      text: 'YOUR IDEA',
      shape: shapes[stickers.length % shapes.length],
      color: palette[stickers.length % palette.length],
      xPct: clamp(22 + ((stickers.length * 19) % 52), 18, 82),
      yPct: clamp(28 + ((stickers.length * 23) % 44), 22, 78),
      size: 155,
      rotation: ((stickers.length % 5) - 2) * 5,
    };
    stickers.push(item);
    selectedId = item.id;
    renderStage();
    syncInspector();
    textInput?.focus();
    textInput?.select();
    setStatus('Added a new sticker — edit its text, shape, or colour below.');
  });

  resetBtn?.addEventListener('click', () => {
    loadStarterStickers();
    setStatus('Sticker board reset to starter stickers.');
  });

  surfaceBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSurface = btn.dataset.surface || 'sky';
      stage.dataset.surface = currentSurface;
      surfaceBtns.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  stage.addEventListener('dragstart', (e) => e.preventDefault());

  // --- Photo Cutout Studio ---
  function cloneImageData(imgData) {
    return new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
  }

  function pushCutoutUndo() {
    if (!cutoutState.workData) return;
    if (cutoutState.undoStack.length >= 16) cutoutState.undoStack.shift();
    cutoutState.undoStack.push(cloneImageData(cutoutState.workData));
  }

  function buildStickerWithBorder(srcImgData, borderPx) {
    const pad = borderPx > 0 ? borderPx + 4 : 2;
    const w = srcImgData.width + pad * 2;
    const h = srcImgData.height + pad * 2;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = srcImgData.width;
    rawCanvas.height = srcImgData.height;
    rawCanvas.getContext('2d').putImageData(srcImgData, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext('2d');

    if (borderPx > 0) {
      // Create solid white silhouette of non-transparent pixels
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = srcImgData.width;
      maskCanvas.height = srcImgData.height;
      const mCtx = maskCanvas.getContext('2d');
      mCtx.drawImage(rawCanvas, 0, 0);
      mCtx.globalCompositeOperation = 'source-in';
      mCtx.fillStyle = '#ffffff';
      mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

      // Stamp white silhouette in a ring for crisp die-cut outline
      const steps = Math.max(12, borderPx * 3);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const ox = Math.cos(angle) * borderPx;
        const oy = Math.sin(angle) * borderPx;
        ctx.drawImage(maskCanvas, pad + ox, pad + oy);
      }
      ctx.drawImage(maskCanvas, pad, pad);
    }

    ctx.drawImage(rawCanvas, pad, pad);
    return outCanvas;
  }

  function trimTransparentCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return canvas;
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const trimmed = document.createElement('canvas');
    trimmed.width = cw;
    trimmed.height = ch;
    trimmed.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return trimmed;
  }

  function refreshCutoutViews() {
    if (!cutoutCtx || !cutoutState.workData) return;
    cutoutCtx.putImageData(cutoutState.workData, 0, 0);
    const borderPx = Number.parseInt(stickerBorder?.value || '8', 10) || 0;
    const bordered = buildStickerWithBorder(cutoutState.workData, borderPx);
    if (cutoutPreview) {
      cutoutPreview.src = bordered.toDataURL('image/png');
    }
  }

  function magicWandAt(startX, startY) {
    if (!cutoutState.workData) return;
    const { width, height, data } = cutoutState.workData;
    const sx = clamp(Math.floor(startX), 0, width - 1);
    const sy = clamp(Math.floor(startY), 0, height - 1);
    const startIdx = (sy * width + sx) * 4;
    if (data[startIdx + 3] === 0) return;

    pushCutoutUndo();

    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];
    const tol = (Number.parseInt(wandTolerance?.value || '28', 10) || 28) * 2.2;
    const tolSq = tol * tol;

    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const firstPos = sy * width + sx;
    queue[tail++] = firstPos;
    visited[firstPos] = 1;

    while (head < tail) {
      const pos = queue[head++];
      const idx = pos * 4;
      const dr = data[idx] - targetR;
      const dg = data[idx + 1] - targetG;
      const db = data[idx + 2] - targetB;
      if (dr * dr + dg * dg + db * db > tolSq) continue;

      data[idx + 3] = 0;

      const x = pos % width;
      const y = (pos - x) / width;

      if (x > 0 && !visited[pos - 1]) {
        visited[pos - 1] = 1;
        queue[tail++] = pos - 1;
      }
      if (x < width - 1 && !visited[pos + 1]) {
        visited[pos + 1] = 1;
        queue[tail++] = pos + 1;
      }
      if (y > 0 && !visited[pos - width]) {
        visited[pos - width] = 1;
        queue[tail++] = pos - width;
      }
      if (y < height - 1 && !visited[pos + width]) {
        visited[pos + width] = 1;
        queue[tail++] = pos + width;
      }
    }

    refreshCutoutViews();
  }

  function applyBrushAt(cx, cy, restore) {
    if (!cutoutState.workData || !cutoutState.origData) return;
    const { width, height, data } = cutoutState.workData;
    const orig = cutoutState.origData.data;
    const radius = Math.max(2, Math.round((Number.parseInt(brushSize?.value || '24', 10) || 24) / 2));
    const rSq = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rSq) {
          const idx = (y * width + x) * 4;
          if (restore) {
            data[idx] = orig[idx];
            data[idx + 1] = orig[idx + 1];
            data[idx + 2] = orig[idx + 2];
            data[idx + 3] = orig[idx + 3];
          } else {
            data[idx + 3] = 0;
          }
        }
      }
    }
    refreshCutoutViews();
  }

  function getCanvasPoint(e) {
    const r = cutoutCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * cutoutCanvas.width) / r.width,
      y: ((e.clientY - r.top) * cutoutCanvas.height) / r.height,
    };
  }

  cutoutCanvas?.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const p = getCanvasPoint(e);
    if (cutoutState.mode === 'wand') {
      magicWandAt(p.x, p.y);
      return;
    }
    pushCutoutUndo();
    cutoutState.drawing = true;
    cutoutCanvas.setPointerCapture(e.pointerId);
    applyBrushAt(p.x, p.y, cutoutState.mode === 'restore');
  });

  cutoutCanvas?.addEventListener('pointermove', (e) => {
    if (!cutoutState.drawing || cutoutState.mode === 'wand') return;
    e.preventDefault();
    const p = getCanvasPoint(e);
    applyBrushAt(p.x, p.y, cutoutState.mode === 'restore');
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => {
    cutoutCanvas?.addEventListener(ev, () => {
      cutoutState.drawing = false;
    });
  });

  cutoutModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      cutoutState.mode = btn.dataset.mode || 'wand';
      cutoutModeBtns.forEach((b) => b.classList.toggle('active', b === btn));
      if (cutoutToolHint) {
        cutoutToolHint.textContent =
          cutoutState.mode === 'wand'
            ? 'Tap background to remove it'
            : cutoutState.mode === 'erase'
              ? 'Drag to erase parts of photo'
              : 'Drag to restore original photo';
      }
    });
  });

  wandTolerance?.addEventListener('input', () => {
    if (wandToleranceVal) wandToleranceVal.textContent = wandTolerance.value;
  });

  brushSize?.addEventListener('input', () => {
    if (brushSizeVal) brushSizeVal.textContent = `${brushSize.value}px`;
  });

  stickerBorder?.addEventListener('input', () => {
    if (stickerBorderVal) stickerBorderVal.textContent = `${stickerBorder.value}px`;
    refreshCutoutViews();
  });

  cutoutUndoBtn?.addEventListener('click', () => {
    const prev = cutoutState.undoStack.pop();
    if (!prev) return;
    cutoutState.workData = prev;
    refreshCutoutViews();
  });

  cutoutResetBtn?.addEventListener('click', () => {
    if (!cutoutState.origData) return;
    pushCutoutUndo();
    cutoutState.workData = cloneImageData(cutoutState.origData);
    refreshCutoutViews();
  });

  cancelCutoutBtn?.addEventListener('click', () => {
    photoEditor?.classList.add('hidden');
  });

  addCutoutBtn?.addEventListener('click', () => {
    if (!cutoutState.workData) return;
    const borderPx = Number.parseInt(stickerBorder?.value || '8', 10) || 0;
    const bordered = buildStickerWithBorder(cutoutState.workData, borderPx);
    const trimmed = trimTransparentCanvas(bordered);
    const src = trimmed.toDataURL('image/png');
    const aspect = trimmed.height / Math.max(1, trimmed.width);

    const item = {
      id: `sticker-${nextId++}`,
      type: 'photo',
      label: 'Photo cutout',
      src,
      aspect,
      xPct: 50,
      yPct: 50,
      size: 185,
      rotation: -4,
    };
    stickers.push(item);
    selectedId = item.id;
    renderStage();
    syncInspector();
    photoEditor?.classList.add('hidden');
    setStatus('Added your photo cutout sticker to the board! Drag, resize, or tilt it.');
  });

  function openPhotoInCutoutStudio(file) {
    if (!file || !VALID_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      setStatus('Please choose a JPG, PNG, or WebP photo under 15 MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!cutoutCanvas || !cutoutCtx) return;

      const maxDim = 480;
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));

      cutoutCanvas.width = w;
      cutoutCanvas.height = h;
      cutoutCtx.clearRect(0, 0, w, h);
      cutoutCtx.drawImage(img, 0, 0, w, h);

      const initial = cutoutCtx.getImageData(0, 0, w, h);
      cutoutState.origData = cloneImageData(initial);
      cutoutState.workData = cloneImageData(initial);
      cutoutState.undoStack = [];
      cutoutState.width = w;
      cutoutState.height = h;
      cutoutState.origDataUrl = cutoutCanvas.toDataURL('image/png');

      if (origPreview) origPreview.src = cutoutState.origDataUrl;
      refreshCutoutViews();
      photoEditor?.classList.remove('hidden');
      photoEditor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setStatus('Photo loaded in Cutout Studio! Tap background areas to punch them out, or add straight to board.');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus('Could not decode that image file.');
    };
    img.src = url;
  }

  photoUpload?.addEventListener('change', () => {
    const file = photoUpload.files?.[0];
    if (file) openPhotoInCutoutStudio(file);
    photoUpload.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) => {
    stage.addEventListener(ev, (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      stage.classList.add('upload-drag');
    });
  });

  ['dragleave', 'drop'].forEach((ev) => {
    stage.addEventListener(ev, (e) => {
      e.preventDefault();
      stage.classList.remove('upload-drag');
    });
  });

  stage.addEventListener('drop', (e) => {
    const file = Array.from(e.dataTransfer?.files || [])[0];
    if (file) openPhotoInCutoutStudio(file);
  });

  // --- Offscreen Canvas Renderer for PNG Export & Order Attachment ---
  function drawBlobPath(ctx, cx, cy, r) {
    ctx.beginPath();
    const pts = 18;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const wobble = 1 + 0.08 * Math.sin(a * 3 + 0.6) + 0.05 * Math.cos(a * 2);
      const x = cx + Math.cos(a) * r * wobble;
      const y = cy + Math.sin(a) * r * wobble;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawStarPath(ctx, cx, cy, outerR) {
    ctx.beginPath();
    const spikes = 7;
    const innerR = outerR * 0.68;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawRoundedRectPath(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return ['STICKY'];
    const lines = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
    return lines;
  }

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function renderStageToBlob() {
    const out = document.createElement('canvas');
    out.width = EXPORT_WIDTH;
    out.height = EXPORT_HEIGHT;
    const ctx = out.getContext('2d');

    // Draw backdrop matching currentSurface
    if (currentSurface === 'silver') {
      const g = ctx.createRadialGradient(800, 380, 60, 800, 460, 900);
      g.addColorStop(0, '#f4f6f8');
      g.addColorStop(0.62, '#d5dce3');
      g.addColorStop(1, '#b7c0ca');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    } else if (currentSurface === 'dark') {
      const g = ctx.createRadialGradient(800, 360, 60, 800, 460, 900);
      g.addColorStop(0, '#2f3539');
      g.addColorStop(0.7, '#1c2023');
      g.addColorStop(1, '#121517');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    } else {
      const g = ctx.createLinearGradient(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
      g.addColorStop(0, '#a7d7f3');
      g.addColorStop(1, '#d2eafa');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    }

    // Corner studio label
    ctx.save();
    ctx.font = '700 22px "DM Mono", monospace';
    ctx.fillStyle = currentSurface === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(25,37,30,0.45)';
    ctx.fillText('STICKY CLUB / MOCKUP', 42, 54);
    ctx.restore();

    const stageW = Math.max(stage.clientWidth, 320);
    const scaleFactor = EXPORT_WIDTH / stageW;

    for (const item of stickers) {
      const cx = (item.xPct / 100) * EXPORT_WIDTH;
      const cy = (item.yPct / 100) * EXPORT_HEIGHT;
      const baseSize = item.size * (stageW < 560 ? 0.72 : 1) * scaleFactor;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.shadowColor = 'rgba(20, 20, 20, 0.2)';
      ctx.shadowOffsetX = 9;
      ctx.shadowOffsetY = 12;
      ctx.shadowBlur = 0;

      if (item.type === 'photo') {
        try {
          const img = await loadImg(item.src);
          const w = baseSize;
          const h = w * (item.aspect || img.height / img.width || 1);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } catch {
          // Skip broken image gracefully
        }
        ctx.restore();
        continue;
      }

      const w = baseSize;
      const h = item.shape === 'pill' ? baseSize * 0.62 : baseSize;

      if (item.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
      } else if (item.shape === 'square') {
        drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, w * 0.18);
      } else if (item.shape === 'pill') {
        drawRoundedRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
      } else if (item.shape === 'star') {
        drawStarPath(ctx, 0, 0, w / 2);
      } else {
        drawBlobPath(ctx, 0, 0, w * 0.48);
      }

      ctx.fillStyle = item.color;
      ctx.fill();
      if (item.shape !== 'star') {
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = Math.max(6, Math.round(scaleFactor * 5));
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Draw sticker text
      ctx.shadowColor = 'transparent';
      const fontSize = Math.round(clamp(baseSize * 0.15, 22, 54));
      ctx.font = `900 ${fontSize}px "Archivo Black", Arial, sans-serif`;
      ctx.fillStyle = getTextColorForBg(item.color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapLines(ctx, item.text, w * 0.72);
      const lineHeight = fontSize * 1.08;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, idx) => {
        ctx.fillText(line, 0, startY + idx * lineHeight);
      });

      ctx.restore();
    }

    return new Promise((resolve, reject) => {
      out.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export sticker mockup PNG.'));
      }, 'image/png');
    });
  }

  exportBtn?.addEventListener('click', async () => {
    try {
      const blob = await renderStageToBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sticky-club-mockup.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Mockup PNG downloaded!');
    } catch {
      setStatus('Could not generate mockup PNG.');
    }
  });

  attachBtn?.addEventListener('click', async () => {
    try {
      const blob = await renderStageToBlob();
      const file = new File([blob], 'sticky-club-mockup.png', { type: 'image/png' });
      const labels = stickers
        .filter((s) => s.type === 'text' && s.text.trim())
        .map((s) => `"${s.text.trim()}"`)
        .join(', ');
      onAttachMockup?.(file, labels ? `Sticker Lab mockup stickers: ${labels}` : 'Attached Sticker Lab mockup.');
      setStatus('Mockup attached to your order form below!');
    } catch {
      setStatus('Could not attach mockup to order form.');
    }
  });

  window.addEventListener('resize', renderStage);
  loadStarterStickers();

  return { renderStageToBlob };
}
