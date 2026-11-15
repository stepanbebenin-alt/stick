/**
 * Interactive Sticker Playground (#play) for imastik.
 * Supports draggable word/shape stickers, photo cutout studio (quick flood-fill cutout,
 * optional AI background removal, erase/restore brushes, art styles, white border),
 * canvas export, and attaching designs directly into the Order Form.
 */

const VALID_TYPES = /^image\/(jpeg|png|webp)$/;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const PALETTE = ['#ffe04a', '#ff9fc6', '#fff3b0', '#f04a38', '#fffdf6', '#c8256a'];
const DARK_BG_COLORS = new Set(['#c8256a', '#f04a38']);
const MIX_WORDS = ['MAIN CHARACTER', 'NO THOUGHTS', 'STAY WEIRD', 'IMASTIK', 'GOOD LUCK', 'OFFLINE', 'JUST VIBING'];

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function initPlayground({ onAttachToOrder } = {}) {
  const stage = document.getElementById('stage');
  const stickerText = document.getElementById('stickerText');
  const shapeSelect = document.getElementById('shape');
  const swatchesEl = document.getElementById('swatches');
  const photoPickerBtn = document.getElementById('openPhotoPicker');
  const photoUpload = document.getElementById('photoUpload');
  const photoStatus = document.getElementById('photoStatus');
  const photoEditor = document.getElementById('photoEditor');
  const editCanvas = document.getElementById('editCanvas');
  const beforeImage = document.getElementById('beforeImage');
  const afterImage = document.getElementById('afterImage');

  if (!stage || !editCanvas) return;

  const $ = (id) => document.getElementById(id);
  const ctx = editCanvas.getContext('2d', { willReadFrequently: true });

  let activeColor = PALETTE[0];
  let pieces = [];
  let selected = null;
  let nextId = 1;

  let original = null;
  let mask = null;
  let brushMode = 'erase';
  let editedURL = null;
  let loadingSeq = 0;
  let painting = false;
  let lastPaintPoint = null;
  let previewTimer = null;

  const setStatus = (msg) => {
    if (photoStatus) photoStatus.textContent = msg;
  };

  function selectPiece(piece) {
    selected = piece;
    pieces.forEach((item) => item.el.classList.toggle('selected', item === piece));
    if (piece && !piece.image) {
      if (stickerText) stickerText.value = piece.text;
      if (shapeSelect) shapeSelect.value = piece.shape;
      activeColor = piece.color;
    }
    if (piece) {
      if ($('pieceSize')) $('pieceSize').value = String(Math.round(piece.size));
      if ($('pieceRotate')) $('pieceRotate').value = String(Math.round(piece.rotation));
    }
  }

  function renderPiece(piece) {
    piece.el.style.left = `${piece.x}%`;
    piece.el.style.top = `${piece.y}%`;
    piece.el.style.width = `${piece.size}px`;
    piece.el.style.height = `${piece.size}px`;
    piece.el.style.transform = `rotate(${piece.rotation}deg)`;
    piece.el.style.zIndex = String(piece.id);
    piece.el.replaceChildren();

    const shapeDiv = document.createElement('div');
    shapeDiv.className = `shape ${piece.shape}`;
    shapeDiv.style.background = piece.color;

    if (piece.image) {
      const img = document.createElement('img');
      img.src = piece.image;
      img.alt = 'Custom sticker cutout';
      shapeDiv.appendChild(img);
      piece.el.appendChild(shapeDiv);
      return;
    }

    const label = document.createElement('span');
    label.className = 'labeltext';
    label.textContent = piece.text;
    label.style.color = DARK_BG_COLORS.has(piece.color) ? '#fff' : '#19251e';
    shapeDiv.appendChild(label);
    piece.el.appendChild(shapeDiv);
  }

  function addPiece(opts = {}) {
    const piece = {
      id: nextId++,
      x: opts.x ?? 18 + Math.random() * 44,
      y: opts.y ?? 16 + Math.random() * 44,
      size: opts.size ?? 120 + Math.random() * 55,
      rotation: opts.rotation ?? -20 + Math.random() * 40,
      text: opts.text ?? (stickerText?.value.trim() || 'IMASTIK'),
      shape: opts.shape ?? (shapeSelect?.value || 'blob'),
      color: opts.color ?? activeColor,
      image: opts.image || null,
    };

    const el = document.createElement('div');
    el.className = 'piece';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Move or edit sticker: ${piece.text || 'photo sticker'}`);
    piece.el = el;

    stage.appendChild(el);
    pieces.push(piece);
    renderPiece(piece);
    selectPiece(piece);

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      selectPiece(piece);
      el.setPointerCapture(e.pointerId);
      const rect = stage.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const originX = piece.x;
      const originY = piece.y;

      const onMove = (ev) => {
        if (!rect.width || !rect.height) return;
        const maxX = Math.max(5, 100 - (piece.size / rect.width) * 100);
        const maxY = Math.max(5, 100 - (piece.size / rect.height) * 100);
        piece.x = clamp(originX + ((ev.clientX - startX) / rect.width) * 100, 0, maxX);
        piece.y = clamp(originY + ((ev.clientY - startY) / rect.height) * 100, 0, maxY);
        renderPiece(piece);
      };

      const onEnd = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onEnd);
        el.removeEventListener('pointercancel', onEnd);
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onEnd);
      el.addEventListener('pointercancel', onEnd);
    });

    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 5 : 1;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        selectPiece(piece);
        piece.x = clamp(piece.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), 0, 88);
        piece.y = clamp(piece.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0), 0, 88);
        renderPiece(piece);
      }
    });

    return piece;
  }

  // Palette swatches
  if (swatchesEl) {
    swatchesEl.replaceChildren();
    PALETTE.forEach((c) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'swatch';
      swatch.style.background = c;
      swatch.setAttribute('aria-label', `Choose sticker colour ${c}`);
      swatch.addEventListener('click', () => {
        activeColor = c;
        if (selected && !selected.image) {
          selected.color = c;
          renderPiece(selected);
        }
      });
      swatchesEl.appendChild(swatch);
    });
  }

  stickerText?.addEventListener('input', () => {
    if (selected && !selected.image) {
      selected.text = stickerText.value;
      renderPiece(selected);
    }
  });

  shapeSelect?.addEventListener('change', () => {
    if (selected && !selected.image) {
      selected.shape = shapeSelect.value;
      renderPiece(selected);
    }
  });

  $('add')?.addEventListener('click', () => addPiece());

  $('remove')?.addEventListener('click', () => {
    if (!selected) return;
    selected.el.remove();
    pieces = pieces.filter((p) => p !== selected);
    selectPiece(pieces.at(-1) || null);
  });

  $('surprise')?.addEventListener('click', () => {
    for (let i = 0; i < 3; i++) {
      addPiece({
        text: MIX_WORDS[Math.floor(Math.random() * MIX_WORDS.length)],
        shape: ['blob', 'circle', 'square', 'star'][Math.floor(Math.random() * 4)],
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        x: 6 + Math.random() * 62,
        y: 8 + Math.random() * 58,
        size: 105 + Math.random() * 75,
      });
    }
  });

  $('pieceSize')?.addEventListener('input', (e) => {
    if (selected) {
      selected.size = Number(e.target.value);
      renderPiece(selected);
    }
  });

  $('pieceRotate')?.addEventListener('input', (e) => {
    if (selected) {
      selected.rotation = Number(e.target.value);
      renderPiece(selected);
    }
  });

  $('duplicatePiece')?.addEventListener('click', () => {
    if (!selected) return;
    addPiece({
      image: selected.image,
      text: selected.text,
      shape: selected.shape,
      color: selected.color,
      size: selected.size,
      rotation: selected.rotation,
      x: Math.min(75, selected.x + 8),
      y: Math.min(75, selected.y + 8),
    });
  });

  $('centerPiece')?.addEventListener('click', () => {
    if (!selected) return;
    selected.x = 36;
    selected.y = 32;
    renderPiece(selected);
  });

  $('clearBoard')?.addEventListener('click', () => {
    pieces.forEach((p) => p.el.remove());
    pieces = [];
    selected = null;
  });

  stage.addEventListener('dragstart', (e) => e.preventDefault());

  // Starter stickers (scale cleanly on compact mobile viewports)
  const mobileScale = stage.clientWidth && stage.clientWidth < 500 ? 0.68 : 1;
  addPiece({
    text: 'GOOD VIBES',
    x: 8,
    y: 16,
    color: '#ffe04a',
    shape: 'blob',
    size: Math.round(170 * mobileScale),
    rotation: -14,
  });
  addPiece({
    text: 'IMASTIK',
    x: 54,
    y: 12,
    color: '#f04a38',
    shape: 'star',
    size: Math.round(160 * mobileScale),
    rotation: 16,
  });
  addPiece({
    text: 'STAY WEIRD',
    x: 34,
    y: 50,
    color: '#ff9fc6',
    shape: 'circle',
    size: Math.round(150 * mobileScale),
    rotation: 8,
  });

  // Render composite playground canvas for download or attaching to Order
  async function exportBoardCanvas() {
    const c = makeCanvas(1200, 850);
    const out = c.getContext('2d');
    const grad = out.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, '#fff5be');
    grad.addColorStop(1, '#ffe6f0');
    out.fillStyle = grad;
    out.fillRect(0, 0, c.width, c.height);

    const rect = stage.getBoundingClientRect();
    const scale = rect.width ? c.width / rect.width : 1.5;

    for (const piece of pieces) {
      const px = (piece.x / 100) * c.width;
      const py = (piece.y / 100) * c.height;
      const s = piece.size * scale;

      out.save();
      out.translate(px + s / 2, py + s / 2);
      out.rotate((piece.rotation * Math.PI) / 180);

      if (piece.image) {
        const img = new Image();
        img.src = piece.image;
        await new Promise((resolve) => {
          if (img.complete && img.naturalWidth) return resolve();
          img.onload = resolve;
          img.onerror = resolve;
        });
        if (img.naturalWidth && img.naturalHeight) {
          const fit = Math.min(s / img.naturalWidth, s / img.naturalHeight);
          const dw = img.naturalWidth * fit;
          const dh = img.naturalHeight * fit;
          out.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        }
        out.restore();
        continue;
      }

      out.fillStyle = piece.color;
      out.strokeStyle = '#ffffff';
      out.lineWidth = 8;
      out.beginPath();
      if (piece.shape === 'circle') {
        out.arc(0, 0, s * 0.48, 0, Math.PI * 2);
      } else if (piece.shape === 'star') {
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 8;
          const rr = i % 2 ? s * 0.27 : s * 0.49;
          const vx = Math.cos(a) * rr;
          const vy = Math.sin(a) * rr;
          if (i === 0) out.moveTo(vx, vy);
          else out.lineTo(vx, vy);
        }
        out.closePath();
      } else {
        const rr = piece.shape === 'square' ? s * 0.14 : s * 0.32;
        out.roundRect(-s / 2, -s / 2, s, s, rr);
      }
      out.fill();
      if (piece.shape !== 'star') out.stroke();

      out.fillStyle = DARK_BG_COLORS.has(piece.color) ? '#ffffff' : '#19251e';
      out.textAlign = 'center';
      out.textBaseline = 'middle';
      out.font = `700 ${Math.min(33 * scale, s * 0.18)}px Fredoka, "DM Sans", Arial`;
      const words = piece.text.split(' ');
      const lines = [''];
      for (const word of words) {
        const idx = lines.length - 1;
        const candidate = `${lines[idx]} ${word}`.trim();
        if (out.measureText(candidate).width > s * 0.8 && lines[idx]) {
          lines.push(word);
        } else {
          lines[idx] = candidate;
        }
      }
      const shown = lines.slice(0, 4);
      shown.forEach((line, i) => {
        out.fillText(line, 0, (i - (shown.length - 1) / 2) * s * 0.18, s * 0.83);
      });
      out.restore();
    }

    return c;
  }

  $('download')?.addEventListener('click', async () => {
    const exported = await exportBoardCanvas();
    const link = document.createElement('a');
    link.download = 'imastik-playground-design.png';
    link.href = exported.toDataURL('image/png');
    link.click();
  });

  $('attachToOrder')?.addEventListener('click', async () => {
    if (typeof onAttachToOrder !== 'function') return;
    const exported = await exportBoardCanvas();
    const blob = await new Promise((resolve) => exported.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'imastik-playground-design.png', { type: 'image/png' });
    onAttachToOrder(file);
    setStatus('Playground canvas added to Reference Photos below!');
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
  });

  // --- Photo Upload + Cutout Studio ---
  const openPicker = () => {
    try {
      photoUpload?.click();
    } catch {
      setStatus('Unable to open photo picker. Try dropping an image onto the canvas above.');
    }
  };
  photoPickerBtn?.addEventListener('click', openPicker);

  if (photoUpload) {
    ['dragenter', 'dragover'].forEach((type) => {
      stage.addEventListener(type, (e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        stage.classList.add('upload-drag');
      });
    });

    ['dragleave', 'drop'].forEach((type) => {
      stage.addEventListener(type, (e) => {
        e.preventDefault();
        stage.classList.remove('upload-drag');
      });
    });

    stage.addEventListener('drop', (e) => {
      const file = Array.from(e.dataTransfer?.files || [])[0];
      if (!file) return;
      if (!VALID_TYPES.test(file.type) || file.size > MAX_IMAGE_BYTES) {
        setStatus('Please drop a JPG, PNG, or WebP photo under 15 MB.');
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(file);
      photoUpload.files = dt.files;
      photoUpload.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function makeStickerFromEditor() {
    if (!original) return null;
    const w = editCanvas.width;
    const h = editCanvas.height;
    const base = makeCanvas(w, h);
    const b = base.getContext('2d', { willReadFrequently: true });
    b.drawImage(editCanvas, 0, 0);

    const effect = $('photoEffect')?.value || 'original';
    if (effect !== 'original') {
      const im = b.getImageData(0, 0, w, h);
      const p = im.data;
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        if (effect === 'mono') {
          const v = l > 120 ? 245 : 24;
          p[i] = p[i + 1] = p[i + 2] = v;
        } else if (effect === 'pop') {
          if (l > 170) {
            p[i] = 255;
            p[i + 1] = 224;
            p[i + 2] = 74;
          } else if (l > 90) {
            p[i] = 255;
            p[i + 1] = 159;
            p[i + 2] = 198;
          } else {
            p[i] = 200;
            p[i + 1] = 37;
            p[i + 2] = 106;
          }
        } else {
          p[i] = Math.min(255, 110 + l * 0.55);
          p[i + 1] = Math.min(255, 50 + l * 0.45);
          p[i + 2] = Math.min(255, 95 + l * 0.5);
        }
      }
      b.putImageData(im, 0, 0);
    }

    const border = Number($('photoBorder')?.value || 10);
    const pad = border + 8;
    const out = makeCanvas(w + 2 * pad, h + 2 * pad);
    const o = out.getContext('2d');

    if (border) {
      const shadow = makeCanvas(out.width, out.height);
      const sc = shadow.getContext('2d');
      for (let y = -border; y <= border; y += 2) {
        for (let x = -border; x <= border; x += 2) {
          if (x * x + y * y <= border * border) {
            sc.drawImage(base, pad + x, pad + y);
          }
        }
      }
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = '#ffffff';
      sc.fillRect(0, 0, shadow.width, shadow.height);
      o.drawImage(shadow, 0, 0);
    }

    o.drawImage(base, pad, pad);
    return out;
  }

  function updatePreview() {
    const out = makeStickerFromEditor();
    if (!out) return;
    editedURL = out.toDataURL('image/png');
    if (afterImage) afterImage.src = editedURL;
    if ($('borderVal')) $('borderVal').textContent = `${$('photoBorder')?.value || 10}px`;
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreview, 80);
  }

  function drawEditor() {
    if (!original) return;
    ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    ctx.drawImage(original, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    schedulePreview();
  }

  function resetEditorMask() {
    if (!original) return;
    mask = makeCanvas(editCanvas.width, editCanvas.height);
    const m = mask.getContext('2d');
    m.fillStyle = '#ffffff';
    m.fillRect(0, 0, editCanvas.width, editCanvas.height);
    drawEditor();
  }

  function setBrushMode(nextMode) {
    brushMode = nextMode;
    $('eraseMode')?.classList.toggle('active', nextMode === 'erase');
    $('restoreMode')?.classList.toggle('active', nextMode === 'restore');
  }

  function brushAt(x, y) {
    if (!mask) return;
    const m = mask.getContext('2d');
    const r = (Number($('brushSize')?.value || 32) * editCanvas.width) / 700;
    const soft = Number($('brushSoft')?.value || 45) / 100;
    const inner = r * (1 - soft * 0.92);
    const color = brushMode === 'erase' ? '0,0,0' : '255,255,255';
    const grad = m.createRadialGradient(x, y, Math.max(0, inner), x, y, r);
    grad.addColorStop(0, `rgba(${color},1)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    m.save();
    m.globalCompositeOperation = brushMode === 'erase' ? 'destination-out' : 'source-over';
    m.fillStyle = grad;
    m.beginPath();
    m.arc(x, y, r, 0, Math.PI * 2);
    m.fill();
    m.restore();
  }

  function editorPoint(e) {
    const r = editCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * editCanvas.width) / r.width,
      y: ((e.clientY - r.top) * editCanvas.height) / r.height,
    };
  }

  editCanvas.addEventListener('pointerdown', (e) => {
    if (!original) return;
    e.preventDefault();
    painting = true;
    editCanvas.setPointerCapture(e.pointerId);
    lastPaintPoint = editorPoint(e);
    brushAt(lastPaintPoint.x, lastPaintPoint.y);
    drawEditor();
  });

  editCanvas.addEventListener('pointermove', (e) => {
    if (!painting || !lastPaintPoint) return;
    e.preventDefault();
    const p = editorPoint(e);
    const dist = Math.hypot(p.x - lastPaintPoint.x, p.y - lastPaintPoint.y);
    const step = Math.max(1, (Number($('brushSize')?.value || 32) * editCanvas.width) / 2800);
    for (let t = step; t < dist; t += step) {
      const a = t / dist;
      brushAt(lastPaintPoint.x + (p.x - lastPaintPoint.x) * a, lastPaintPoint.y + (p.y - lastPaintPoint.y) * a);
    }
    brushAt(p.x, p.y);
    lastPaintPoint = p;
    drawEditor();
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => {
    editCanvas.addEventListener(ev, () => {
      painting = false;
      lastPaintPoint = null;
    });
  });

  photoUpload?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const first = files[0];
    if (!first) return;

    if (!VALID_TYPES.test(first.type) || first.size > MAX_IMAGE_BYTES) {
      setStatus('Choose a JPG, PNG, or WebP photo under 15 MB.');
      return;
    }

    const job = ++loadingSeq;
    const url = URL.createObjectURL(first);
    setStatus(`Opening ${first.name}…`);

    try {
      const img = new Image();
      await new Promise((ok, no) => {
        img.onload = ok;
        img.onerror = no;
        img.src = url;
      });
      if (job !== loadingSeq) return;

      const scale = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      original = makeCanvas(w, h);
      original.getContext('2d').drawImage(img, 0, 0, w, h);
      editCanvas.width = w;
      editCanvas.height = h;
      if (beforeImage) beforeImage.src = original.toDataURL('image/png');
      photoEditor?.classList.remove('hidden');
      resetEditorMask();
      setBrushMode('erase');

      if (files.length > 1) {
        for (const extra of files.slice(1)) {
          if (!VALID_TYPES.test(extra.type) || extra.size > MAX_IMAGE_BYTES) continue;
          const extraUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(extra);
          });
          if (extraUrl) {
            addPiece({
              image: extraUrl,
              shape: 'photo',
              text: '',
              size: 150,
              x: 10 + ((pieces.length * 17) % 62),
              y: 12 + ((pieces.length * 13) % 55),
            });
          }
        }
        setStatus(`Added ${files.length - 1} photo(s) to the board. Edit the first photo below and tap Place on my canvas.`);
      } else {
        setStatus('Photo ready below. Trim the background or add a white sticker border, then place on canvas.');
      }
    } catch {
      setStatus('Could not read that image. Try JPG, PNG, or WebP.');
    } finally {
      URL.revokeObjectURL(url);
      photoUpload.value = '';
    }
  });

  $('eraseMode')?.addEventListener('click', () => setBrushMode('erase'));
  $('restoreMode')?.addEventListener('click', () => setBrushMode('restore'));
  $('resetCutout')?.addEventListener('click', () => {
    resetEditorMask();
    setStatus('Original photo restored.');
  });
  $('brushSize')?.addEventListener('input', () => {
    if ($('brushValue')) $('brushValue').textContent = $('brushSize').value;
  });
  $('brushSoft')?.addEventListener('input', () => {
    if ($('softValue')) $('softValue').textContent = `${$('brushSoft').value}%`;
  });
  $('photoEffect')?.addEventListener('change', updatePreview);
  $('photoBorder')?.addEventListener('input', updatePreview);
  $('photoCutout')?.addEventListener('input', () => {
    if ($('toleranceVal')) $('toleranceVal').textContent = $('photoCutout').value;
  });

  $('autoCutout')?.addEventListener('click', () => {
    if (!original) return;
    const w = editCanvas.width;
    const h = editCanvas.height;
    const im = original.getContext('2d').getImageData(0, 0, w, h).data;
    const corners = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ].map(([x, y]) => {
      const i = (y * w + x) * 4;
      return [im[i], im[i + 1], im[i + 2]];
    });
    const bg = [0, 1, 2].map((k) => corners.reduce((acc, c) => acc + c[k], 0) / 4);
    const threshold = 12 + Number($('photoCutout')?.value || 38) * 1.05;
    const n = w * h;
    const seen = new Uint8Array(n);
    const q = new Int32Array(n);
    let head = 0;
    let tail = 0;

    const similar = (k) => {
      const i = k * 4;
      return Math.hypot(im[i] - bg[0], im[i + 1] - bg[1], im[i + 2] - bg[2]) < threshold;
    };
    const seed = (k) => {
      if (!seen[k] && similar(k)) {
        seen[k] = 1;
        q[tail++] = k;
      }
    };

    for (let x = 0; x < w; x++) {
      seed(x);
      seed((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      seed(y * w);
      seed(y * w + w - 1);
    }
    while (head < tail) {
      const k = q[head++];
      const x = k % w;
      const y = (k / w) | 0;
      if (x > 0) seed(k - 1);
      if (x < w - 1) seed(k + 1);
      if (y > 0) seed(k - w);
      if (y < h - 1) seed(k + w);
    }

    const m = mask.getContext('2d');
    const d = m.createImageData(w, h);
    for (let k = 0; k < n; k++) {
      const i = k * 4;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      d.data[i + 3] = seen[k] ? 0 : 255;
    }
    m.putImageData(d, 0, 0);
    drawEditor();
    setStatus('Quick cutout complete. Tidy up any edges with Erase or Restore.');
  });

  $('aiRemove')?.addEventListener('click', async () => {
    if (!original) return;
    const job = ++loadingSeq;
    const btn = $('aiRemove');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'AI MODEL LOADING…';
    }
    setStatus('Loading AI background remover…');

    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
      const fn = mod.removeBackground || mod.default;
      if (typeof fn !== 'function') throw new Error('Model unavailable');
      const blob = await new Promise((ok) => original.toBlob(ok, 'image/png'));
      const result = await fn(blob);
      const url = URL.createObjectURL(result);
      const im = new Image();
      await new Promise((ok, no) => {
        im.onload = ok;
        im.onerror = no;
        im.src = url;
      });
      if (job !== loadingSeq) {
        URL.revokeObjectURL(url);
        return;
      }

      const temp = makeCanvas(editCanvas.width, editCanvas.height);
      temp.getContext('2d').drawImage(im, 0, 0, editCanvas.width, editCanvas.height);
      const d = temp.getContext('2d').getImageData(0, 0, editCanvas.width, editCanvas.height).data;
      mask = makeCanvas(editCanvas.width, editCanvas.height);
      const m = mask.getContext('2d');
      const md = m.createImageData(editCanvas.width, editCanvas.height);
      for (let i = 0; i < d.length; i += 4) {
        md.data[i] = md.data[i + 1] = md.data[i + 2] = 255;
        md.data[i + 3] = d[i + 3];
      }
      m.putImageData(md, 0, 0);
      URL.revokeObjectURL(url);
      drawEditor();
      setStatus('AI cutout ready! Fine-tune edges with Erase or Restore.');
    } catch (err) {
      setStatus(
        `AI removal unavailable right now (${err?.message || 'offline'}). Use Quick cutout or Erase/Restore brushes!`,
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Remove background with AI';
      }
    }
  });

  $('addPhoto')?.addEventListener('click', () => {
    if (!editedURL) {
      setStatus('Upload a photo first.');
      return;
    }
    addPiece({
      image: editedURL,
      shape: 'photo',
      text: '',
      size: 175,
      rotation: -7,
      x: 12 + ((pieces.length * 13) % 60),
      y: 14 + ((pieces.length * 11) % 52),
    });
    setStatus('Photo sticker placed on your canvas!');
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('downloadSticker')?.addEventListener('click', () => {
    const c = makeStickerFromEditor();
    if (!c) return;
    const a = document.createElement('a');
    a.download = 'imastik-cutout.png';
    a.href = c.toDataURL('image/png');
    a.click();
  });
}
