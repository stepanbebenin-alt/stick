# STICKY CLUB — Render Edition

Custom laptop stickers web app rebuilt as a clean Node.js/Express service ready for [Render](https://render.com), with the interactive **Sticker Lab** canvas restored right above the order form.

## What Was Rebuilt & Fixed

- **Render-ready Node.js Web Service** (`server.js`, `render.yaml`, `GET /health` health check, Helmet CSP, gzip compression).
- **Interactive Sticker Lab (`#lab`)**:
  - Drag, resize, rotate, layer, duplicate, and edit shape/text stickers.
  - Upload or drop photos directly onto the canvas into the **Photo Cutout Studio** (Magic Wand background removal, Erase/Restore brushes, and live **white vinyl die-cut border**).
  - Preview layouts on **Sky Board**, **Silver Laptop**, or **Matte Laptop**.
  - Export mockup as PNG or click **Attach Mockup to Order ↓** to send it straight into the order form gallery.
- **Fixed Pricing Sync Bug**: Clicking any tier card (`€3`, `€5`, `€6.50`) now syncs the quantity counter, estimated total, and live summary bar cleanly.
- **Fixed Team Cards**: Uniform initial letters (`E`, `L`, `V`, `S`, `Y`, `G`) and corner stamps across all six team cards.
- **Flexible Order Submission**:
  - Defaults to `ORDER_MODE=mailto` (opens a pre-filled email draft via `TEAM_EMAIL` env var + Copy Order Details + quick attachment download links).
  - Supports `ORDER_MODE=server` to upload photos, napkin sketches, voice notes, and Sticker Lab mockups directly to `POST /api/orders` (viewable via Basic-Auth-protected `GET /api/orders`).

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

Run the test suite:

```bash
npm test
```

## Deploy on Render

1. Push this folder to a GitHub or GitLab repository.
2. In the Render dashboard, choose **New → Blueprint** (or **New → Web Service**) and point to your repo — Render reads [`render.yaml`](./render.yaml) automatically.
3. In Render **Environment** settings, set:
   - `TEAM_EMAIL` — your team's real inbox address for `mailto:` order drafts.
   - `ORDER_MODE` — keep `mailto` for client-side email drafts, or switch to `server` for direct `POST /api/orders` uploads (note: Render's free tier uses an ephemeral filesystem; attach a persistent disk on a paid plan or connect object storage if storing uploads long term).
   - `ADMIN_PASSWORD` — generated automatically by `render.yaml` to protect `GET /api/orders`.
