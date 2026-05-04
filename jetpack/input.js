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
    document.getElementById('touch-btn').classList.remove('held');
  }

  function thrustStart() {
    if (_onThrust) _onThrust();
    document.getElementById('touch-btn').classList.add('held');
  }

  function thrustStop() {
    if (_onRelease) _onRelease();
    document.getElementById('touch-btn').classList.remove('held');
  }

  // Keyboard — guard is inside thrustStart/Stop so Space does nothing
  // when no callbacks are wired (i.e. not in an active game).
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStart(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStop(); }
  });

  // Canvas pointer — only preventDefault and fire thrust when a callback
  // is actually wired. After _endGame calls Input.reset(), _onThrust is null
  // so clicks fall through normally to any DOM elements (e.g. over-screen buttons).
  const gc = document.getElementById('game-canvas');
  gc.addEventListener('pointerdown', e => {
    if (!_onThrust) return;   // game not active — let click pass through
    e.preventDefault();
    thrustStart();
  });
  gc.addEventListener('pointerup', e => {
    if (!_onRelease) return;
    e.preventDefault();
    thrustStop();
  });
  gc.addEventListener('pointerleave', () => thrustStop());

  return { init, reset, thrustStart, thrustStop };
})();
