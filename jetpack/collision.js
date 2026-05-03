'use strict';

const Collision = (() => {
  const PR = Config.PLAYER_COLLISION_R;

  function _laserActive(obs) {
    const age = Date.now() - obs.spawnTime;
    if (age < Config.LASER_WARN_MS) return false;
    const cycle = (age - Config.LASER_WARN_MS + obs.blinkPhase) % (Config.LASER_BLINK_MS * 2);
    return cycle < Config.LASER_BLINK_MS;
  }

  // Returns true if the player overlaps any obstacle. Shield suppression is the
  // caller's responsibility (_update checks isShielded() after this returns).
  function checkObstacles(state) {
    const px = Config.PLAYER_X, py = state.playerY;
    for (const o of state.obstacles) {
      if (o.type === 'spike') {
        if (o.topH > 0 && Physics.circleRect(px, py, PR, o.x, Config.CEIL_Y, o.w, o.topH))           return true;
        if (o.botH > 0 && Physics.circleRect(px, py, PR, o.x, Config.GROUND_Y - o.botH, o.w, o.botH)) return true;
      } else if (o.type === 'laser') {
        if (_laserActive(o) && Physics.circleRect(px, py, PR, o.x, o.y, o.w, o.h)) return true;
      } else if (o.type === 'missile') {
        if (Physics.circleRect(px, py, PR, o.x - o.w/2, o.y - o.h/2, o.w, o.h))   return true;
      }
    }
    return false;
  }

  // Mutates collected flag on each coin in place.
  // Returns array of newly-collected coin objects.
  function checkCoins(state) {
    const px = Config.PLAYER_X, py = state.playerY;
    const mag = GameState.isMagnet();
    const out = [];
    for (const c of state.coins_arr) {
      if (c.collected) continue;
      const d2 = (px - c.x) ** 2 + (py - c.y) ** 2;
      if (mag && d2 < Config.COIN_MAGNET_R ** 2) {
        const d = Math.sqrt(d2) || 1;
        c.x += (px - c.x) / d * 5;
        c.y += (py - c.y) / d * 5;
      }
      if (d2 < (PR + Config.COIN_R) ** 2) { c.collected = true; out.push(c); }
    }
    return out;
  }

  // Mutates collected flag on each power-up in place.
  // Returns array of newly-collected power-up objects.
  function checkPowerups(state) {
    const px = Config.PLAYER_X, py = state.playerY;
    const out = [];
    for (const p of state.powerups) {
      if (p.collected) continue;
      if (Physics.circleCircle(px, py, PR, p.x, p.y, p.r)) { p.collected = true; out.push(p); }
    }
    return out;
  }

  return { checkObstacles, checkCoins, checkPowerups, _laserActive };
})();
