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

  // All input sources funnel through these two functions.
  // The callback guard is evaluated at call-time, not at listener registration.
  function thrustStart() {
    if (_onThrust) _onThrust();
    document.getElementById('touch-btn').classList.add('held');
  }

  function thrustStop() {
    if (_onRelease) _onRelease();
    document.getElementById('touch-btn').classList.remove('held');
  }

  // Global keyboard listeners — always registered; guard is inside thrustStart/Stop.
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStart(); }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); thrustStop(); }
  });

  // Canvas pointer listeners — pointerleave ensures holding and drifting off canvas
  // doesn't leave thrusting stuck at true.
  const gc = document.getElementById('game-canvas');
  gc.addEventListener('pointerdown',  e => { e.preventDefault(); thrustStart(); });
  gc.addEventListener('pointerup',    e => { e.preventDefault(); thrustStop();  });
  gc.addEventListener('pointerleave', () => thrustStop());

  return { init, reset, thrustStart, thrustStop };
})();
