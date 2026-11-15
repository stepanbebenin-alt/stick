/**
 * Free-range draggable stickers across the page (using Store sticker designs).
 * Visitors can peel & drag stickers anywhere inside <main> without affecting
 * scrollbars or form inputs.
 */

import { STORE_DESIGNS, parseSvgNode } from './store.js?v=6';

const INITIAL_SLOTS = [
  { id: 'sticky-bulb', rx: 0.72, ry: 0.24, angle: -8 },
  { id: 'coffee-powered', rx: 0.87, ry: 0.44, angle: 9 },
  { id: 'low-battery-cat', rx: 0.68, ry: 0.66, angle: -6 },
  { id: 'certified-chaos', rx: 0.85, ry: 0.78, angle: 7, fallbackId: 'chaos-star' },
];

export function initStickerDrag() {
  const main = document.querySelector('main');
  const layer = document.getElementById('siteStickerLayer');
  const hero = document.getElementById('top');
  const heroInner = hero?.querySelector('.hero-inner');
  const addBtn = document.getElementById('addPageSticker');
  const resetBtn = document.getElementById('resetPageStickers');

  if (!main || !layer || !hero) return null;

  let topZ = 2;
  let extraIndex = 0;
  const activeStickers = [];

  function findDesign(id, fallbackId) {
    return (
      STORE_DESIGNS.find((d) => d.id === id) ||
      (fallbackId && STORE_DESIGNS.find((d) => d.id === fallbackId)) ||
      STORE_DESIGNS[0]
    );
  }

  function clampCoords(el, x, y) {
    const mainWidth = main.clientWidth;
    const mainHeight = main.scrollHeight;
    const w = el.offsetWidth || 110;
    const h = el.offsetHeight || 110;
    return {
      x: Math.round(Math.max(8, Math.min(Math.max(8, mainWidth - w - 8), x))),
      y: Math.round(Math.max(8, Math.min(Math.max(8, mainHeight - h - 8), y))),
    };
  }

  function setPosition(el, x, y) {
    const pos = clampCoords(el, x, y);
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y}px`;
  }

  function getInitialCoords(slot, index, size) {
    const mainRect = main.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    const cta = heroInner?.querySelector('.cta');
    const p = heroInner?.querySelector('p');
    const h1 = heroInner?.querySelector('h1');

    const heroLeft = heroRect.left - mainRect.left;
    const heroTop = heroRect.top - mainRect.top;
    const isDesktop = heroRect.width >= 900;

    if (isDesktop && heroInner) {
      const textRight =
        Math.max(
          h1?.getBoundingClientRect().right || 0,
          p?.getBoundingClientRect().right || 0,
          cta?.getBoundingClientRect().right || 0,
        ) - mainRect.left;
      const safeLeft = Math.max(textRight + 24, heroLeft + heroRect.width * 0.56);
      const maxLeft = Math.max(safeLeft, heroLeft + heroRect.width - size - 24);
      const t = (slot.rx - 0.65) / 0.25;
      const x = safeLeft + Math.max(0, Math.min(1, t)) * (maxLeft - safeLeft);
      const y = heroTop + Math.max(24, Math.min(heroRect.height - size - 24, heroRect.height * slot.ry - size / 2));
      return { x, y };
    }

    // Mobile / tablet: park 2 compact stickers cleanly in lower-right open area below CTA
    const controls = heroInner?.querySelector('.hero-sticker-controls');
    const bottomBarrier =
      (controls?.getBoundingClientRect().bottom || cta?.getBoundingClientRect().bottom || heroRect.bottom - 110) -
      mainRect.top;
    const mobileX = heroLeft + heroRect.width - (index + 1) * (size + 10) - 10;
    const mobileY = Math.max(bottomBarrier + 10, heroTop + heroRect.height - size - 16);
    return { x: mobileX, y: mobileY };
  }

  function attachPointerDrag(el) {
    let dragging = false;
    let startOffsetX = 0;
    let startOffsetY = 0;

    el.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      el.dataset.moved = '1';
      el.classList.add('is-dragging');
      el.style.zIndex = String(++topZ);
      resetBtn?.classList.remove('hidden');

      const rect = el.getBoundingClientRect();
      startOffsetX = e.clientX - rect.left;
      startOffsetY = e.clientY - rect.top;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture isn't supported cleanly in automated tests
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const mainRect = main.getBoundingClientRect();
      const targetX = e.clientX - mainRect.left - startOffsetX;
      const targetY = e.clientY - mainRect.top - startOffsetY;
      setPosition(el, targetX, targetY);
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 16;
      const curX = Number.parseFloat(el.style.left || '0');
      const curY = Number.parseFloat(el.style.top || '0');
      if (e.key === 'ArrowLeft') setPosition(el, curX - step, curY);
      else if (e.key === 'ArrowRight') setPosition(el, curX + step, curY);
      else if (e.key === 'ArrowUp') setPosition(el, curX, curY - step);
      else if (e.key === 'ArrowDown') setPosition(el, curX, curY + step);
      else return;

      e.preventDefault();
      el.dataset.moved = '1';
      resetBtn?.classList.remove('hidden');
    });
  }

  function createStickerElement(design, angle, slotMeta = null, extra = false) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'peel-sticker';
    el.dataset.designId = design.id;
    el.dataset.extra = extra ? '1' : '0';
    el.style.setProperty('--peel-angle', `${angle}deg`);
    el.style.zIndex = String(++topZ);
    el.setAttribute('aria-label', `Draggable ${design.title} sticker — drag anywhere or use arrow keys`);
    el.title = `Drag ${design.title} anywhere on the site`;

    const svgNode = parseSvgNode(design.svg);
    if (svgNode) {
      svgNode.removeAttribute('role');
      svgNode.setAttribute('aria-hidden', 'true');
      svgNode.querySelectorAll('defs').forEach((d) => d.remove());
      svgNode.querySelectorAll('[filter]').forEach((node) => node.removeAttribute('filter'));
      el.appendChild(svgNode);
    }

    attachPointerDrag(el);
    layer.appendChild(el);
    activeStickers.push({ el, slotMeta, extra });
    return el;
  }

  function layoutInitialStickers() {
    const isDesktop = hero.clientWidth >= 900;
    const size = isDesktop ? Math.min(138, Math.max(106, Math.round(hero.clientWidth * 0.1))) : 80;
    activeStickers.forEach(({ el, slotMeta, extra }, index) => {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      if (extra) return;
      if (!isDesktop && index >= 2) {
        el.classList.add('is-mobile-hidden');
        return;
      }
      el.classList.remove('is-mobile-hidden');
      if (el.dataset.moved === '1') {
        const curX = Number.parseFloat(el.style.left || '0');
        const curY = Number.parseFloat(el.style.top || '0');
        setPosition(el, curX, curY);
        return;
      }
      if (slotMeta) {
        const pos = getInitialCoords(slotMeta, index, size);
        setPosition(el, pos.x, pos.y);
      }
    });
  }

  INITIAL_SLOTS.forEach((slot, index) => {
    const design = findDesign(slot.id, slot.fallbackId);
    createStickerElement(design, slot.angle, { ...slot, index }, false);
  });

  layoutInitialStickers();

  window.addEventListener('resize', layoutInitialStickers, { passive: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(layoutInitialStickers).catch(() => {});
  }

  addBtn?.addEventListener('click', () => {
    const design = STORE_DESIGNS[extraIndex % STORE_DESIGNS.length];
    const angle = (extraIndex % 2 === 0 ? -1 : 1) * (4 + (extraIndex % 5) * 2);
    extraIndex += 1;

    const isDesktop = hero.clientWidth >= 900;
    const size = isDesktop ? 124 : 84;
    const el = createStickerElement(design, angle, null, true);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;

    const mainRect = main.getBoundingClientRect();
    const spawnX = (hero.clientWidth >= 900 ? hero.clientWidth * 0.62 : hero.clientWidth * 0.56) + ((extraIndex * 29) % 110);
    const spawnY = Math.max(24, window.scrollY - mainRect.top + window.innerHeight * 0.36 + ((extraIndex * 23) % 80));
    setPosition(el, spawnX, spawnY);
    resetBtn?.classList.remove('hidden');
  });

  resetBtn?.addEventListener('click', () => {
    for (let i = activeStickers.length - 1; i >= 0; i -= 1) {
      if (activeStickers[i].extra) {
        activeStickers[i].el.remove();
        activeStickers.splice(i, 1);
      } else {
        delete activeStickers[i].el.dataset.moved;
      }
    }
    resetBtn.classList.add('hidden');
    layoutInitialStickers();
  });

  return { layoutInitialStickers };
}
