'use strict';
const Input = (() => {
  let _onDown = null, _onMove = null, _onUp = null;
  const canvasEl = Renderer.getCanvas();

  function _canvasCoords(e) {
    if (!canvasEl) return { x: 0, y: 0 };
    const rect  = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width  / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  function _toCell(x, y) {
    const T = Config.GRID.TILE;
    return { col: Math.floor(x / T), row: Math.floor(y / T) };
  }

  if (canvasEl) {
    canvasEl.addEventListener('pointerdown', e => {
      if (!_onDown) return;
      e.preventDefault();
      const pos  = _canvasCoords(e);
      const cell = _toCell(pos.x, pos.y);
      _onDown(pos, cell);
    });

    canvasEl.addEventListener('pointermove', e => {
      if (!_onMove) return;
      const pos  = _canvasCoords(e);
      const cell = _toCell(pos.x, pos.y);
      _onMove(pos, cell);
    });

    canvasEl.addEventListener('pointerup', e => {
      if (!_onUp) return;
      e.preventDefault();
      const pos  = _canvasCoords(e);
      const cell = _toCell(pos.x, pos.y);
      _onUp(pos, cell);
    });

    canvasEl.addEventListener('pointerleave', e => {
      if (!_onMove) return;
      // Clear hover when pointer leaves canvas
      _onMove({ x: -1, y: -1 }, { col: -1, row: -1 });
    });
  }

  function init(onDown, onMove, onUp) {
    _onDown = onDown;
    _onMove = onMove;
    _onUp   = onUp;
  }

  function reset() {
    _onDown = null;
    _onMove = null;
    _onUp   = null;
  }

  return { init, reset };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   GAME
   Orchestrator. Owns the RAF loop. Wires Input → GameState → Renderer.
   Tower placement logic lives here for step 1; will expand each step.
   ═══════════════════════════════════════════════════════════════════════════ */
