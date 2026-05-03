'use strict';

// Boot sequence — runs after all modules are loaded.
// Order matters: Tests first (they reset GameState), then UI setup.
Tests.run();
Game.setMode('normal');
UI.showScreen('menu');

// Menu preview animation loop
(function menuLoop() {
  Renderer.drawMenuPreview(document.getElementById('menu-canvas'));
  requestAnimationFrame(menuLoop);
})();
