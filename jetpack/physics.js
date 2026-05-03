'use strict';

const Physics = (() => {
  function applyGravity(vy) {
    return Math.min(vy + Config.GRAVITY, Config.MAX_FALL);
  }

  // Progressive thrust: interpolates impulse from THRUST_INITIAL to THRUST_MAX
  // over THRUST_RAMP_MS milliseconds of continuous holding.
  function applyThrust(vy, thrustHeldMs) {
    const t = Math.min(thrustHeldMs / Config.THRUST_RAMP_MS, 1.0);
    const impulse = Config.THRUST_INITIAL + (Config.THRUST_MAX - Config.THRUST_INITIAL) * t;
    return Math.max(vy + impulse, Config.MAX_RISE);
  }

  // Returns { y, vy, dead? }. dead only on ground; ceiling bounces.
  function clampY(y, vy, h) {
    if (y - h/2 <= Config.CEIL_Y)   return { y: Config.CEIL_Y + h/2,   vy: Math.max(0, vy) };
    if (y + h/2 >= Config.GROUND_Y) return { y: Config.GROUND_Y - h/2, vy: 0, dead: true };
    return { y, vy };
  }

  // Circle (cx,cy,cr) vs axis-aligned rect (rx,ry,rw,rh)
  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx, dy = cy - ny;
    return dx*dx + dy*dy < cr*cr;
  }

  function circleCircle(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    return dx*dx + dy*dy < (ar+br)*(ar+br);
  }

  return { applyGravity, applyThrust, clampY, circleRect, circleCircle };
})();
