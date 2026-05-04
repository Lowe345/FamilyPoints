'use strict';

const Input = (() => {
  let _onThrust  = null;
  let _onRelease = null;

  function init(thrustCb, releaseCb) {
    _onThrust  = thrustCb;
    _onRelease = releaseCb;
  }

  function reset() {
    _onThrust  = null;
    _onRelease = null;
    _drawThrustBtn(false);
  }

  function thrustStart() {
    if (_onThrust) _onThrust();
    _drawThrustBtn(true);
  }

  function thrustStop() {
    if (_onRelease) _onRelease();
    _drawThrustBtn(false);
  }

  // ── Canvas thrust button ──────────────────────────────────────
  // Pure canvas — no HTML text — so mobile OS never shows copy/select menus.
  const tc  = document.getElementById('thrust-canvas');
  const tct = tc ? tc.getContext('2d') : null;
  const TW  = 120, TH = 70;

  function _drawThrustBtn(held) {
    if (!tct) return; // guard: element may not exist in test environments

    tct.clearRect(0, 0, TW, TH);

    // Background + border
    tct.fillStyle = held ? '#0a2840' : '#0a1828';
    _rr(2, 2, TW-4, TH-4, 10);
    tct.fill();
    tct.strokeStyle = held ? '#00d4ff' : '#1a4070';
    tct.lineWidth   = held ? 2.5 : 1.5;
    tct.stroke();

    // Rocket body
    const cx = TW / 2, cy = TH / 2 - 8;
    tct.fillStyle = held ? '#00d4ff' : '#4a90c0';
    tct.beginPath();
    tct.ellipse(cx, cy, 7, 12, 0, 0, Math.PI * 2);
    tct.fill();

    // Nose cone
    tct.fillStyle = held ? '#80e8ff' : '#2a6090';
    tct.beginPath();
    tct.moveTo(cx - 7, cy - 4); tct.lineTo(cx, cy - 16); tct.lineTo(cx + 7, cy - 4);
    tct.closePath(); tct.fill();

    // Left fin
    tct.fillStyle = held ? '#40b0d0' : '#1a4060';
    tct.beginPath();
    tct.moveTo(cx - 7, cy + 4); tct.lineTo(cx - 14, cy + 12); tct.lineTo(cx - 7, cy + 12);
    tct.closePath(); tct.fill();

    // Right fin
    tct.beginPath();
    tct.moveTo(cx + 7, cy + 4); tct.lineTo(cx + 14, cy + 12); tct.lineTo(cx + 7, cy + 12);
    tct.closePath(); tct.fill();

    // Exhaust flame
    const flH = held ? 10 : 5;
    const g = tct.createLinearGradient(cx, cy + 12, cx, cy + 12 + flH);
    g.addColorStop(0, held ? '#00d4ff' : '#2a6090');
    g.addColorStop(1, 'rgba(0,80,140,0)');
    tct.fillStyle = g;
    tct.beginPath();
    tct.moveTo(cx - 5, cy + 12); tct.lineTo(cx, cy + 12 + flH); tct.lineTo(cx + 5, cy + 12);
    tct.closePath(); tct.fill();

    // Label
    tct.fillStyle    = held ? '#00d4ff' : '#2a5070';
    tct.font         = 'bold 9px Orbitron, monospace';
    tct.textAlign    = 'center';
    tct.textBaseline = 'middle';
    tct.fillText('THRUST', cx, TH - 10);
  }

  function _rr(x, y, w, h, r) {
    tct.beginPath();
    tct.moveTo(x + r, y);
    tct.lineTo(x + w - r, y); tct.arcTo(x + w, y,     x + w, y + r,     r);
    tct.lineTo(x + w, y + h - r); tct.arcTo(x + w, y + h, x + w - r, y + h, r);
    tct.lineTo(x + r, y + h); tct.arcTo(x,     y + h, x,     y + h - r, r);
    tct.lineTo(x, y + r);     tct.arcTo(x,     y,     x + r, y,         r);
    tct.closePath();
  }

  // Wire thrust canvas events (only if element exists)
  if (tc) {
    tc.addEventListener('pointerdown',  e => { e.preventDefault(); thrustStart(); });
    tc.addEventListener('pointerup',    e => { e.preventDefault(); thrustStop();  });
    tc.addEventListener('pointerleave', () => thrustStop());
  }

  // Global keyboard
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStart(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStop(); }
  });

  // Game canvas — only fires thrust when a callback is wired
  const gc = document.getElementById('game-canvas');
  if (gc) {
    gc.addEventListener('pointerdown', e => { if (!_onThrust) return; e.preventDefault(); thrustStart(); });
    gc.addEventListener('pointerup',   e => { if (!_onRelease) return; e.preventDefault(); thrustStop(); });
    gc.addEventListener('pointerleave', () => thrustStop());
  }

  // Draw initial idle state
  _drawThrustBtn(false);

  return { init, reset, thrustStart, thrustStop };
})();
