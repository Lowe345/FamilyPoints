'use strict';
const Game = (() => {
  let _rafId         = null;
  let _running       = false;
  let _lastFrameTime = 0;
  let _speed         = 1;     // 1 = normal, 2 = 2×, 3 = 3×

  function setSpeed(n) {
    _speed = Math.max(1, Math.floor(n));
    // Restart the spawn interval at the new rate if a wave is active
    WaveController.rescaleInterval(_speed);
  }
  function getSpeed() { return _speed; }

  function start(mapIndex = 0) {
    _speed = 1;
    _stopAll();
    GameState.init(mapIndex);
    Renderer.setup(Config.GRID.COLS, Config.GRID.ROWS);
    Input.init(_onPointerDown, _onPointerMove, _onPointerUp);
    _running = true;
    _lastFrameTime = performance.now();
    _loop();
  }

  function _stopAll() {
    _running = false;
    cancelAnimationFrame(_rafId);
    WaveController.reset();
    ScreenManager.reset();
  }

  function _loop(now = performance.now()) {
    if (!_running) return;
    const realDt   = Math.min((now - _lastFrameTime) / 1000, 0.1);
    const dt       = realDt * _speed;
    _lastFrameTime = now;

    const state = GameState.get();

    // Advance virtual time — used for all fire-rate cooldowns
    state.virtualTime += dt * 1000;

    if (state.phase === 'wave') {
      // Tower firing
      TowerManager.tick(state);

      // Projectile movement + impact
      ProjectileManager.tick(state, dt);

      // Enemy movement
      const events = EnemyManager.tick(state, dt);
      for (const evt of events) {
        if (evt.type === 'reached') {
          const lives = Config.ENEMIES[evt.enemy.type].lives;
          GameState.loseLife(lives);
          state.leakedThisWave = true;
          if (state.lives <= 0) { _endGame('lose'); return; }
        }
        // 'died' events from burn are handled inside EnemyManager
      }
    }

    Renderer.drawFrame(state);
    _rafId = requestAnimationFrame(_loop);
  }

  function _startWave() {
    const state = GameState.get();
    if (state.phase !== 'build') return;
    GameState.clearSelection();
    WaveController.startCountdown(_onWaveEnd);
  }

  function _onWaveEnd(result) {
    if (result === 'win') {
      _stopAll();
      const state = GameState.get();
      ScreenManager.showWin(state, () => Game.start(state.mapIndex));
      return;
    }
    // 'next' — return to build phase
    const state = GameState.get();
    GameState.setPhase('build');
    _running = true;
    _lastFrameTime = performance.now();
    _loop();
  }

  function _endGame(reason) {
    _stopAll();
    GameState.setPhase(reason);
    const state = GameState.get();
    ScreenManager.showLose(state, () => Game.start(state.mapIndex));
  }

  // ── Input handlers ────────────────────────────────────────────────────────
  function _onPointerDown(pos, cell) {
    // Win/lose overlay captures clicks first
    if (ScreenManager.isActive()) {
      ScreenManager.handleClick(pos);
      return;
    }

    const state = GameState.get();
    const gridW = Renderer.getGridWidth();

    // ── Sidebar click ──────────────────────────────────────────────────────
    if (pos.x >= gridW) {
      _handleSidebarClick(pos, state);
      return;
    }

    // ── Grid click ─────────────────────────────────────────────────────────
    if (cell.col < 0 || cell.col >= Config.GRID.COLS ||
        cell.row < 0 || cell.row >= Config.GRID.ROWS) return;

    if (state.phase !== 'build') return;

    // ── Moving tower: drop or cancel ───────────────────────────────────────
    if (state.movingTower) {
      _dropMovingTower(cell);
      return;
    }

    // ── Click on existing tower → select it ───────────────────────────────
    const existing = GameState.getTowerAt(cell.col, cell.row);
    if (existing) {
      // Toggle selection: clicking same tower deselects
      if (state.selectedTower && state.selectedTower.id === existing.id) {
        GameState.clearSelection();
      } else {
        GameState.selectTower(existing);
      }
      return;
    }

    // ── Click on empty buildable cell → place tower ────────────────────────
    if (GameState.isBuildable(cell.col, cell.row)) {
      const cost = Config.TOWERS[state.selectedType].cost;
      if (GameState.canAfford(cost)) {
        GameState.clearSelection();
        GameState.spendCredits(cost);
        GameState.placeTower(cell.col, cell.row, state.selectedType);
      }
    } else {
      // Clicking non-buildable, non-tower cell clears selection
      GameState.clearSelection();
    }
  }

  function _onPointerMove(pos, cell) {
    const state  = GameState.get();
    const inGrid = cell.col >= 0 && cell.col < Config.GRID.COLS &&
                   cell.row >= 0 && cell.row < Config.GRID.ROWS &&
                   pos.x < Renderer.getGridWidth();
    state.hoveredCell = inGrid ? { col: cell.col, row: cell.row } : null;
  }

  function _onPointerUp(pos, cell) { /* reserved */ }

  // ── Sidebar button routing ─────────────────────────────────────────────────
  function _handleSidebarClick(pos, state) {
    const regions = Renderer.getHitRegions();

    // Speed buttons
    const speedHit = regions.speedBtns && regions.speedBtns.find(b => _hitTest(pos, b));
    if (speedHit) {
      Game.setSpeed(speedHit.spd);
      return;
    }

    // Start wave button
    if (regions.startWave && _hitTest(pos, regions.startWave)) {
      _startWave();
      return;
    }

    // Send early button
    if (regions.sendEarly && _hitTest(pos, regions.sendEarly)) {
      WaveController.sendEarly();
      return;
    }

    // Upgrade button
    if (regions.upgrade && _hitTest(pos, regions.upgrade)) {
      if (state.selectedTower) GameState.upgradeTower(state.selectedTower.id);
      return;
    }

    // Move button — pick tower up, deduct fee
    if (regions.move && _hitTest(pos, regions.move)) {
      if (state.selectedTower && !state.movingTower) {
        const fee = Config.ECONOMY.MOVE_FEE;
        if (GameState.canAfford(fee)) {
          GameState.spendCredits(fee);
          state.movingTower = state.selectedTower;
          state.moveOrigin  = { col: state.selectedTower.col, row: state.selectedTower.row };
          // Remove from grid so the cell is free for preview
          GameState.removeTower(state.selectedTower.id);
          GameState.clearSelection();
        }
      } else if (state.movingTower) {
        // Clicking Move again while moving → cancel, refund fee, put back
        _cancelMove();
      }
      return;
    }

    // Sell button
    if (regions.sell && _hitTest(pos, regions.sell)) {
      if (state.selectedTower) {
        const refund = Math.floor(Config.TOWERS[state.selectedTower.type].cost * Config.ECONOMY.SELL_REFUND);
        GameState.removeTower(state.selectedTower.id);
        GameState.addCredits(refund);
        GameState.clearSelection();
      }
      return;
    }

    // Tower type selector
    const rowH   = 30;
    const selY   = regions.towerSelectorY;
    const types  = ['laser','cryo','plasma','tesla','missile'];
    const idx    = Math.floor((pos.y - selY) / rowH);
    if (idx >= 0 && idx < types.length) {
      state.selectedType = types[idx];
      GameState.clearSelection();
    }
  }

  function _dropMovingTower(cell) {
    const state = GameState.get();
    if (!state.movingTower) return;

    const { col, row } = cell;
    const canDrop = GameState.isBuildable(col, row);

    if (!canDrop || (col === state.moveOrigin.col && row === state.moveOrigin.row)) {
      // Cancel: put back at origin, refund fee
      _cancelMove();
      return;
    }

    // Place at new cell — restore id and attributes
    const t = state.movingTower;
    const restored = GameState.placeTower(col, row, t.type);
    restored.level       = t.level;
    restored.lastFiredAt = t.lastFiredAt;
    // Keep same id so references don't break later
    restored.id = t.id;

    state.movingTower = null;
    state.moveOrigin  = null;
  }

  function _cancelMove() {
    const state = GameState.get();
    if (!state.movingTower) return;
    // Refund the move fee
    GameState.addCredits(Config.ECONOMY.MOVE_FEE);
    // Put tower back at origin
    const t = state.movingTower;
    const restored = GameState.placeTower(state.moveOrigin.col, state.moveOrigin.row, t.type);
    restored.level       = t.level;
    restored.lastFiredAt = t.lastFiredAt;
    restored.id          = t.id;
    state.movingTower = null;
    state.moveOrigin  = null;
  }

  function _hitTest(pos, region) {
    return pos.x >= region.x && pos.x <= region.x + region.w &&
           pos.y >= region.y && pos.y <= region.y + region.h;
  }

  return { start, setSpeed, getSpeed };
})();


/* ═══════════════════════════════════════════════════════════════════════════
   TESTS
   Run on boot. Failing test names appear directly in the banner (KB §1).
   Each group wrapped in safe() so an exception doesn't kill later tests (KB §1).
   ═══════════════════════════════════════════════════════════════════════════ */
