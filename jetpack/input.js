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
  // Drawn as a canvas so the OS never triggers text-selection or
  // copy menus on long-press (a common issue with HTML text on mobile).
  const tc  = document.getElementById('thrust-canvas');
  const tct = tc.getContext('2d');
  const TW  = 120, TH = 70;

  function _drawThrustBtn(held) {
    tct.clearRect(0, 0, TW, TH);

    // Background
    const bg = held ? '#0a2840' : '#0a1828';
    const border = held ? '#00d4ff' : '#1a4070';
    tct.fillStyle = bg;
    _roundRect(tct, 2, 2, TW-4, TH-4, 10);
    tct.fill();
    tct.strokeStyle = border;
    tct.lineWidth   = held ? 2.5 : 1.5;
    tct.stroke();

    // Rocket icon — drawn with primitives, no emoji/text
    const cx = TW / 2, cy = TH / 2 - 8;
    const fc = held ? '#00d4ff' : '#4a90c0';

    // Body
    tct.fillStyle = fc;
    tct.beginPath();
    tct.ellipse(cx, cy, 7, 12, 0, 0, Math.PI * 2);
    tct.fill();

    // Nose cone
    tct.fillStyle = held ? '#80e8ff' : '#2a6090';
    tct.beginPath();
    tct.moveTo(cx - 7, cy - 4);
    tct.lineTo(cx, cy - 16);
    tct.lineTo(cx + 7, cy - 4);
    tct.closePath();
    tct.fill();

    // Left fin
    tct.fillStyle = held ? '#40b0d0' : '#1a4060';
    tct.beginPath();
    tct.moveTo(cx - 7, cy + 4);
    tct.lineTo(cx - 14, cy + 12);
    tct.lineTo(cx - 7, cy + 12);
    tct.closePath();
    tct.fill();

    // Right fin
    tct.beginPath();
    tct.moveTo(cx + 7, cy + 4);
    tct.lineTo(cx + 14, cy + 12);
    tct.lineTo(cx + 7, cy + 12);
    tct.closePath();
    tct.fill();

    // Exhaust flame (always drawn, larger when held)
    const flameH = held ? 10 : 5;
    const grad = tct.createLinearGradient(cx, cy + 12, cx, cy + 12 + flameH);
    grad.addColorStop(0, held ? '#00d4ff' : '#2a6090');
    grad.addColorStop(1, 'rgba(0,80,140,0)');
    tct.fillStyle = grad;
    tct.beginPath();
    tct.moveTo(cx - 5, cy + 12);
    tct.lineTo(cx, cy + 12 + flameH);
    tct.lineTo(cx + 5, cy + 12);
    tct.closePath();
    tct.fill();

    // "THRUST" label
    tct.fillStyle   = held ? '#00d4ff' : '#2a5070';
    tct.font        = 'bold 9px Orbitron, monospace';
    tct.textAlign   = 'center';
    tct.textBaseline = 'middle';
    tct.fillText('THRUST', cx, TH - 10);
  }

  function _roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y,     x + w, y + r,     r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x,     y + h, x,     y + h - r, r);
    c.lineTo(x, y + r);     c.arcTo(x,     y,     x + r, y,         r);
    c.closePath();
  }

  // Wire thrust canvas pointer events — same guard as game canvas so clicks
  // don't fire after game ends
  tc.addEventListener('pointerdown',  e => { e.preventDefault(); thrustStart(); });
  tc.addEventListener('pointerup',    e => { e.preventDefault(); thrustStop();  });
  tc.addEventListener('pointerleave', () => thrustStop());

  // Global keyboard
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStart(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStop(); }
  });

  // Game canvas — only fires thrust when a callback is wired (i.e. game is active)
  const gc = document.getElementById('game-canvas');
  gc.addEventListener('pointerdown', e => {
    if (!_onThrust) return;
    e.preventDefault(); thrustStart();
  });
  gc.addEventListener('pointerup', e => {
    if (!_onRelease) return;
    e.preventDefault(); thrustStop();
  });
  gc.addEventListener('pointerleave', () => thrustStop());

  // Draw initial state
  _drawThrustBtn(false);

  return { init, reset, thrustStart, thrustStop };
})();
