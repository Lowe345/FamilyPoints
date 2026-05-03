'use strict';

const UI = (() => {
  function showScreen(name) {
    ['menu', 'game', 'over'].forEach(s =>
      document.getElementById('screen-' + s).classList.remove('active')
    );
    document.getElementById('screen-' + name).classList.add('active');
  }

  function selectMode(mode, el) {
    Game.setMode(mode);
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
  }

  function updateHud(state) {
    document.getElementById('hud-dist').textContent  = state.dist + 'm';
    document.getElementById('hud-coins').textContent = state.coins;
    const now = Date.now();
    let pu = '—';
    if      (now < state.shieldUntil) pu = `SHIELD ${Math.ceil((state.shieldUntil - now) / 1000)}s`;
    else if (now < state.magnetUntil) pu = `MAGNET ${Math.ceil((state.magnetUntil - now) / 1000)}s`;
    else if (now < state.boostUntil)  pu = `BOOST ${Math.ceil((state.boostUntil  - now) / 1000)}s`;
    document.getElementById('powerup-hud').textContent = pu;
  }

  function setModeBadge(mode) {
    const el = document.getElementById('hud-mode');
    el.textContent = { easy: '🌊 EASY', normal: '⚡ NORMAL', hard: '💀 HARD' }[mode];
    el.className   = 'hud-val mode-badge badge-' + mode;
  }

  function showOver(state, bestDist) {
    document.getElementById('over-sub').textContent =
      `You flew ${state.dist}m before crashing!`;
    document.getElementById('over-hs').textContent  =
      state.dist >= bestDist ? '🏆 New best distance!' : `Best this session: ${bestDist}m`;
    document.getElementById('over-stats').innerHTML =
      `<p>Mode: <span>${state.mode.toUpperCase()}</span></p>
       <p>Distance: <span>${state.dist}m</span></p>
       <p>Coins: <span class="gold">${state.coins}</span></p>
       <p>Time: <span>${state.elapsed()}s</span></p>`;
    showScreen('over');
  }

  return { showScreen, selectMode, updateHud, setModeBadge, showOver };
})();
