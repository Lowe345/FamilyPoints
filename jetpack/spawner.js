'use strict';

const Spawner = (() => {
  function _r(a, b)  { return a + Math.random() * (b - a); }
  function _ri(a, b) { return Math.floor(_r(a, b + 1)); }

  // Spawn at a fixed x just off the right edge.
  // Spacing and timing gates are handled by GameState.canSpawnObstacle() —
  // this function always produces a valid obstacle when called.
  function spawnObstacle(state) {
    const spawnX = Config.W + 20;
    const roll   = Math.random();

    if (state.cfg.missileOn && roll < 0.18)
      return { type: 'missile', x: spawnX,
               y: _r(Config.CEIL_Y + 20, Config.GROUND_Y - 20),
               vy: 0, targetY: state.playerY, w: 22, h: 10 };

    if (state.cfg.laserOn && roll < 0.38)
      return { type: 'laser', x: spawnX,
               y: _r(Config.CEIL_Y + 40, Config.GROUND_Y - 60),
               w: _r(120, 180), h: _ri(12, 20),
               blinkPhase: Math.random() < 0.5 ? 0 : Config.LASER_BLINK_MS,
               spawnTime: Date.now() };

    // Spike pair — gap guaranteed >= MIN_GAP_Y and <= MIN_GAP_Y + 60
    const gap    = _r(Config.MIN_GAP_Y, Config.MIN_GAP_Y + 60);
    const margin = gap / 2 + 10;
    const midY   = _r(Config.CEIL_Y + margin, Config.GROUND_Y - margin);
    return {
      type: 'spike', x: spawnX, w: 34,
      topH: midY - gap / 2 - Config.CEIL_Y,
      botH: Config.GROUND_Y - (midY + gap / 2),
    };
  }

  function spawnCoinRow(x) {
    const y = _r(Config.CEIL_Y + 30, Config.GROUND_Y - 30);
    const n = _ri(4, 8);
    const c = [];
    for (let i = 0; i < n; i++) c.push({ x: x + i * 22, y, collected: false });
    return c;
  }

  function spawnPowerup(x) {
    return {
      type: ['shield', 'magnet', 'boost'][_ri(0, 2)],
      x, y: _r(Config.CEIL_Y + 30, Config.GROUND_Y - 30),
      r: 13, collected: false,
    };
  }

  return { spawnObstacle, spawnCoinRow, spawnPowerup };
})();
