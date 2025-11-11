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
    // If client sent diagram data (nodes/edges) use a headless HTML renderer locally to avoid network
    const { nodes, edges } = req.body || {};
    const usePayload = Array.isArray(nodes) && Array.isArray(edges);

    // If in production and not using payload, frontend base must not point to localhost
    if (!usePayload && process.env.NODE_ENV === 'production' && DEFAULT_FRONTEND.includes('localhost')) {
      console.error('FRONTEND_BASE_URL no está configurada para producción. Valor actual:', DEFAULT_FRONTEND);
      return res.status(500).json({ success: false, error: 'FRONTEND_BASE_URL not set for production. Please set FRONTEND_BASE_URL to your public frontend URL or send diagram payload.' });
    }

    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    if (usePayload) {
      // Build a minimal HTML that inlines an SVG generated from nodes/edges
      const svg = buildDiagramSVG(nodes, edges);
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
        body{margin:0;padding:0;background:#fff}
        .diagram-wrapper{display:block}
      </style></head><body><div id="diagram-container" class="diagram-wrapper">${svg}</div></body></html>`;

      await page.setContent(html, { waitUntil: 'networkidle0', timeout: timeoutMs });
  // short wait to ensure fonts/rendering
  await new Promise(resolve => setTimeout(resolve, 250));

      const el = await page.$('#diagram-container');
      if (!el) throw new Error('Failed to render diagram container from payload');

      // Compute bounding box from SVG itself
      const box = await el.boundingBox();
      const MAX_DIM = 16384;
      const targetWidth = Math.min(Math.ceil(box.width || 1024), MAX_DIM);
      const targetHeight = Math.min(Math.ceil(box.height || 768), MAX_DIM);
      try {
        await page.setViewport({ width: targetWidth || 1024, height: targetHeight || 768 });
      } catch (e) { /* ignore viewport errors */ }

      const screenshotBuffer = await el.screenshot({ type: 'jpeg', quality: 95, captureBeyondViewport: true, omitBackground: false });
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="diagram-${id}.jpg"`);
      return res.status(200).send(screenshotBuffer);
    }

    // navigate to frontend page (fallback behavior)
    await page.goto(boardUrl, { waitUntil: 'networkidle2', timeout: timeoutMs });

    // small wait for client render & websockets etc.
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

// --- Simple SVG generator from react-flow-like nodes/edges
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildDiagramSVG(nodes = [], edges = [], opts = {}) {
  // nodes: [{ id, position: {x,y}, data: { className, attributes, methods } }]
  const padding = opts.padding || 20;
  const nodeWidth = opts.nodeWidth || 180;
  const nodeMinHeight = opts.nodeMinHeight || 40;
  const nodeGapY = opts.nodeGapY || 16;

  const nodesById = new Map();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  nodes.forEach(n => {
    const x = (n.position && typeof n.position.x === 'number') ? n.position.x : 0;
    const y = (n.position && typeof n.position.y === 'number') ? n.position.y : 0;
    const w = nodeWidth;
    const h = Math.max(nodeMinHeight, (Array.isArray(n.data?.attributes) ? n.data.attributes.length : 0) * 14 + (Array.isArray(n.data?.methods) ? n.data.methods.length : 0) * 14 + 24);
    nodesById.set(n.id, { ...n, x, y, w, h });
    minX = Math.min(minX, x - w/2);
    minY = Math.min(minY, y - h/2);
    maxX = Math.max(maxX, x + w/2);
    maxY = Math.max(maxY, y + h/2);
  });

  if (minX === Infinity) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const viewMinX = Math.floor(minX - padding);
  const viewMinY = Math.floor(minY - padding);
  const viewWidth = Math.ceil((maxX - minX) + padding * 2);
  const viewHeight = Math.ceil((maxY - minY) + padding * 2);

  // Start SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}" height="${viewHeight}" viewBox="${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}">`;
  svg += `<style>text{font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; font-size:12px; fill:#111} .node-rect{fill:#fff;stroke:#2b6cb0;stroke-width:1.5;rx:6;ry:6;} .node-title{font-weight:700; font-size:13px} .edge{stroke:#444;stroke-width:1.6;fill:none}</style>`;

  // Draw edges first (lines)
  edges.forEach(e => {
    const src = nodesById.get(e.source);
    const tgt = nodesById.get(e.target);
    if (!src || !tgt) return;
    const x1 = src.x;
    const y1 = src.y;
    const x2 = tgt.x;
    const y2 = tgt.y;
    // simple straight line
    svg += `<path class="edge" d="M ${x1} ${y1} L ${x2} ${y2}" marker-end="url(#arrow)" />`;
  });

  // optional arrow marker
  svg += `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#444"/></marker></defs>`;

  // Draw nodes
  for (const [id, n] of nodesById) {
    const x = n.x - n.w/2;
    const y = n.y - n.h/2;
    const title = escapeHtml(n.data?.className || n.data?.label || id);
    svg += `<g class="node" data-nodeid="${escapeHtml(id)}">`;
    svg += `<rect class="node-rect" x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="6" ry="6" />`;
    svg += `<text class="node-title" x="${x + 10}" y="${y + 18}">${title}</text>`;
    // attributes
    const attrs = Array.isArray(n.data?.attributes) ? n.data.attributes : [];
    const methods = Array.isArray(n.data?.methods) ? n.data.methods : [];
    let offsetY = 34;
    attrs.forEach(a => {
      svg += `<text x="${x + 10}" y="${y + offsetY}">${escapeHtml(a)}</text>`;
      offsetY += 14;
    });
    if (methods.length > 0) offsetY += 6;
    methods.forEach(m => {
      svg += `<text x="${x + 10}" y="${y + offsetY}">${escapeHtml(m)}</text>`;
      offsetY += 14;
    });
    svg += `</g>`;
  }

  svg += `</svg>`;
  return svg;
}