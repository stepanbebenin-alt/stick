/**
 * Public Sticker Archive / Store module for imastik.
 * Starter showcase concepts are rendered as die-cut SVG vinyl stickers and
 * let anyone pre-fill the order form in packs of 5 (€5), 10 (€8), or 20 (€15).
 */

import { calculateStickerPrice } from './order-form.js?v=6';

const PACK_OPTIONS = [5, 10, 20];

export const STORE_DESIGNS = [
  {
    id: 'coffee-powered',
    title: 'Espresso Bug',
    category: 'coffee',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'For laptops, notebooks & iced latte tumblers.',
    tilt: '-2.2deg',
    accentBg: '#ffe89c',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Espresso Bug sticker illustration">
        <defs>
          <filter id="vinylShadow1" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow1)">
          <path d="M40 60 C34 45 48 28 66 32 C76 18 104 18 114 32 C132 28 146 45 140 60 L150 66 C165 72 165 104 146 112 L136 146 C130 158 116 164 90 164 C64 164 50 158 44 146 L36 112 C28 96 28 74 40 60 Z" fill="#ffffff" stroke="#19251e" stroke-width="4" stroke-linejoin="round"/>
          <path d="M128 78 C148 76 150 104 130 108" fill="none" stroke="#19251e" stroke-width="10" stroke-linecap="round"/>
          <path d="M128 78 C148 76 150 104 130 108" fill="none" stroke="#ff9fc6" stroke-width="5" stroke-linecap="round"/>
          <path d="M48 68 L132 68 L122 140 C118 150 106 154 90 154 C74 154 62 150 58 140 Z" fill="#ffe04a" stroke="#19251e" stroke-width="5" stroke-linejoin="round"/>
          <ellipse cx="90" cy="68" rx="42" ry="11" fill="#4b2c20" stroke="#19251e" stroke-width="4.5"/>
          <path d="M68 48 C65 39 74 36 72 28 M91 45 C88 35 98 32 95 23 M112 48 C109 39 118 36 116 28" fill="none" stroke="#f04a38" stroke-width="4" stroke-linecap="round"/>
          <circle cx="75" cy="103" r="6" fill="#19251e"/>
          <circle cx="105" cy="103" r="6" fill="#19251e"/>
          <circle cx="67" cy="112" r="5" fill="#ff74ad"/>
          <circle cx="113" cy="112" r="5" fill="#ff74ad"/>
          <path d="M81 114 Q90 123 99 114" fill="none" stroke="#19251e" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M90 126 L94 134 L103 135 L96 141 L98 150 L90 145 L82 150 L84 141 L77 135 L86 134 Z" fill="#2d94ff" stroke="#19251e" stroke-width="2.5" stroke-linejoin="round"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'low-battery-cat',
    title: '0% Social Battery',
    category: 'memes',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'Sleepy cat inside a drained battery badge.',
    tilt: '2.1deg',
    accentBg: '#ffd6e7',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="0% Social Battery sticker illustration">
        <defs>
          <filter id="vinylShadow2" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow2)">
          <rect x="20" y="30" width="134" height="116" rx="22" fill="#ffffff" stroke="#19251e" stroke-width="4"/>
          <rect x="148" y="55" width="18" height="44" rx="8" fill="#ffffff" stroke="#19251e" stroke-width="4"/>
          <rect x="28" y="38" width="118" height="76" rx="16" fill="#fff9e9" stroke="#19251e" stroke-width="4.5"/>
          <rect x="148" y="62" width="11" height="30" rx="4" fill="#19251e"/>
          <rect x="35" y="45" width="22" height="62" rx="9" fill="#f04a38" stroke="#19251e" stroke-width="3"/>
          <polygon points="72,58 80,41 91,55" fill="#d7f26b" stroke="#19251e" stroke-width="3.5" stroke-linejoin="round"/>
          <polygon points="118,58 110,41 99,55" fill="#d7f26b" stroke="#19251e" stroke-width="3.5" stroke-linejoin="round"/>
          <ellipse cx="95" cy="80" rx="26" ry="22" fill="#d7f26b" stroke="#19251e" stroke-width="4"/>
          <path d="M80 76 Q85 81 90 76 M100 76 Q105 81 110 76" fill="none" stroke="#19251e" stroke-width="3.5" stroke-linecap="round"/>
          <path d="M91 86 L95 90 L99 86" fill="none" stroke="#19251e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="87" y="135" text-anchor="middle" font-family="Archivo Black, Arial, sans-serif" font-size="14" font-weight="900" fill="#19251e">0% SOCIAL</text>
        </g>
      </svg>
    `,
  },
  {
    id: 'sticky-bulb',
    title: 'Peel-Bulb Mascot',
    category: 'cute',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'Bold studio peel bulb for cases, tablets & bikes.',
    tilt: '-1.6deg',
    accentBg: '#fff2a6',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Peel-Bulb Mascot sticker illustration">
        <defs>
          <filter id="vinylShadow3" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow3)">
          <circle cx="90" cy="90" r="70" fill="#ffffff" stroke="#19251e" stroke-width="4"/>
          <circle cx="90" cy="90" r="61" fill="#2d94ff" stroke="#19251e" stroke-width="4"/>
          <path d="M90 42 C67 42 52 58 52 79 C52 94 61 104 68 113 L68 126 C68 134 77 140 90 140 C103 140 112 134 112 126 L112 113 C119 104 128 94 128 79 C128 72 125 65 121 59 L99 44 C96 42 93 42 90 42 Z" fill="#ffe04a" stroke="#19251e" stroke-width="5" stroke-linejoin="round"/>
          <path d="M100 44 C100 62 112 72 127 72 C123 58 113 48 100 44 Z" fill="#fff9e9" stroke="#19251e" stroke-width="4.5" stroke-linejoin="round"/>
          <circle cx="77" cy="88" r="4.5" fill="#19251e"/>
          <circle cx="101" cy="88" r="4.5" fill="#19251e"/>
          <path d="M82 99 Q89 107 96 99" fill="none" stroke="#19251e" stroke-width="4" stroke-linecap="round"/>
          <path d="M74 126 L106 126" stroke="#19251e" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M40 50 L44 58 L52 60 L45 66 L47 74 L40 69 L33 74 L35 66 L28 60 L36 58 Z" fill="#ffe04a" stroke="#19251e" stroke-width="2.5"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'brain-tabs',
    title: '37 Tabs Open',
    category: 'coffee',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'Retro desktop window for study laptops & tablets.',
    tilt: '2.4deg',
    accentBg: '#ffcbe1',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="37 Tabs Open sticker illustration">
        <defs>
          <filter id="vinylShadow4" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow4)">
          <rect x="20" y="34" width="140" height="112" rx="18" fill="#ffffff" stroke="#19251e" stroke-width="4"/>
          <rect x="28" y="42" width="124" height="96" rx="12" fill="#fff9e9" stroke="#19251e" stroke-width="4.5"/>
          <path d="M28 54 C28 47 33 42 40 42 L140 42 C147 42 152 47 152 54 L152 68 L28 68 Z" fill="#ff9fc6" stroke="#19251e" stroke-width="4"/>
          <circle cx="44" cy="55" r="4.5" fill="#f04a38" stroke="#19251e" stroke-width="2"/>
          <circle cx="59" cy="55" r="4.5" fill="#ffe04a" stroke="#19251e" stroke-width="2"/>
          <circle cx="74" cy="55" r="4.5" fill="#d7f26b" stroke="#19251e" stroke-width="2"/>
          <text x="90" y="96" text-anchor="middle" font-family="Archivo Black, Arial, sans-serif" font-size="24" font-weight="900" fill="#19251e">37 TABS</text>
          <text x="79" y="117" text-anchor="middle" font-family="DM Mono, monospace" font-size="11.5" font-weight="700" fill="#19251e">NO MUSIC · HELP</text>
          <polygon points="139,116 161,126 150,131 155,144 147,147 142,134 133,141" fill="#2d94ff" stroke="#19251e" stroke-width="3" stroke-linejoin="round"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'frog-chill',
    title: 'Zero Thoughts Froggy',
    category: 'cute',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'Moss-green sprouted frog for bottles & bikes.',
    tilt: '-2.3deg',
    accentBg: '#ffe89c',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zero Thoughts Froggy sticker illustration">
        <defs>
          <filter id="vinylShadow5" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow5)">
          <path d="M52 54 C42 54 32 66 36 80 C26 94 28 122 50 138 C70 152 110 152 130 138 C152 122 154 94 144 80 C148 66 138 54 128 54 C118 54 111 60 107 68 C100 66 96 65 92 65 L92 48 C106 46 112 36 104 28 C96 22 86 29 88 42 C82 28 70 26 66 35 C64 43 72 48 84 48 L84 65 C79 65 75 66 73 68 C69 60 62 54 52 54 Z" fill="#ffffff" stroke="#19251e" stroke-width="4" stroke-linejoin="round"/>
          <path d="M89 68 L89 48" stroke="#19251e" stroke-width="4" stroke-linecap="round"/>
          <ellipse cx="77" cy="41" rx="10" ry="6" transform="rotate(-24 77 41)" fill="#d7f26b" stroke="#19251e" stroke-width="3.5"/>
          <ellipse cx="101" cy="41" rx="10" ry="6" transform="rotate(24 101 41)" fill="#d7f26b" stroke="#19251e" stroke-width="3.5"/>
          <circle cx="58" cy="75" r="15" fill="#92dd5a" stroke="#19251e" stroke-width="4.5"/>
          <circle cx="122" cy="75" r="15" fill="#92dd5a" stroke="#19251e" stroke-width="4.5"/>
          <ellipse cx="90" cy="108" rx="54" ry="37" fill="#92dd5a" stroke="#19251e" stroke-width="4.5"/>
          <circle cx="58" cy="75" r="8" fill="#ffffff" stroke="#19251e" stroke-width="3"/>
          <circle cx="122" cy="75" r="8" fill="#ffffff" stroke="#19251e" stroke-width="3"/>
          <circle cx="59" cy="75" r="4" fill="#19251e"/>
          <circle cx="121" cy="75" r="4" fill="#19251e"/>
          <ellipse cx="56" cy="108" rx="9" ry="5.5" fill="#ff9fc6"/>
          <ellipse cx="124" cy="108" rx="9" ry="5.5" fill="#ff9fc6"/>
          <path d="M77 109 Q90 120 103 109" fill="none" stroke="#19251e" stroke-width="4.5" stroke-linecap="round"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'chaos-star',
    title: 'Certified Chaos',
    category: 'memes',
    badge: 'Club concept',
    credit: 'By imastik',
    blurb: 'Retro oval stamp for phone cases & helmets.',
    tilt: '1.9deg',
    accentBg: '#ffd6e7',
    svg: `
      <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Certified Chaos sticker illustration">
        <defs>
          <filter id="vinylShadow6" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#19251e" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#vinylShadow6)" transform="rotate(-7 90 90)">
          <ellipse cx="90" cy="90" rx="78" ry="52" fill="#ffffff" stroke="#19251e" stroke-width="4"/>
          <ellipse cx="90" cy="90" rx="70" ry="44" fill="#f04a38" stroke="#19251e" stroke-width="4.5"/>
          <ellipse cx="90" cy="90" rx="61" ry="35" fill="none" stroke="#fff9e9" stroke-width="2.5" stroke-dasharray="6 4"/>
          <text x="90" y="75" text-anchor="middle" font-family="DM Mono, monospace" font-size="9.5" font-weight="700" fill="#ffe04a" letter-spacing="1.4">STUDIO APPROVED</text>
          <text x="90" y="98" text-anchor="middle" font-family="Archivo Black, Arial, sans-serif" font-size="18.5" font-weight="900" fill="#ffffff">CERTIFIED</text>
          <text x="90" y="116" text-anchor="middle" font-family="Archivo Black, Arial, sans-serif" font-size="16.5" font-weight="900" fill="#ffe04a">CHAOS</text>
        </g>
      </svg>
    `,
  },
];

export function parseSvgNode(svgString) {
  const doc = new DOMParser().parseFromString(svgString.trim(), 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') return null;
  return document.importNode(root, true);
}

export function initStore({ onSelectDesign } = {}) {
  const grid = document.getElementById('storeGrid');
  const filterButtons = document.querySelectorAll('.store-filter[data-filter]');
  if (!grid) return null;

  let activeFilter = 'all';

  function createDesignCard(design) {
    let selectedPack = 5;

    const card = document.createElement('article');
    card.className = 'store-card';
    card.dataset.category = design.category;
    card.dataset.designId = design.id;

    const topMeta = document.createElement('div');
    topMeta.className = 'store-card-meta';

    const badge = document.createElement('span');
    badge.className = 'store-badge';
    badge.textContent = design.badge;

    const credit = document.createElement('span');
    credit.className = 'store-credit';
    credit.textContent = design.credit;
    topMeta.append(badge, credit);

    const stage = document.createElement('div');
    stage.className = 'store-art';
    stage.style.setProperty('--sticker-bg', design.accentBg);
    stage.style.setProperty('--sticker-tilt', design.tilt);

    const stickerWrap = document.createElement('div');
    stickerWrap.className = 'store-sticker-wrap';
    const svgNode = parseSvgNode(design.svg);
    if (svgNode) stickerWrap.appendChild(svgNode);
    stage.appendChild(stickerWrap);

    const body = document.createElement('div');
    body.className = 'store-card-body';

    const title = document.createElement('h3');
    title.textContent = design.title;

    const blurb = document.createElement('p');
    blurb.textContent = design.blurb;

    const packRow = document.createElement('div');
    packRow.className = 'store-pack-row';
    packRow.setAttribute('role', 'group');
    packRow.setAttribute('aria-label', `Choose copy pack for ${design.title}`);

    const orderBtn = document.createElement('button');
    orderBtn.type = 'button';
    orderBtn.className = 'store-order-btn';

    const syncOrderButton = () => {
      const price = calculateStickerPrice(selectedPack);
      orderBtn.textContent = `Order ${selectedPack} copies · €${price} ↗`;
    };

    const packBtns = PACK_OPTIONS.map((qty) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `store-pack-btn${qty === selectedPack ? ' is-active' : ''}`;
      btn.textContent = `${qty}× €${calculateStickerPrice(qty)}`;
      btn.addEventListener('click', () => {
        selectedPack = qty;
        packBtns.forEach((b, idx) => b.classList.toggle('is-active', PACK_OPTIONS[idx] === qty));
        syncOrderButton();
      });
      packRow.appendChild(btn);
      return btn;
    });

    syncOrderButton();

    orderBtn.addEventListener('click', () => {
      onSelectDesign?.(design, selectedPack);
    });

    body.append(title, blurb, packRow, orderBtn);
    card.append(topMeta, stage, body);
    return card;
  }

  function renderGrid() {
    const items =
      activeFilter === 'all' ? STORE_DESIGNS : STORE_DESIGNS.filter((d) => d.category === activeFilter);
    grid.replaceChildren(...items.map((design) => createDesignCard(design)));
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter || 'all';
      filterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      renderGrid();
    });
  });

  renderGrid();
  return { renderGrid };
}
