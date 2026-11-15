# imastik — Render Edition

Custom stickers web app rebuilt as a clean Node.js/Express service ready for [Render](https://render.com).

## Features

- **Render-ready Node.js Web Service** (`server.js`, `render.yaml`, `GET /health` health check, Helmet CSP, gzip compression).
- **Streamlined Page Flow**:
  - Sunny yellow & pink hero with `Fredoka` + `Playfair Display` typography, top **Make an order** CTA, and **peel-and-drag stickers** visitors can place anywhere on the site
  - **The idea** editorial intro
  - **Public Sticker Store** (`#store`) with filterable studio concepts and quick **Order this design** pre-fill (`5 for €5`, `10 for €8`, `20 for €15`)
  - Single unified pink **Process + Pricing** section with middle **Make an order** CTA and interactive pack pricing cards (`5 for €5`, `10 for €8`, `20 for €15`)
  - **Our team** section right after pricing featuring `@imastik.co` Instagram and bottom **Order here** CTA
  - **Custom Order Form** (`#order`) with Store pick banner, reference image upload, **napkin sketch canvas** (with pencil cursor + expandable full-screen drawing pad), **voice note recorder**, clear payment steps (`imastik.co@gmail.com`), **timelapse consent**, and optional **public Store listing consent**
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
