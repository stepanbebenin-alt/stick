import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../server.js';
import { calculateStickerPrice, clampQuantity, formatEuro } from '../src/pricing.js';

// Minimal valid 1x1 PNG bytes for multipart upload tests
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function startTestServer(appOptions = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sticky-club-test-'));
  const app = createApp({
    dataDir: path.join(tmpDir, 'data'),
    uploadDir: path.join(tmpDir, 'uploads'),
    ...appOptions,
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    tmpDir,
    async close() {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      await fs.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

test('pricing formula calculates expected euro amounts and clamps bounds', () => {
  assert.equal(calculateStickerPrice(1), 3);
  assert.equal(calculateStickerPrice(2), 5);
  assert.equal(calculateStickerPrice(3), 6.5);
  assert.equal(calculateStickerPrice(4), 8);
  assert.equal(formatEuro(calculateStickerPrice(3)), '€6.50');
  assert.equal(clampQuantity(-5), 1);
  assert.equal(clampQuantity(250), 100);
});

test('GET /health and GET / serve healthy app with Sticker Lab and no placeholder email', async () => {
  const srv = await startTestServer({ teamEmail: 'team@stickyclub.lt', orderMode: 'mailto' });
  try {
    const healthRes = await fetch(`${srv.baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    const cfgRes = await fetch(`${srv.baseUrl}/api/config`);
    assert.equal(cfgRes.status, 200);
    const cfg = await cfgRes.json();
    assert.equal(cfg.teamEmail, 'team@stickyclub.lt');
    assert.equal(cfg.hasTeamEmail, true);
    assert.equal(cfg.orderMode, 'mailto');

    const htmlRes = await fetch(`${srv.baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /id="stage"/);
    assert.match(html, /id="photoEditor"/);
    assert.match(html, /id="orderForm"/);
    assert.doesNotMatch(html, /YOUR-TEAM-EMAIL@example\.com/);
  } finally {
    await srv.close();
  }
});

test('POST /api/orders validates input, saves multipart attachments, and enforces admin auth on reads', async () => {
  const srv = await startTestServer({
    orderMode: 'server',
    adminPassword: 'super-secret-password',
  });

  try {
    // 1. Invalid email should return 400
    const badFd = new FormData();
    badFd.set('name', 'Alex');
    badFd.set('email', 'not-an-email');
    badFd.set('quantity', '2');
    const badRes = await fetch(`${srv.baseUrl}/api/orders`, { method: 'POST', body: badFd });
    assert.equal(badRes.status, 400);

    // 2. Invalid file mime type should return 400
    const badFileFd = new FormData();
    badFileFd.set('name', 'Alex');
    badFileFd.set('email', 'alex@example.com');
    badFileFd.append('photos', new Blob(['pdf'], { type: 'application/pdf' }), 'doc.pdf');
    const badFileRes = await fetch(`${srv.baseUrl}/api/orders`, { method: 'POST', body: badFileFd });
    assert.equal(badFileRes.status, 400);

    // 3. Valid order with photo, sketch, voice note, and Sticker Lab mockup
    const fd = new FormData();
    fd.set('name', 'Milda');
    fd.set('email', 'milda@uni.example');
    fd.set('idea', 'Cat wearing sunglasses');
    fd.set('quantity', '4');
    fd.set('sharePermission', 'yes');
    fd.append('photos', new Blob([TINY_PNG], { type: 'image/png' }), 'cat.png');
    fd.append('sketch', new Blob([TINY_PNG], { type: 'image/png' }), 'sketch.png');
    fd.append('labMockup', new Blob([TINY_PNG], { type: 'image/png' }), 'mockup.png');
    fd.append('voiceNote', new Blob([Buffer.from('fake-webm')], { type: 'audio/webm;codecs=opus' }), 'voice.webm');

    const okRes = await fetch(`${srv.baseUrl}/api/orders`, { method: 'POST', body: fd });
    assert.equal(okRes.status, 201);
    const created = await okRes.json();
    assert.equal(created.ok, true);
    assert.equal(created.quantity, 4);
    assert.equal(created.estimatedPrice, 8);
    assert.equal(created.estimatedPriceFormatted, '€8.00');
    assert.equal(created.filesCount, 4);

    // 4. Unauthenticated GET /api/orders returns 401
    const unauthRes = await fetch(`${srv.baseUrl}/api/orders`);
    assert.equal(unauthRes.status, 401);

    // 5. Authenticated GET /api/orders returns saved order + downloadable files
    const authHeader = `Basic ${Buffer.from('admin:super-secret-password').toString('base64')}`;
    const listRes = await fetch(`${srv.baseUrl}/api/orders`, {
      headers: { Authorization: authHeader },
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.count, 1);
    assert.equal(listData.orders[0].orderId, created.orderId);
    assert.equal(listData.orders[0].files.length, 4);

    const firstFile = listData.orders[0].files[0].filename;
    const fileRes = await fetch(
      `${srv.baseUrl}/api/orders/${created.orderId}/files/${encodeURIComponent(firstFile)}`,
      { headers: { Authorization: authHeader } },
    );
    assert.equal(fileRes.status, 200);
    const downloaded = Buffer.from(await fileRes.arrayBuffer());
    assert.deepEqual(downloaded, TINY_PNG);
  } finally {
    await srv.close();
  }
});

test('GET /api/orders returns 503 when ADMIN_PASSWORD is not set', async () => {
  const srv = await startTestServer({ adminPassword: '' });
  try {
    const res = await fetch(`${srv.baseUrl}/api/orders`);
    assert.equal(res.status, 503);
  } finally {
    await srv.close();
  }
});
