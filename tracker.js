// tracker.js — popup dashboard for gaze coming from the VEX page
// Δx, Δy are now relative to the center of the VEX viewport (screen center)

const overlay = document.getElementById('overlay');
const msgEl   = document.getElementById('msg');

const cxEl  = document.getElementById('cx');
const cyEl  = document.getElementById('cy');
const dxEl  = document.getElementById('dx');
const dyEl  = document.getElementById('dy');
const scEl  = document.getElementById('scale');
const fpsEl = document.getElementById('fps');

// Smoothed gaze center in canvas coordinates
let smoothed = null;

// FPS tracking
let lastTime = performance.now();
let frames   = 0;
let fps      = 0;

// Processing space = canvas resolution
let PROC_W = 480;
let PROC_H = 270;

// Smoothing
const EMA_ALPHA = 0.2;

// --- layout helpers ---

function sizeOverlay() {
  const stage = overlay.parentElement;
  const w = stage.clientWidth  || 480;
  const h = stage.clientHeight || 270;

  overlay.width  = w;
  overlay.height = h;

  PROC_W = w;
  PROC_H = h;
}

function drawMarker(center) {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const sx = overlay.width  / PROC_W;
  const sy = overlay.height / PROC_H;
  const x  = center.x * sx;
  const y  = center.y * sy;

  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
  ctx.stroke();
}

function updatePanel(center, dx, dy, quality) {
  if (!center) return;

  cxEl.textContent = Math.round(center.x);
  cyEl.textContent = Math.round(center.y);
  dxEl.textContent = `${dx >= 0 ? '+' : ''}${Math.round(dx)}`;
  dyEl.textContent = `${dy >= 0 ? '+' : ''}${Math.round(dy)}`;
  scEl.textContent = quality != null ? Math.round(quality) : '0';

  frames++;
  const now = performance.now();
  if (now - lastTime > 500) {
    fps = Math.round((frames * 1000) / (now - lastTime));
    fpsEl.textContent = fps;
    frames = 0;
    lastTime = now;
  }
}

// --- Apply gaze data from the VEX page ---

function applyGazeFromPage(normalizedX, normalizedY) {
  if (!overlay.width || !overlay.height) return;

  const rect = overlay.getBoundingClientRect();

  // Map normalized [0..1] page coords -> popup overlay coords
  const xRel = normalizedX * rect.width;
  const yRel = normalizedY * rect.height;

  const scaleX = PROC_W / rect.width;
  const scaleY = PROC_H / rect.height;

  let rawCenter = {
    x: xRel * scaleX,
    y: yRel * scaleY
  };

  // Clamp to canvas bounds
  rawCenter.x = Math.max(0, Math.min(PROC_W, rawCenter.x));
  rawCenter.y = Math.max(0, Math.min(PROC_H, rawCenter.y));

  // EMA smoothing
  if (!smoothed) {
    smoothed = rawCenter;
  } else {
    smoothed = {
      x: EMA_ALPHA * rawCenter.x + (1 - EMA_ALPHA) * smoothed.x,
      y: EMA_ALPHA * rawCenter.y + (1 - EMA_ALPHA) * smoothed.y
    };
  }

  // ➜ DEVIATION RELATIVE TO CENTER OF SCREEN (viewport)
  const centerX = PROC_W / 2;
  const centerY = PROC_H / 2;
  const dx = smoothed.x - centerX; // left = negative, right = positive
  const dy = smoothed.y - centerY; // up = negative, down = positive

  drawMarker(smoothed);
  updatePanel(smoothed, dx, dy, 0);
}

// Listen for gaze messages directly in the iframe (camera.html / dashboard.html)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'gaze-update') {
    applyGazeFromPage(msg.normalizedX, msg.normalizedY);
  }
});

// Init
window.addEventListener('load', () => {
  sizeOverlay();
});
window.addEventListener('resize', sizeOverlay);
