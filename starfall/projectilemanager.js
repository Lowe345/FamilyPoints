'use strict';
const ProjectileManager = (() => {

  function tick(state, dt) {
    const dead = [];

    for (const proj of state.projectiles) {

      if (proj.type === 'tesla') {
        // Arc: just count down display life, damage already applied
        proj.life -= dt;
        if (proj.life <= 0) dead.push(proj);
        continue;
      }

      if (proj.type === 'laser') {
        _tickLaser(state, proj, dt, dead);
        continue;
      }

      if (proj.type === 'plasma') {
        _tickPlasma(state, proj, dt, dead);
        continue;
      }

      if (proj.type === 'missile') {
        _tickMissile(state, proj, dt, dead);
        continue;
      }
    }

    dead.forEach(p => {
      const idx = state.projectiles.indexOf(p);
      if (idx !== -1) state.projectiles.splice(idx, 1);
    });
  }

  function _tickLaser(state, proj, dt, dead) {
    // Move in fixed direction — bolt never changes course
    const step = proj.speed * dt;
    proj.px += proj.vx * step;
    proj.py += proj.vy * step;

    // Check all enemies within hit radius of current position
    const hitRadius = 7;
    for (const enemy of [...state.enemies]) {
      if (proj.hitIds.has(enemy.id)) continue;
      const dx = enemy.px - proj.px, dy = enemy.py - proj.py;
      if (dx*dx + dy*dy <= hitRadius*hitRadius) {
        proj.hitIds.add(enemy.id);
        proj.hitsLeft--;
        const isDead = GameState.damageEnemy(enemy.id, proj.damage);
        if (isDead) TowerManager._handleKill(state, enemy);
        if (proj.hitsLeft <= 0) { dead.push(proj); return; }
      }
    }

    // Despawn if off grid
    const T  = Config.GRID.TILE;
    const gW = Config.GRID.COLS * T, gH = Config.GRID.ROWS * T;
    if (proj.px < 0 || proj.px > gW || proj.py < 0 || proj.py > gH) dead.push(proj);
  }

  function _tickPlasma(state, proj, dt, dead) {
    const target = GameState.getEnemyById(proj.targetId);
    const tx = target ? target.px : proj.px;
    const ty = target ? target.py : proj.py;
    const dx = tx - proj.px, dy = ty - proj.py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const step = proj.speed * dt;

    if (dist <= step + 4 || !target) {
      // Splash impact
      _splashDamage(state, proj.px, proj.py, proj.splashRadius, proj.damage, proj.burnDamage);
      dead.push(proj);
      // Add impact flash marker
      state.projectiles.push({
        id: -proj.id, type: 'impact',
        px: proj.px, py: proj.py,
        radius: proj.splashRadius,
        color: '#c060ff',
        life: 0.3, maxLife: 0.3,
      });
      return;
    }
    if (dist > 0) { proj.px += (dx/dist)*step; proj.py += (dy/dist)*step; }
  }

  function _tickMissile(state, proj, dt, dead) {
    const target = GameState.getEnemyById(proj.targetId);
    if (target) {
      // Homing — rotate velocity toward target
      const dx = target.px - proj.px, dy = target.py - proj.py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
        const tx = dx/dist * proj.speed, ty = dy/dist * proj.speed;
        proj.vx = proj.vx ? proj.vx * 0.7 + tx * 0.3 : tx;
        proj.vy = proj.vy ? proj.vy * 0.7 + ty * 0.3 : ty;
      }
      if (dist <= proj.speed * dt + 6) {
        _splashDamage(state, target.px, target.py, proj.splashRadius, proj.damage, 0);
        dead.push(proj);
        state.projectiles.push({
          id: -proj.id, type: 'impact',
          px: target.px, py: target.py,
          radius: proj.splashRadius,
          color: '#ff6040',
          life: 0.35, maxLife: 0.35,
        });
        return;
      }
    } else {
      // Target gone — keep going straight
      if (!proj.vx && !proj.vy) { proj.vx = proj.speed; proj.vy = 0; }
    }
    proj.px += proj.vx * dt;
    proj.py += proj.vy * dt;

    const T = Config.GRID.TILE;
    const gW = Config.GRID.COLS * T, gH = Config.GRID.ROWS * T;
    if (proj.px < 0 || proj.px > gW || proj.py < 0 || proj.py > gH) dead.push(proj);
  }

  function _splashDamage(state, cx, cy, radius, damage, burnDamage) {
    for (const enemy of [...state.enemies]) {
      const dx = enemy.px - cx, dy = enemy.py - cy;
      if (dx*dx + dy*dy <= radius*radius) {
        const isDead = GameState.damageEnemy(enemy.id, damage);
        if (burnDamage > 0) {
          enemy.burnDamage = burnDamage;
          enemy.burnTick   = Date.now() + 500;
        }
        if (isDead) TowerManager._handleKill(state, enemy);
      }
    }
  }

  return { tick };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   WAVE CONTROLLER
   Manages wave lifecycle: countdown → spawning → wave-clear → next wave.
   Uses setInterval for spawning (fixed-rate, easy to test) and
   requestAnimationFrame only for rendering (handled by Game).
   ═══════════════════════════════════════════════════════════════════════════ */
