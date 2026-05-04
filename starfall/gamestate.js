'use strict';
const GameState = (() => {
  let s = null;

  function init(mapIndex) {
    const mapDef   = Config.MAPS[mapIndex];
    const { COLS, ROWS } = Config.GRID;
    const tiles    = mapDef.tiles;
    const path     = MapLoader.getPathSequence(tiles, COLS, ROWS);
    const buildable = MapLoader.getBuildableCells(tiles, COLS, ROWS);

    s = {
      mapIndex,
      mapDef,
      tiles,
      path,          // ordered [{col,row}] from START → END
      buildable,     // Set<"col,row"> of placeable cells

      phase:         'build',   // 'build' | 'wave' | 'countdown' | 'win' | 'lose'
      wave:          0,         // 0-indexed current wave (displayed as wave+1)
      lives:         mapDef.lives,
      credits:       mapDef.startingCredits,

      towers:        [],        // [{col, row, type, level, id, lastFiredAt}]
      nextTowerId:   1,

      enemies:       [],        // active enemies on the path
      nextEnemyId:   1,
      projectiles:   [],        // populated by ProjectileManager (step 4)

      // Wave / spawn tracking
      leakedThisWave:  false,   // true if any enemy reached base this wave
      waveStarted:     false,   // true once first enemy of current wave spawned

      selectedType:   'laser',  // currently selected tower type in sidebar
      hoveredCell:    null,     // {col, row} or null — cell under pointer
      selectedTower:  null,     // tower object currently selected for sell/move/upgrade
      movingTower:    null,     // tower being relocated (picked up), or null
      moveOrigin:     null,     // {col,row} where movingTower came from (for cancel)

      countdownEnd:   0,        // timestamp when countdown expires
      waveBonus:      0,        // accumulates during a wave
      virtualTime:    0,        // ms — incremented by dt*speed each frame
      startTime:      Date.now(), // wall time game started — for elapsed display
      enemiesKilled:  0,        // total kills this game
      perfectWaves:   0,        // waves cleared with 0 leaks

      gemsCollected:  0,        // unused in TD but kept for test compat
    };
  }

  function get() { return s; }

  // Credits
  function addCredits(n)    { s.credits = Math.max(0, s.credits + n); }
  function spendCredits(n)  { s.credits = Math.max(0, s.credits - n); }
  function canAfford(n)     { return s.credits >= n; }

  // Lives
  function loseLife(n = 1)  { s.lives = Math.max(0, s.lives - n); }

  // Phase transitions — explicit names make illegal transitions visible
  function setPhase(p)      { s.phase = p; }

  // Tower placement
  function placeTower(col, row, type) {
    const id = s.nextTowerId++;
    const tower = { col, row, type, level: 1, id, lastFiredAt: 0 };
    s.towers.push(tower);
    s.buildable.delete(`${col},${row}`);
    return tower;
  }

  function removeTower(id) {
    const idx = s.towers.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const [tower] = s.towers.splice(idx, 1);
    s.buildable.add(`${tower.col},${tower.row}`);
    return tower;
  }

  function getTowerAt(col, row) {
    return s.towers.find(t => t.col === col && t.row === row) || null;
  }

  function isBuildable(col, row) {
    return s.buildable.has(`${col},${row}`);
  }

  // Enemy management
  function spawnEnemy(type, pathIndex, opts = {}) {
    const cfg  = Config.ENEMIES[type];
    const cell = s.path[pathIndex] || s.path[0];
    const enemy = {
      id:               s.nextEnemyId++,
      type,
      hp:               cfg.hp,
      maxHp:            cfg.hp,
      // Shielded enemies have a shield pool that absorbs damage first
      shieldHp:         cfg.shieldHp || 0,
      maxShieldHp:      cfg.shieldHp || 0,
      speed:            cfg.speed,
      pathIndex,
      px: cell.col * Config.GRID.TILE + Config.GRID.TILE / 2,
      py: cell.row * Config.GRID.TILE + Config.GRID.TILE / 2,
      progress:         0,
      slowUntil:        0,
      stunUntil:        0,
      burnTick:         0,
      burnDamage:       0,
      // Brief invulnerability window — used for carrier drone spawns
      invulnerableUntil: opts.invulnerableUntil || 0,
    };
    s.enemies.push(enemy);
    return enemy;
  }

  function damageEnemy(id, amount) {
    const e = s.enemies.find(e => e.id === id);
    if (!e) return false;
    // Invulnerable window — no damage at all
    if (e.invulnerableUntil > s.virtualTime) return false;
    // Shield absorbs damage first
    if (e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, amount);
      e.shieldHp -= absorbed;
      amount     -= absorbed;
      if (amount <= 0) return false; // shield absorbed everything
    }
    e.hp = Math.max(0, e.hp - amount);
    return e.hp <= 0;
  }

  function removeEnemy(id) {
    const idx = s.enemies.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const [enemy] = s.enemies.splice(idx, 1);
    return enemy;
  }

  function getEnemyById(id) {
    return s.enemies.find(e => e.id === id) || null;
  }

  // Returns the stat block for a tower at its current level.
  function towerStats(tower) {
    return Config.TOWERS[tower.type]['lv' + tower.level];
  }

  function upgradeTower(id) {
    const tower = s.towers.find(t => t.id === id);
    if (!tower || tower.level >= 3) return false;
    const cfg  = Config.TOWERS[tower.type];
    const cost = tower.level === 1 ? cfg.upgrade1 : cfg.upgrade2;
    if (!canAfford(cost)) return false;
    spendCredits(cost);
    tower.level++;
    return true;
  }
  function selectTower(tower) { s.selectedTower = tower; }
  function clearSelection()   { s.selectedTower = null; }

  return {
    init, get,
    addCredits, spendCredits, canAfford,
    loseLife,
    setPhase,
    placeTower, removeTower, getTowerAt, isBuildable,
    upgradeTower, selectTower, clearSelection,
    spawnEnemy, damageEnemy, removeEnemy, getEnemyById,
    towerStats,
  };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   ENEMY MANAGER
   Ticks all active enemies forward along the path each frame.
   Returns a list of result events: { type:'reached'|'died', enemy }.
   Pure logic — no rendering, no state mutation beyond what GameState exposes.
   ═══════════════════════════════════════════════════════════════════════════ */
