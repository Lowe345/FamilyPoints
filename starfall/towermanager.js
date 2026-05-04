'use strict';
const TowerManager = (() => {

  function tick(state) {
    const T  = Config.GRID.TILE;
    const vt = state.virtualTime;

    for (const tower of state.towers) {
      const stats  = GameState.towerStats(tower);
      const rangeP = stats.range * T;           // range in pixels
      const tx     = tower.col * T + T / 2;
      const ty     = tower.row * T + T / 2;

      if (tower.type === 'cryo') {
        const rate = stats.pulseRate;
        if (vt < (tower.lastFiredAt || 0) + rate) continue;
        tower.lastFiredAt = vt;
        for (const enemy of state.enemies) {
          const dx = enemy.px - tx, dy = enemy.py - ty;
          if (dx*dx + dy*dy <= rangeP*rangeP) {
            // All timing against virtualTime so game speed doesn't break expiry
            const slowWindow = rate * 1.1; // expires slightly after next pulse — keeps slow continuous in range
            if (stats.freezeMs > 0) {
              // lv3: brief freeze — only apply if not already frozen longer
              const freezeVt = stats.freezeMs;
              if (!enemy.stunUntil || enemy.stunUntil < vt + freezeVt) {
                enemy.stunUntil = vt + freezeVt;
              }
            } else {
              // lv1/lv2: slow only
              enemy.slowUntil   = vt + slowWindow;
              enemy._slowFactor = stats.slowFactor;
            }
          }
        }
        continue;
      }

      // All other towers — find target
      const fireRate = stats.fireRate || stats.pulseRate || 1000;
      if (vt < (tower.lastFiredAt || 0) + fireRate) continue;

      const target = _findTarget(state.enemies, tx, ty, rangeP);
      if (!target) continue;

      tower.lastFiredAt = vt;
      _fireAt(state, tower, target, stats, tx, ty, T);
    }
  }

  function _findTarget(enemies, tx, ty, rangeP) {
    let best = null, bestPathIndex = -1;
    for (const enemy of enemies) {
      const dx = enemy.px - tx, dy = enemy.py - ty;
      if (dx*dx + dy*dy > rangeP*rangeP) continue;
      if (enemy.pathIndex > bestPathIndex ||
         (enemy.pathIndex === bestPathIndex && best && enemy.hp < best.hp)) {
        best = enemy; bestPathIndex = enemy.pathIndex;
      }
    }
    return best;
  }

  function _fireAt(state, tower, target, stats, tx, ty, T) {
    const id = state._nextProjectileId = (state._nextProjectileId || 0) + 1;

    if (tower.type === 'tesla') {
      // Tesla: instant arc — collect chain targets immediately
      const chainTargets = _getTeslaChain(state.enemies, target, stats.chains, stats.range * T);
      state.projectiles.push({
        id, type: 'tesla',
        ox: tx, oy: ty,          // origin
        chainTargets: [target, ...chainTargets].map(e => ({ id: e.id, px: e.px, py: e.py })),
        damage:  stats.damage,
        life:    0.18,            // seconds to display arc
        maxLife: 0.18,
      });
      // Apply damage immediately to all chain targets
      [target, ...chainTargets].forEach(e => _applyHit(state, tower, e, stats));
      return;
    }

    if (tower.type === 'laser') {
      // Compute and store direction at fire time — bolt travels in a straight line always
      const tdx = target.px - tx, tdy = target.py - ty;
      const tdist = Math.sqrt(tdx*tdx + tdy*tdy) || 1;
      state.projectiles.push({
        id, type: 'laser',
        px: tx, py: ty,
        vx: tdx / tdist,   // unit direction vector — never changes
        vy: tdy / tdist,
        damage:   stats.damage,
        pierce:   stats.pierce,
        hitsLeft: stats.pierce,
        speed:    900,
        hitIds:   new Set(),
      });
      return;
    }

    if (tower.type === 'plasma') {
      state.projectiles.push({
        id, type: 'plasma',
        px: tx, py: ty,
        targetId: target.id,
        damage:       stats.damage,
        splashRadius: stats.splashRadius * T,
        burnDamage:   stats.burnDamage || 0,
        speed:        160,
      });
      return;
    }

    if (tower.type === 'missile') {
      state.projectiles.push({
        id, type: 'missile',
        px: tx, py: ty,
        targetId:     target.id,
        damage:       stats.damage,
        splashRadius: stats.splashRadius * T,
        speed:        220,
        vx: 0, vy: 0,  // velocity — homing sets this each frame
      });
      return;
    }
  }

  function _getTeslaChain(enemies, firstTarget, maxChains, chainRangeP) {
    const chain = [], hitIds = new Set([firstTarget.id]);
    let   last  = firstTarget;
    for (let i = 0; i < maxChains; i++) {
      let nextTarget = null, bestDist = chainRangeP * chainRangeP;
      for (const e of enemies) {
        if (hitIds.has(e.id)) continue;
        const dx = e.px - last.px, dy = e.py - last.py;
        const d2 = dx*dx + dy*dy;
        if (d2 <= bestDist) { nextTarget = e; bestDist = d2; }
      }
      if (!nextTarget) break;
      hitIds.add(nextTarget.id);
      chain.push(nextTarget);
      last = nextTarget;
    }
    return chain;
  }

  function _applyHit(state, tower, enemy, stats) {
    const isDead = GameState.damageEnemy(enemy.id, stats.damage);
    if (isDead) _handleKill(state, enemy);
  }

  function _handleKill(state, enemy) {
    if (enemy.type === 'carrier') EnemyManager.spawnCarrierDrones(state, enemy);
    GameState.removeEnemy(enemy.id);
    GameState.addCredits(Config.ECONOMY.KILL_REWARDS[enemy.type] || 0);
    state.enemiesKilled++;
  }

  return { tick, _handleKill };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECTILE MANAGER
   Moves projectiles each frame, handles impact and splash logic.
   ═══════════════════════════════════════════════════════════════════════════ */
