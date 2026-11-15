# imastik — Render Edition

Custom stickers web app rebuilt as a clean Node.js/Express service ready for [Render](https://render.com).

## Features

- **Render-ready Node.js Web Service** (`server.js`, `render.yaml`, `GET /health` health check, Helmet CSP, gzip compression).
- **Rebuilt imastik Experience** (`public/index.html`, `public/css/styles.css`, `public/js/`):
  - Sunny yellow & pink palette + `Fredoka` & `Playfair Display` typography, `imastik` peel-bulb logo, animated hero ornaments (sun orb, orbit star, scribble), and smiley star pointer cursor (automatically pauses for the pencil cursor on sketch canvases)
  - **Why imastik** (`#why-sticky`) and **Where will you stick yours?** (`#stick-anywhere`) everyday uses grid (`Laptop`, `Phone Case`, `Notebook`, `Anything You Love`)
  - **Pack Pricing** (`#prices`) with interactive copy-tier cards (`5 copies €5`, `10 copies €8`, `20 copies €15`)
  - **Interactive Sticker Playground** (`#play`) with draggable stickers, photo cutout studio (quick color cutout, erase/restore brushes, optional AI background removal, white sticker border), PNG download, and 1-click **Use canvas in order**
  - **Our team** (`#story`) featuring all six club members, `@linas.psd`, and `@imastik.co` Instagram links
  - **Fixed Order System** (`#order`) with reference image upload, **napkin sketch canvas** (with pencil cursor + expandable full-screen drawing pad), **voice note recorder**, clear pack/payment instructions (`imastik.co@gmail.com`), and **timelapse consent**
- **Flexible Order Submission**:
  - Defaults to `ORDER_MODE=mailto` (opens a pre-filled email draft via `TEAM_EMAIL` env var + Copy Order Details + quick attachment download links).
  - Supports `ORDER_MODE=server` to upload photos, napkin sketches, and voice notes directly to `POST /api/orders` (viewable via Basic-Auth-protected `GET /api/orders`).

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

1. Push this repository to GitHub or GitLab.
2. In the Render dashboard, choose **New → Blueprint** (or **New → Web Service**) and point to your repo — Render reads [`render.yaml`](./render.yaml) automatically.
3. In Render **Environment** settings, set:
   - `TEAM_EMAIL` — your team's real inbox address for `mailto:` order drafts.
   - `ORDER_MODE` — keep `mailto` for client-side email drafts, or switch to `server` for direct `POST /api/orders` uploads (note: Render's free tier uses an ephemeral filesystem; attach a persistent disk on a paid plan or connect object storage if storing uploads long term).
   - `ADMIN_PASSWORD` — generated automatically by `render.yaml` to protect `GET /api/orders`.
