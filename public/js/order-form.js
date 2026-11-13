/**
 * Order form controller for Sticky Club.
 * Handles quantity & pricing sync, reference photo dropzone + Sticker Lab attachments,
 * napkin sketch canvas, microphone voice notes, and mailto / server submission modes.
 */

const VALID_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_MAX_PHOTOS = 8;
const DEFAULT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export function calculateStickerPrice(quantity) {
  const n = Math.max(1, Math.min(100, Number.parseInt(quantity, 10) || 1));
  if (n === 1) return 3;
  return 5 + (n - 2) * 1.5;
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
  const sketchUndoBtn = document.getElementById('sketchUndo');
  const sketchClearBtn = document.getElementById('sketchClear');
  const sketchSaveLink = document.getElementById('sketchSave');
  const penButtons = document.querySelectorAll('.pen-dot[data-pen]');

  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const attachmentReminder = document.getElementById('attachmentReminder');
  const errorBox = document.getElementById('formError');
  const resultBox = document.getElementById('orderResult');

  if (!form) return null;

  let qty = 1;
  let config = {
    teamEmail: '',
    hasTeamEmail: false,
    orderMode: 'mailto',
    maxPhotos: DEFAULT_MAX_PHOTOS,
    maxFileSizeBytes: DEFAULT_MAX_FILE_BYTES,
  };

  // Reference photos (and optional Sticker Lab mockup)
  // Each item: { file: File, url: string, isLabMockup: boolean }
  let picked = [];

  // Voice recording state
  let recorder = null;
  let stream = null;
  let voiceParts = [];
  let voiceStart = 0;
  let voiceInterval = null;
  let voiceUrl = null;
  let voiceBlob = null;
  let voiceFilename = 'sticky-club-voice-note.webm';

  // Napkin sketch state
  const sketchCtx = napkinCanvas?.getContext('2d');
  const sketchUndoStack = [];
  let sketchDrawing = false;
  let sketchLast = null;
  let sketchColor = '#294b38';
  let hasSketch = false;

  // --- Config fetch ---
  fetch('/api/config')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      config = { ...config, ...data };
      if (config.orderMode === 'server') {
        if (submitBtnText) submitBtnText.textContent = 'SEND MY ORDER';
        if (attachmentReminder) {
          attachmentReminder.textContent =
            'Your uploaded photos, Sticker Lab mockup, napkin sketch, and voice note will be sent directly with your order.';
        }
      }
    })
    .catch(() => {
      // Fallback to default mailto config when offline
    });

  // --- Quantity & pricing ---
  function setQuantity(nextQty) {
    qty = Math.max(1, Math.min(100, Number.parseInt(nextQty, 10) || 1));
    const totalFormatted = formatEuro(calculateStickerPrice(qty));
    if (qtyNum) qtyNum.textContent = String(qty);
    if (totalEl) totalEl.textContent = totalFormatted;
    if (summaryLabel) {
      summaryLabel.textContent = `Your custom sticker · ${qty} ${qty === 1 ? 'piece' : 'pieces'}`;
    }
    if (summaryPrice) summaryPrice.textContent = totalFormatted;

    priceCards.forEach((card) => {
      const cardQty = Number.parseInt(card.dataset.quantity || '1', 10);
      const selected = cardQty === 3 ? qty >= 3 : qty === cardQty;
      card.classList.toggle('is-selected', selected);
    });
  }

  minusBtn?.addEventListener('click', () => setQuantity(qty - 1));
  plusBtn?.addEventListener('click', () => setQuantity(qty + 1));

  priceCards.forEach((card) => {
    const select = () => {
      setQuantity(Number.parseInt(card.dataset.quantity || '1', 10));
      document.getElementById('order')?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
      });
    };
    card.addEventListener('click', select);
  });

  setQuantity(1);

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

      if (entry.isLabMockup) {
        const badge = document.createElement('span');
        badge.className = 'ref-badge';
        badge.textContent = 'MOCKUP';
        item.appendChild(badge);
      }

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
      fileInfo.textContent =
        `Add any photos, Sticker Lab mockups, or inspiration — they are optional.${extraNotice}`;
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
          !x.isLabMockup &&
          x.file.name === file.name &&
          x.file.size === file.size &&
          x.file.lastModified === file.lastModified,
      );
      if (!duplicate) {
        picked.push({ file, url: URL.createObjectURL(file), isLabMockup: false });
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

  function attachLabMockup(file, ideaSuggestion = '') {
    // Replace any earlier Sticker Lab mockup so repeated edits stay tidy
    const prevIdx = picked.findIndex((x) => x.isLabMockup);
    if (prevIdx >= 0) {
      URL.revokeObjectURL(picked[prevIdx].url);
      picked.splice(prevIdx, 1);
    }
    if (picked.length >= config.maxPhotos) {
      const removed = picked.pop();
      if (removed) URL.revokeObjectURL(removed.url);
    }
    picked.unshift({ file, url: URL.createObjectURL(file), isLabMockup: true });
    refreshGallery();

    if (ideaInput && !ideaInput.value.trim() && ideaSuggestion) {
      ideaInput.value = ideaSuggestion;
      refreshProgress();
    }

    document.getElementById('order')?.scrollIntoView({
      behavior: reducedMotion ? 'instant' : 'smooth',
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
        voiceFilename = `sticky-club-voice-note.${ext}`;
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

  // --- Napkin Sketch Canvas ---
  function fillSketchBackground() {
    if (!sketchCtx || !napkinCanvas) return;
    sketchCtx.fillStyle = '#fffdf5';
    sketchCtx.fillRect(0, 0, napkinCanvas.width, napkinCanvas.height);
  }

  function pushSketchUndo() {
    if (!sketchCtx || !napkinCanvas) return;
    if (sketchUndoStack.length >= 20) sketchUndoStack.shift();
    sketchUndoStack.push({
      image: sketchCtx.getImageData(0, 0, napkinCanvas.width, napkinCanvas.height),
      hadSketch: hasSketch,
    });
  }

  function getSketchPoint(e) {
    const r = napkinCanvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * napkinCanvas.width) / r.width,
      y: ((e.clientY - r.top) * napkinCanvas.height) / r.height,
    };
  }

  if (napkinCanvas && sketchCtx) {
    fillSketchBackground();

    napkinCanvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      pushSketchUndo();
      sketchDrawing = true;
      hasSketch = true;
      sketchLast = getSketchPoint(e);
      napkinCanvas.setPointerCapture(e.pointerId);
      sketchCtx.beginPath();
      sketchCtx.arc(sketchLast.x, sketchLast.y, 2.4, 0, Math.PI * 2);
      sketchCtx.fillStyle = sketchColor;
      sketchCtx.fill();
    });

    napkinCanvas.addEventListener('pointermove', (e) => {
      if (!sketchDrawing) return;
      e.preventDefault();
      const p = getSketchPoint(e);
      sketchCtx.beginPath();
      sketchCtx.moveTo(sketchLast.x, sketchLast.y);
      sketchCtx.lineTo(p.x, p.y);
      sketchCtx.lineWidth = 4.6;
      sketchCtx.strokeStyle = sketchColor;
      sketchCtx.lineCap = 'round';
      sketchCtx.lineJoin = 'round';
      sketchCtx.stroke();
      sketchLast = p;
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => {
      napkinCanvas.addEventListener(ev, () => {
        sketchDrawing = false;
      });
    });

    penButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        sketchColor = btn.dataset.pen || '#294b38';
        penButtons.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });

    sketchUndoBtn?.addEventListener('click', () => {
      const snap = sketchUndoStack.pop();
      if (!snap) return;
      sketchCtx.putImageData(snap.image, 0, 0);
      hasSketch = snap.hadSketch;
    });

    sketchClearBtn?.addEventListener('click', () => {
      pushSketchUndo();
      fillSketchBackground();
      hasSketch = false;
    });

    sketchSaveLink?.addEventListener('click', (e) => {
      e.currentTarget.href = napkinCanvas.toDataURL('image/png');
    });
  }

  function getSketchBlob() {
    if (!napkinCanvas || !hasSketch) return Promise.resolve(null);
    return new Promise((resolve) => {
      napkinCanvas.toBlob((blob) => resolve(blob), 'image/png');
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

  function buildOrderSummaryText({ name, email, idea, sharePermission }) {
    const price = formatEuro(calculateStickerPrice(qty));
    const lines = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Quantity: ${qty}`,
      `Estimated price: ${price}`,
      '',
      `Idea: ${idea || '(See attached photos / sketch / voice note)'}`,
      '',
      `Timelapse contact: ${
        sharePermission ? 'Yes — you may contact me; separate approval required before sharing.' : 'No'
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

  async function renderMailtoResult({ name, email, idea, sharePermission }) {
    if (!resultBox) return;
    const subjectText = `Sticky Club sticker request — ${name}`;
    const bodyText = buildOrderSummaryText({ name, email, idea, sharePermission });
    const recipient = config.hasTeamEmail ? config.teamEmail : '';
    const mailtoHref = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
      subjectText,
    )}&body=${encodeURIComponent(bodyText)}`;

    resultBox.replaceChildren();
    resultBox.classList.remove('hidden');

    const heading = document.createElement('h4');
    heading.textContent = 'Your sticker request draft is ready!';

    const copy = document.createElement('p');
    copy.textContent = config.hasTeamEmail
      ? `Click "Open Email App" below to send your request to ${config.teamEmail}. Don’t forget to attach any downloaded files!`
      : 'Click "Open Email App" and enter the Sticky Club team email address (or set TEAM_EMAIL in Render environment variables so it fills automatically).';

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
    resultBox.append(heading, copy, actions);

    // Quick-download helpers for attachments so users don't lose anything
    const downloads = document.createElement('div');
    downloads.className = 'result-downloads';

    if (hasSketch && napkinCanvas) {
      const a = document.createElement('a');
      a.className = 'result-btn';
      a.href = napkinCanvas.toDataURL('image/png');
      a.download = 'sticky-club-sketch.png';
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

    const labItem = picked.find((p) => p.isLabMockup);
    if (labItem) {
      const a = document.createElement('a');
      a.className = 'result-btn';
      a.href = labItem.url;
      a.download = 'sticky-club-mockup.png';
      a.textContent = 'Download Lab Mockup PNG';
      downloads.appendChild(a);
    }

    if (downloads.childElementCount > 0) {
      const attachHint = document.createElement('p');
      attachHint.textContent = 'Quick downloads to attach to your email:';
      resultBox.append(attachHint, downloads);
    }

    resultBox.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'nearest' });

    if (config.hasTeamEmail) {
      window.location.href = mailtoHref;
    }
  }

  async function submitToServer({ name, email, idea, sharePermission }) {
    const fd = new FormData();
    fd.set('name', name);
    fd.set('email', email);
    fd.set('idea', idea);
    fd.set('quantity', String(qty));
    fd.set('sharePermission', sharePermission ? 'yes' : 'no');

    picked.forEach((entry) => {
      if (entry.isLabMockup) {
        fd.append('labMockup', entry.file, entry.file.name);
      } else {
        fd.append('photos', entry.file, entry.file.name);
      }
    });

    const sketchBlob = await getSketchBlob();
    if (sketchBlob) {
      fd.append('sketch', sketchBlob, 'sticky-club-sketch.png');
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
      resultBox.replaceChildren();
      resultBox.classList.remove('hidden');

      const heading = document.createElement('h4');
      heading.textContent = 'Order received!';

      const details = document.createElement('p');
      details.textContent = `Reference ID: ${data.orderId} · ${data.quantity} sticker${
        data.quantity === 1 ? '' : 's'
      } (${data.estimatedPriceFormatted}) · ${data.filesCount} attachment${
        data.filesCount === 1 ? '' : 's'
      } uploaded.`;

      resultBox.append(heading, details);
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

    if (submitBtn) submitBtn.disabled = true;
    try {
      if (config.orderMode === 'server') {
        await submitToServer({ name, email, idea, sharePermission });
      } else {
        await renderMailtoResult({ name, email, idea, sharePermission });
      }
    } catch (err) {
      showError(err?.message || 'Something went wrong while preparing your order.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  return {
    setQuantity,
    attachLabMockup,
  };
}
