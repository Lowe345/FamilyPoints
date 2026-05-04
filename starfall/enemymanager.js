'use strict';
const EnemyManager = (() => {

  // Move all enemies one frame forward. Returns array of events.
  // dt = delta time in seconds since last frame.
  function tick(state, dt) {
    const events  = [];
    const T       = Config.GRID.TILE;
    const vt      = state.virtualTime;  // virtual time for slow/stun expiry
    const now     = Date.now();         // real time for burn ticks only
    const dead    = [];

    for (const enemy of state.enemies) {
      // Burn damage tick
      if (enemy.burnDamage > 0 && now >= enemy.burnTick) {
        enemy.hp = Math.max(0, enemy.hp - enemy.burnDamage);
        enemy.burnTick = now + 500;
        if (enemy.hp <= 0) {
          dead.push(enemy);
          events.push({ type: 'died', enemy });
          continue;
        }
      }

      // Stun — skip movement (uses virtualTime)
      if (vt < (enemy.stunUntil || 0)) continue;

      // Speed — cryo slow applies (uses virtualTime)
      const slowFactor     = vt < (enemy.slowUntil || 0) ? (enemy._slowFactor || 0.5) : 1.0;
      const effectiveSpeed = enemy.speed * slowFactor;

      // Advance progress towards next waypoint
      enemy.progress += effectiveSpeed * dt;

      // Step through waypoints while progress >= 1
      while (enemy.progress >= 1) {
        enemy.progress -= 1;
        enemy.pathIndex++;

        if (enemy.pathIndex >= state.path.length) {
          events.push({ type: 'reached', enemy });
          dead.push(enemy);
          break;
        }
      }

      if (dead.includes(enemy)) continue;

      // Interpolate pixel position between current and next waypoint
      const cur  = state.path[enemy.pathIndex];
      const next = state.path[Math.min(enemy.pathIndex + 1, state.path.length - 1)];
      enemy.px = (cur.col + (next.col - cur.col) * enemy.progress) * T + T / 2;
      enemy.py = (cur.row + (next.row - cur.row) * enemy.progress) * T + T / 2;
    }

    // Remove dead/reached enemies
    dead.forEach(e => GameState.removeEnemy(e.id));

    return events;
  }

  // Kill an enemy: remove it, return kill reward.
  function kill(enemy) {
    GameState.removeEnemy(enemy.id);
    return Config.ECONOMY.KILL_REWARDS[enemy.type] || 0;
  }

  // Spawn drones at a carrier's path position when it dies.
  function spawnCarrierDrones(state, carrier) {
    const droneCount       = Config.ENEMIES.carrier.droneCount;
    const invulnerableUntil = state.virtualTime + Config.ENEMIES.carrier.droneInvulnerableMs;
    for (let i = 0; i < droneCount; i++) {
      const pidx = Math.max(0, carrier.pathIndex - i);
      const drone = GameState.spawnEnemy('drone', pidx, { invulnerableUntil });
      // Copy carrier's sub-cell progress so drones don't teleport to cell centre
      drone.progress = Math.max(0, carrier.progress - i * 0.15);
    }
  }

  return { tick, kill, spawnCarrierDrones };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   TOWER MANAGER
   Each frame: find target for each tower, fire if cooldown elapsed.
   Targeting: enemy with highest pathIndex (closest to base) within range.
   Cryo is handled as a pulse aura — no projectile spawned.
   ═══════════════════════════════════════════════════════════════════════════ */
