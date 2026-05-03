'use strict';

const GameState = (() => {
  let s = null;

  function _makeStars() {
    const a = [];
    for (let i = 0; i < 80; i++)
      a.push({ x: Math.random()*Config.W, y: Math.random()*Config.H,
               r: Math.random()*1.5+0.3,  sp: 0.2+Math.random()*0.5 });
    return a;
  }

  function init(mode) {
    const cfg = Config.MODE[mode];
    s = {
      mode, cfg,
      playerY:  Config.H / 2,
      playerVY: 0,
      thrusting: false,
      thrustStartedAt: 0,  // timestamp of current press start
      started: false,       // frozen until first thrust press
      dist:  0,
      speed: cfg.baseSpeed,
      coins: 0,
      frame: 0,
      lastObstacleX: -Config.MIN_OBSTACLE_SPACING, // pre-seeded for spacing logic
      obstacles:  [],
      coins_arr:  [],
      powerups:   [],
      particles:  [],
      bgStars:    _makeStars(),
      shieldUntil: 0,
      magnetUntil: 0,
      boostUntil:  0,
      dead:      false,
      startTime: 0, // set on first thrust press via setStarted()
    };
  }

  function get()         { return s; }
  function setStarted()  { s.started = true; s.startTime = Date.now(); }

  // Rising edge: record when this press began so Physics.applyThrust can ramp.
  // Repeated true calls while already thrusting do NOT reset the timestamp.
  function setThrusting(v) {
    if (v && !s.thrusting) s.thrustStartedAt = Date.now();
    if (!v) s.thrustStartedAt = 0;
    s.thrusting = v;
  }

  function thrustHeldMs() {
    return s.thrusting ? Math.max(0, Date.now() - s.thrustStartedAt) : 0;
  }

  function setPlayerY(y, vy)   { s.playerY = y; s.playerVY = vy; }
  function addCoin()            { s.coins++; }
  function incrementDist()      { s.dist = Math.floor(s.dist + s.speed * 0.05); }
  function incrementFrame()     { s.frame++; s.speed = s.cfg.baseSpeed + s.frame * s.cfg.speedInc; }
  function setLastObstacleX(x) { s.lastObstacleX = x; }
  function addParticles(ps)     { s.particles.push(...ps); }

  // FIX: decrement life BEFORE filtering so a particle with life:1 is removed
  // in the same tick it expires, not left alive at life:0 for one extra frame.
  function tickParticles() {
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life--; p.vy += 0.05; }
    s.particles = s.particles.filter(p => p.life > 0);
  }

  function activateShield()  { s.shieldUntil = Date.now() + Config.POWERUP.SHIELD_MS; }
  function activateMagnet()  { s.magnetUntil = Date.now() + Config.POWERUP.MAGNET_MS; }
  function activateBoost()   { s.boostUntil  = Date.now() + Config.POWERUP.BOOST_MS;  }
  function isShielded()      { return Date.now() < s.shieldUntil; }
  function isMagnet()        { return Date.now() < s.magnetUntil; }
  function isBoosted()       { return Date.now() < s.boostUntil;  }
  function effectiveSpeed()  { return s.speed * (isBoosted() ? Config.POWERUP.BOOST_SPEED_MULT : 1); }
  function setDead()         { s.dead = true; }
  function elapsed()         { return s.startTime ? Math.floor((Date.now() - s.startTime) / 1000) : 0; }

  return {
    init, get, setStarted,
    setThrusting, thrustHeldMs,
    setPlayerY, addCoin, incrementDist, incrementFrame,
    setLastObstacleX, addParticles, tickParticles,
    activateShield, activateMagnet, activateBoost,
    isShielded, isMagnet, isBoosted, effectiveSpeed,
    setDead, elapsed,
  };
})();
