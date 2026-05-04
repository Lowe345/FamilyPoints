'use strict';
const Input = (() => {
  let _onDown = null, _onMove = null, _onUp = null;
  const canvasEl = Renderer.getCanvas();

  function _canvasCoords(e) {
    if (!canvasEl) return { x: 0, y: 0, pointerType: e.pointerType };
    const rect   = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width  / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return {
      x:           (e.clientX - rect.left) * scaleX,
      y:           (e.clientY - rect.top)  * scaleY,
      pointerType: e.pointerType,
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
      const offPos  = { x: -1, y: -1, pointerType: e.pointerType };
      const offCell = { col: -1, row: -1 };
      if (_onMove) _onMove(offPos, offCell);
      if (_onUp)   _onUp(offPos, offCell);
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
