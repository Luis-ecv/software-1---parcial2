// backend/src/controllers/export.controller.js
import path from 'path';
import puppeteer from 'puppeteer';

const DEFAULT_FRONTEND = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';

/**
 * POST /apis/export/board/:id
 * Captura todo el diagrama del board y devuelve JPEG (attachment).
 *
 * Requisitos: npm install puppeteer
 *
 * Seguridad: este endpoint NO implementa autorización. Añade middleware de autenticación
 * (cookies/session/headers) según tu backend antes de usar en producción.
 */
export async function exportBoardImage(req, res) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Board id is required' });
  }

  const boardUrl = `${DEFAULT_FRONTEND}/board/${encodeURIComponent(id)}`;
  // Temporary output path not required (we will return buffer)
  const timeoutMs = 120000; // 2 minutes

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // navigate
    await page.goto(boardUrl, { waitUntil: 'networkidle2', timeout: timeoutMs });

    // small wait for client render & websockets etc.
    //await page.waitForTimeout(500);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Hide known UI selectors that would obstruct capture (best-effort)
    await page.evaluate(() => {
      const toHide = [
        '#left-sidebar', '.left-sidebar', '.sidebar', '.app-sidebar',
        '.right-sidebar', '.floating', '.floating-button', '.fab', '.burbuja', '.burbujaHerramientasDiagrama',
        '.controls', '.topbar', '.navbar', '.menu-bar', '.header', '.footer', '.swal2-container'
      ];
      toHide.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            el.style.visibility = 'hidden';
            el.style.display = 'none';
          });
        } catch (e) { /* ignore */ }
      });
    });

    // Prefer deterministic container id (#board-<id>), otherwise try react-flow selectors
    const containerSelectors = [
      `#board-${id}`,
      `[data-board-id="${id}"]`,
      '.reactflow',
      '.react-flow',
      '.react-flow__renderer',
      '.react-flow__pane',
      '.react-flow__viewport'
    ];

    let elementHandle = null;
    for (const sel of containerSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          // quick heuristic to make sure it's diagram
          const isLikely = await page.evaluate((e) => {
            return !!(e.querySelector && (e.querySelector('.react-flow__node') || e.querySelector('.react-flow__edge') || e.querySelector('svg') || e.querySelector('[data-nodeid]')));
          }, el);
          elementHandle = el;
          if (isLikely) break;
        }
      } catch (e) { /* ignore selector errors */ }
    }

    if (!elementHandle) {
      // fallback: try to pick the first .react-flow in DOM
      elementHandle = await page.$('.react-flow') || await page.$('.react-flow__pane') || await page.$('.react-flow__renderer');
      if (!elementHandle) {
        throw new Error('No diagram container found on page (tried #board-<id>, .react-flow, etc.)');
      }
    }

    // Wait for DOM stability inside element - short heuristic
    //await page.waitForTimeout(300);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try element screenshot with captureBeyondViewport (supported in modern Puppeteer)
    try {
      const screenshotBuffer = await elementHandle.screenshot({
        type: 'jpeg',
        quality: 95,
        captureBeyondViewport: true,
        omitBackground: false
      });

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="diagram-${id}.jpg"`);
      return res.status(200).send(screenshotBuffer);
    } catch (err) {
      // fallback: set viewport to element size and screenshot page area
      const box = await elementHandle.boundingBox();
      if (!box) throw new Error('Failed to compute bounding box for diagram container');

      // clamp to safe dimension if extremely large
      const MAX_DIM = 16384;
      const targetWidth = Math.min(Math.ceil(box.width), MAX_DIM);
      const targetHeight = Math.min(Math.ceil(box.height), MAX_DIM);

      await page.setViewport({ width: targetWidth, height: targetHeight });

      await page.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        window.scrollTo(rect.left + window.scrollX, rect.top + window.scrollY);
      }, await elementHandle.getProperty('outerHTML').then(() => '#dummy'));

      //await page.waitForTimeout(200);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const buffer = await page.screenshot({ type: 'jpeg', quality: 95, fullPage: false });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="diagram-${id}.jpg"`);
      return res.status(200).send(buffer);
    }
  } catch (err) {
    console.error('exportBoardImage error:', err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}