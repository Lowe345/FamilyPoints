'use strict';

const Game = (() => {
  let _mode      = 'normal';
  let _running   = false;
  let _rafId     = null;
  let _hudTimer  = null;
  let _menuRafId = null;
  let _bestDist  = 0;

  function setMode(m) { _mode = m; }

  function start() {
    _stopMenuLoop();
    _stopLoops();
    GameState.init(_mode);
    Renderer.setup();

    // Wire input: first press starts the game; all presses apply thrust.
    Input.init(
      () => {
        if (!GameState.get().started) GameState.setStarted();
        GameState.setThrusting(true);
      },
      () => GameState.setThrusting(false)
    );

    UI.setModeBadge(_mode);
    UI.updateHud(GameState.get());
    _running  = true;
    _hudTimer = setInterval(() => { if (_running) UI.updateHud(GameState.get()); }, 200);
    UI.showScreen('game');
    _loop();
  }

  function restart()      { start(); }
  function returnToMenu() { _stopLoops(); Input.reset(); UI.showScreen('menu'); _startMenuLoop(); }

  function _stopLoops() {
    _running = false;
    cancelAnimationFrame(_rafId);
    clearInterval(_hudTimer);
  }

  function _startMenuLoop() {
    const mc = document.getElementById('menu-canvas');
    function tick() { Renderer.drawMenuPreview(mc); _menuRafId = requestAnimationFrame(tick); }
    tick();
  }

  function _stopMenuLoop() { cancelAnimationFrame(_menuRafId); }

  function _loop() {
    if (!_running) return;
    _update();
    Renderer.drawFrame(GameState.get());
    _rafId = requestAnimationFrame(_loop);
  }

  function _update() {
    const state = GameState.get();
    GameState.incrementFrame();

    // Frozen until first thrust press — no physics, no scrolling, no spawning.
    if (!state.started) return;

    GameState.incrementDist();

    // ── Physics ───────────────────────────────────────────────
    let vy = state.playerVY;
    if (state.thrusting) {
      vy = Physics.applyThrust(vy, GameState.thrustHeldMs());
    } else {
      vy = Physics.applyGravity(vy);
    }
    const { y, vy: nvy, dead } = Physics.clampY(state.playerY + vy, vy, Config.PLAYER_H);
    GameState.setPlayerY(y, nvy);
    if (dead && !GameState.isShielded()) { _endGame(); return; }

    // ── Spawn ─────────────────────────────────────────────────
    if (Math.random() < state.cfg.obstacleRate) {
      const obs = Spawner.spawnObstacle(state, state.lastObstacleX);
      if (obs) { state.obstacles.push(obs); GameState.setLastObstacleX(obs.x); }
    }
    if (state.frame % Config.COIN_SPAWN_EVERY === 0 && state.frame > 0)
      state.coins_arr.push(...Spawner.spawnCoinRow(Config.W + 10));
    if (state.frame % Config.PU_SPAWN_EVERY === 0 && state.frame > 0)
      state.powerups.push(Spawner.spawnPowerup(Config.W + 10));

    const spd = GameState.effectiveSpeed();

    // ── Scroll ────────────────────────────────────────────────
    for (const o of state.obstacles) {
      o.x -= spd;
      if (o.type === 'missile') {
        const dy = state.playerY - o.y;
        o.vy += Math.sign(dy) * Config.MISSILE_HOMING;
        o.vy  = Math.max(-3, Math.min(3, o.vy));
        o.y  += o.vy;
        o.x  -= Config.MISSILE_SPEED * 0.4;
      }
    }
    state.obstacles = state.obstacles.filter(o => o.x + (o.w || 240) > -10);
    for (const c of state.coins_arr) c.x -= spd;
    state.coins_arr = state.coins_arr.filter(c => !c.collected && c.x > -20);
    for (const p of state.powerups)  p.x -= spd;
    state.powerups  = state.powerups.filter(p => !p.collected && p.x > -30);

    // ── Collections ───────────────────────────────────────────
    for (const c of Collision.checkCoins(state)) {
      GameState.addCoin();
      const ps = [];
      for (let i = 0; i < 6; i++)
        ps.push({ x:c.x, y:c.y, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3,
                  life:18, maxLife:18, r:2, color:'#ffd060' });
      GameState.addParticles(ps);
    }
    for (const p of Collision.checkPowerups(state)) {
      if (p.type === 'shield') GameState.activateShield();
      if (p.type === 'magnet') GameState.activateMagnet();
      if (p.type === 'boost')  GameState.activateBoost();
      const col = { shield:'#40c0ff', magnet:'#ff40ff', boost:'#ff8020' }[p.type];
      const ps  = [];
      for (let i = 0; i < 12; i++)
        ps.push({ x:p.x, y:p.y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5,
                  life:25, maxLife:25, r:3, color: col });
      GameState.addParticles(ps);
    }

    // Exhaust particles
    if (state.thrusting && state.frame % 2 === 0)
      GameState.addParticles([{
        x: Config.PLAYER_X - 14, y: state.playerY + 4 + (Math.random()-0.5)*4,
        vx: -(1 + Math.random()*1.5), vy: (Math.random()-0.5)*1.5,
        life: 14, maxLife: 14, r: 3 + Math.random()*2,
        color: GameState.isBoosted() ? '#ff8040' : '#40c0ff',
      }]);

    GameState.tickParticles();

    // Obstacle collision — shield suppresses game-over
    if (Collision.checkObstacles(state) && !GameState.isShielded()) { _endGame(); return; }
  }

  function _endGame() {
    _stopLoops();
    Input.reset();
    GameState.setDead();
    const state = GameState.get();
    if (state.dist > _bestDist) _bestDist = state.dist;
    UI.showOver(state, _bestDist);
  }

  return { setMode, start, restart, returnToMenu };
})();
