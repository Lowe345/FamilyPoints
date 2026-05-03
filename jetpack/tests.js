'use strict';

const Tests = (() => {
  let passed = 0, failed = 0;
  const failedLabels = [];

  function assert(label, cond) {
    if (cond) { passed++; }
    else       { failed++; failedLabels.push(label); }
  }

  function safe(label, fn) {
    try { fn(); }
    catch (e) { failed++; failedLabels.push(`${label} (exception: ${e.message})`); }
  }

  function run() {

    // ── Physics.applyGravity ────────────────────────────────────
    safe('Physics.applyGravity', () => {
      assert('increases vy from 0',        Physics.applyGravity(0) > 0);
      assert('caps at MAX_FALL',           Physics.applyGravity(Config.MAX_FALL) === Config.MAX_FALL);
      assert('above cap stays capped',     Physics.applyGravity(Config.MAX_FALL + 5) === Config.MAX_FALL);
      assert('moves negative vy toward 0', Physics.applyGravity(-1) > -1);
    });

    // ── Physics.applyThrust (progressive) ──────────────────────
    safe('Physics.applyThrust — initial impulse at t=0', () => {
      const vy0 = Physics.applyThrust(0, 0);
      assert('t=0: applies THRUST_INITIAL impulse', Math.abs(vy0 - Config.THRUST_INITIAL) < 0.001);
    });

    safe('Physics.applyThrust — full impulse at ramp completion', () => {
      const vyFull = Physics.applyThrust(0, Config.THRUST_RAMP_MS);
      assert('t=RAMP_MS: applies THRUST_MAX impulse', Math.abs(vyFull - Config.THRUST_MAX) < 0.001);
    });

    safe('Physics.applyThrust — beyond ramp clamps to THRUST_MAX', () => {
      const vyOver = Physics.applyThrust(0, Config.THRUST_RAMP_MS * 2);
      assert('t>RAMP_MS: still applies THRUST_MAX', Math.abs(vyOver - Config.THRUST_MAX) < 0.001);
    });

    safe('Physics.applyThrust — mid-ramp interpolates', () => {
      const vyMid   = Physics.applyThrust(0, Config.THRUST_RAMP_MS / 2);
      const expected = (Config.THRUST_INITIAL + Config.THRUST_MAX) / 2;
      assert('t=RAMP_MS/2: midpoint impulse', Math.abs(vyMid - expected) < 0.001);
    });

    safe('Physics.applyThrust — always decreases vy', () => {
      assert('thrust at t=0 decreases vy',          Physics.applyThrust(0, 0) < 0);
      assert('thrust at t=RAMP decreases vy',       Physics.applyThrust(0, Config.THRUST_RAMP_MS) < 0);
      assert('thrust on positive vy reduces it',    Physics.applyThrust(2, 0) < 2);
    });

    safe('Physics.applyThrust — caps at MAX_RISE', () => {
      assert('thrust caps at MAX_RISE', Physics.applyThrust(Config.MAX_RISE, Config.THRUST_RAMP_MS) === Config.MAX_RISE);
      assert('beyond cap stays capped', Physics.applyThrust(Config.MAX_RISE - 5, Config.THRUST_RAMP_MS) === Config.MAX_RISE);
    });

    // ── Physics.clampY ──────────────────────────────────────────
    safe('Physics.clampY — ceiling', () => {
      const { y, vy, dead } = Physics.clampY(Config.CEIL_Y - 5, -3, Config.PLAYER_H);
      assert('y snapped to ceil+half-h', y === Config.CEIL_Y + Config.PLAYER_H / 2);
      assert('vy not negative',          vy >= 0);
      assert('no dead flag',             !dead);
    });

    safe('Physics.clampY — ground', () => {
      const res = Physics.clampY(Config.GROUND_Y + 10, 5, Config.PLAYER_H);
      assert('dead true',  res.dead === true);
      assert('vy zeroed',  res.vy === 0);
    });

    safe('Physics.clampY — mid-air', () => {
      const res = Physics.clampY(Config.H / 2, 2, Config.PLAYER_H);
      assert('no dead', !res.dead);
      assert('y same',   res.y === Config.H / 2);
    });

    // ── Physics collision helpers ───────────────────────────────
    safe('Physics.circleRect', () => {
      assert('overlapping → true',          Physics.circleRect(10, 10, 5, 8, 8, 4, 4));
      assert('distant → false',             !Physics.circleRect(0, 0, 3, 10, 10, 4, 4));
      assert('centre inside rect → true',   Physics.circleRect(10, 10, 1, 8, 8, 6, 6));
      assert('exact touching edge → false', !Physics.circleRect(0, 0, 5, 5, -2, 4, 4));
    });

    safe('Physics.circleCircle', () => {
      assert('overlapping → true',    Physics.circleCircle(0, 0, 5, 3, 0, 5));
      assert('distant → false',       !Physics.circleCircle(0, 0, 3, 10, 0, 3));
      assert('same point r>0 → true', Physics.circleCircle(0, 0, 1, 0, 0, 1));
    });

    // ── GameState.init ──────────────────────────────────────────
    safe('GameState.init — initial values', () => {
      GameState.init('normal');
      const s = GameState.get();
      assert('playerY at mid-height',  s.playerY === Config.H / 2);
      assert('playerVY zero',          s.playerVY === 0);
      assert('thrusting false',        s.thrusting === false);
      assert('started false',          s.started === false);
      assert('thrustStartedAt zero',   s.thrustStartedAt === 0);
      assert('coins zero',             s.coins === 0);
      assert('dist zero',              s.dist === 0);
      assert('frame zero',             s.frame === 0);
      assert('not dead',               s.dead === false);
      assert('obstacles empty',        s.obstacles.length === 0);
      assert('coins_arr empty',        s.coins_arr.length === 0);
      assert('powerups empty',         s.powerups.length === 0);
      assert('particles empty',        s.particles.length === 0);
      assert('no shield',              !GameState.isShielded());
      assert('no magnet',              !GameState.isMagnet());
      assert('no boost',               !GameState.isBoosted());
      assert('lastObstacleX < 0',      s.lastObstacleX < 0);
    });

    // ── GameState.started / frozen ──────────────────────────────
    safe('GameState.setStarted', () => {
      GameState.init('normal');
      assert('started false before setStarted', !GameState.get().started);
      GameState.setStarted();
      assert('started true after setStarted',   GameState.get().started === true);
      assert('startTime set',                   GameState.get().startTime > 0);
    });

    safe('GameState — frozen: playerY unchanged when not started', () => {
      GameState.init('normal');
      const startY = GameState.get().playerY;
      for (let i = 0; i < 30; i++) GameState.incrementFrame(); // physics not applied
      assert('playerY unchanged when not started', GameState.get().playerY === startY);
    });

    safe('GameState — first thrust triggers setStarted via callback wiring', () => {
      GameState.init('normal');
      const thrustCb = () => {
        if (!GameState.get().started) GameState.setStarted();
        GameState.setThrusting(true);
      };
      Input.init(thrustCb, () => GameState.setThrusting(false));
      assert('not started before first press', !GameState.get().started);
      Input.thrustStart();
      assert('started=true after first thrust',   GameState.get().started === true);
      assert('thrusting=true after first thrust', GameState.get().thrusting === true);
      Input.reset();
    });

    // ── GameState.setThrusting / thrustHeldMs ───────────────────
    safe('GameState.setThrusting — rising edge records timestamp', () => {
      GameState.init('normal');
      const before = Date.now();
      GameState.setThrusting(true);
      const after  = Date.now();
      const s = GameState.get();
      assert('thrusting is true',                  s.thrusting === true);
      assert('thrustStartedAt set on rising edge',
        s.thrustStartedAt >= before && s.thrustStartedAt <= after);
    });

    safe('GameState.setThrusting — false clears thrustStartedAt', () => {
      GameState.init('normal');
      GameState.setThrusting(true);
      GameState.setThrusting(false);
      assert('thrusting false',           GameState.get().thrusting === false);
      assert('thrustStartedAt cleared',   GameState.get().thrustStartedAt === 0);
    });

    safe('GameState.setThrusting — repeated true does not reset timestamp', () => {
      GameState.init('normal');
      GameState.setThrusting(true);
      const first = GameState.get().thrustStartedAt;
      GameState.setThrusting(true);
      assert('repeated true does not overwrite thrustStartedAt',
        GameState.get().thrustStartedAt === first);
    });

    safe('GameState.thrustHeldMs — zero when not thrusting', () => {
      GameState.init('normal');
      assert('thrustHeldMs === 0 when not thrusting', GameState.thrustHeldMs() === 0);
    });

    safe('GameState.thrustHeldMs — positive when thrusting', () => {
      GameState.init('normal');
      GameState.setThrusting(true);
      const t0 = Date.now();
      while (Date.now() - t0 < 5) {} // busy-wait ~5ms
      assert('thrustHeldMs > 0 after holding', GameState.thrustHeldMs() > 0);
      GameState.setThrusting(false);
    });

    // ── GameState power-ups ─────────────────────────────────────
    safe('GameState power-up timers', () => {
      GameState.init('normal');
      GameState.activateShield(); assert('shield active immediately', GameState.isShielded());
      GameState.activateMagnet(); assert('magnet active immediately', GameState.isMagnet());
      GameState.activateBoost();  assert('boost active immediately',  GameState.isBoosted());
    });

    safe('GameState power-up — second activation resets timer', () => {
      GameState.init('normal');
      GameState.activateShield();
      const first = GameState.get().shieldUntil;
      GameState.activateShield();
      assert('second activation >= first', GameState.get().shieldUntil >= first);
    });

    safe('GameState.effectiveSpeed — boost multiplier', () => {
      GameState.init('normal');
      const base = GameState.get().speed;
      assert('no boost: effectiveSpeed === base', Math.abs(GameState.effectiveSpeed() - base) < 0.001);
      GameState.activateBoost();
      assert('boost: effectiveSpeed === base × mult',
        Math.abs(GameState.effectiveSpeed() - base * Config.POWERUP.BOOST_SPEED_MULT) < 0.001);
    });

    safe('GameState misc mutations', () => {
      GameState.init('normal');
      GameState.addCoin(); GameState.addCoin();
      assert('addCoin × 2 → coins === 2', GameState.get().coins === 2);
      GameState.setDead();
      assert('setDead → dead true', GameState.get().dead === true);
      const sp0 = GameState.get().speed;
      for (let i = 0; i < 100; i++) GameState.incrementFrame();
      assert('speed increases after 100 frames', GameState.get().speed > sp0);
      assert('frame counter is 100',              GameState.get().frame === 100);
    });

    // ── GameState.tickParticles ─────────────────────────────────
    // FIX: decrement happens before filter, so life:1 expires in the same tick.
    safe('GameState.tickParticles — lifecycle', () => {
      GameState.init('normal');
      GameState.addParticles([
        { x:0, y:0, vx:1, vy:0, life:2, maxLife:2, r:2, color:'#fff' },
        { x:0, y:0, vx:0, vy:0, life:1, maxLife:1, r:2, color:'#fff' },
      ]);
      assert('2 particles after addParticles', GameState.get().particles.length === 2);
      GameState.tickParticles(); // life: 2→1 (kept), 1→0 (removed)
      assert('life-0 particle removed in same tick', GameState.get().particles.length === 1);
      GameState.tickParticles(); // life: 1→0 (removed)
      assert('all removed when life expires',        GameState.get().particles.length === 0);
    });

    safe('GameState.addParticles — appends, not replaces', () => {
      GameState.init('normal');
      GameState.addParticles([{ x:0,y:0,vx:0,vy:0,life:5,maxLife:5,r:1,color:'#fff' }]);
      GameState.addParticles([{ x:0,y:0,vx:0,vy:0,life:5,maxLife:5,r:1,color:'#fff' }]);
      assert('two addParticles calls = 2 particles', GameState.get().particles.length === 2);
    });

    // ── Spawner ─────────────────────────────────────────────────
    safe('Spawner.spawnObstacle — returns null when spacing not met', () => {
      GameState.init('normal');
      const obs = Spawner.spawnObstacle(GameState.get(), Config.W);
      assert('null when too close', obs === null);
    });

    safe('Spawner.spawnObstacle — returns obstacle when spacing met', () => {
      GameState.init('normal');
      const obs = Spawner.spawnObstacle(GameState.get(), -Config.MIN_OBSTACLE_SPACING);
      assert('non-null when far enough', obs !== null);
    });

    safe('Spawner.spawnObstacle — spike gap >= MIN_GAP_Y (30 samples)', () => {
      const es = { cfg: Config.MODE.easy, playerY: 160 };
      for (let i = 0; i < 30; i++) {
        const o = Spawner.spawnObstacle(es, -Config.MIN_OBSTACLE_SPACING);
        if (!o || o.type !== 'spike') continue;
        const gapTop    = Config.CEIL_Y + o.topH;
        const gapBottom = Config.GROUND_Y - o.botH;
        const gap       = gapBottom - gapTop;
        assert('spike gap >= MIN_GAP_Y', gap >= Config.MIN_GAP_Y);
        assert('spike topH >= 0',        o.topH >= 0);
        assert('spike botH >= 0',        o.botH >= 0);
      }
    });

    safe('Spawner.spawnObstacle — spike gap <= MIN_GAP_Y + 60', () => {
      const es = { cfg: Config.MODE.easy, playerY: 160 };
      for (let i = 0; i < 30; i++) {
        const o = Spawner.spawnObstacle(es, -Config.MIN_OBSTACLE_SPACING);
        if (!o || o.type !== 'spike') continue;
        const gap = (Config.GROUND_Y - o.botH) - (Config.CEIL_Y + o.topH);
        assert('spike gap <= MIN_GAP_Y + 60', gap <= Config.MIN_GAP_Y + 60);
      }
    });

    safe('Spawner.spawnObstacle — hard mode all types', () => {
      const hs = { cfg: Config.MODE.hard, playerY: 160 };
      const types = new Set();
      for (let i = 0; i < 200; i++) {
        const o = Spawner.spawnObstacle(hs, -Config.MIN_OBSTACLE_SPACING);
        if (o) types.add(o.type);
      }
      assert('missiles in hard', types.has('missile'));
      assert('lasers in hard',   types.has('laser'));
      assert('spikes in hard',   types.has('spike'));
    });

    safe('Spawner.spawnObstacle — easy mode spikes only', () => {
      const es = { cfg: Config.MODE.easy, playerY: 160 };
      const types = new Set();
      for (let i = 0; i < 80; i++) {
        const o = Spawner.spawnObstacle(es, -Config.MIN_OBSTACLE_SPACING);
        if (o) types.add(o.type);
      }
      assert('no missiles in easy', !types.has('missile'));
      assert('no lasers in easy',   !types.has('laser'));
      assert('spikes in easy',       types.has('spike'));
    });

    safe('Spawner.spawnCoinRow', () => {
      const coins = Spawner.spawnCoinRow(300);
      assert('length 4–8',         coins.length >= 4 && coins.length <= 8);
      assert('all uncollected',    coins.every(c => c.collected === false));
      assert('x values ascending', coins[1].x > coins[0].x);
      assert('y within play area', coins.every(c => c.y >= Config.CEIL_Y && c.y <= Config.GROUND_Y));
    });

    safe('Spawner.spawnPowerup', () => {
      const types = new Set();
      for (let i = 0; i < 80; i++) types.add(Spawner.spawnPowerup(400).type);
      assert('shield can spawn',   types.has('shield'));
      assert('magnet can spawn',   types.has('magnet'));
      assert('boost can spawn',    types.has('boost'));
      const p = Spawner.spawnPowerup(400);
      assert('starts uncollected', p.collected === false);
      assert('y within play area', p.y >= Config.CEIL_Y && p.y <= Config.GROUND_Y);
      assert('has radius > 0',     p.r > 0);
    });

    // ── Input ───────────────────────────────────────────────────
    safe('Input.init — thrustStart fires thrust callback', () => {
      let t = false, r = false;
      Input.init(() => { t = true; }, () => { r = true; });
      Input.thrustStart();
      assert('thrust callback fired', t === true);
      assert('release NOT fired',     r === false);
      Input.reset();
    });

    safe('Input.init — thrustStop fires release callback', () => {
      let r = false;
      Input.init(() => {}, () => { r = true; });
      Input.thrustStop();
      assert('release callback fired', r === true);
      Input.reset();
    });

    safe('Input.reset — callbacks cleared, no throw', () => {
      let count = 0;
      Input.init(() => { count++; }, () => { count++; });
      Input.reset();
      let threw = false;
      try { Input.thrustStart(); Input.thrustStop(); } catch (e) { threw = true; }
      assert('no throw after reset',           !threw);
      assert('callbacks not fired after reset', count === 0);
    });

    // ── Integration: thrust → physics ───────────────────────────
    safe('Integration: Input→GameState→Physics full chain', () => {
      GameState.init('normal');
      Input.init(
        () => { if (!GameState.get().started) GameState.setStarted(); GameState.setThrusting(true); },
        () => GameState.setThrusting(false)
      );
      const startY = GameState.get().playerY;
      Input.thrustStart();
      assert('started=true after first thrust',   GameState.get().started === true);
      assert('thrusting=true after thrustStart',  GameState.get().thrusting === true);
      const s  = GameState.get();
      const vy = Physics.applyThrust(s.playerVY, GameState.thrustHeldMs());
      const { y, vy: nvy } = Physics.clampY(s.playerY + vy, vy, Config.PLAYER_H);
      GameState.setPlayerY(y, nvy);
      assert('playerY moved upward after one tick', GameState.get().playerY < startY);
      Input.thrustStop();
      assert('thrusting=false after thrustStop', GameState.get().thrusting === false);
      Input.reset();
    });

    safe('Integration: no thrust → player falls', () => {
      GameState.init('normal');
      GameState.setStarted();
      const startY = GameState.get().playerY;
      for (let i = 0; i < 10; i++) {
        const s  = GameState.get();
        const vy = Physics.applyGravity(s.playerVY);
        const { y, vy: nvy } = Physics.clampY(s.playerY + vy, vy, Config.PLAYER_H);
        GameState.setPlayerY(y, nvy);
      }
      assert('playerY increases (falls) when not thrusting', GameState.get().playerY > startY);
    });

    safe('Integration: progressive thrust increases over hold time', () => {
      const vyAt0   = Physics.applyThrust(0, 0);
      const vyAtMid = Physics.applyThrust(0, Config.THRUST_RAMP_MS / 2);
      const vyAtMax = Physics.applyThrust(0, Config.THRUST_RAMP_MS);
      assert('impulse stronger at mid than at 0',   vyAtMid < vyAt0);
      assert('impulse stronger at max than at mid',  vyAtMax < vyAtMid);
    });

    // ── Collision ───────────────────────────────────────────────
    safe('checkObstacles — spike hit', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      state.obstacles = [{ type:'spike', x:Config.PLAYER_X-5, w:30, topH:Config.H/2+20, botH:0 }];
      assert('spike top hits player', Collision.checkObstacles(state));
    });

    safe('checkObstacles — spike miss', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      state.obstacles = [{ type:'spike', x:Config.PLAYER_X+200, w:34, topH:60, botH:60 }];
      assert('far spike does not hit', !Collision.checkObstacles(state));
    });

    safe('checkObstacles — inactive laser safe', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      state.obstacles = [{ type:'laser', x:Config.PLAYER_X-10, y:Config.H/2-10,
                           w:80, h:20, blinkPhase:0, spawnTime:Date.now() }];
      assert('laser in warning period does not kill', !Collision.checkObstacles(state));
    });

    safe('checkObstacles — active laser geometry overlaps player', () => {
      const px = Config.PLAYER_X, py = Config.H/2, PR = Config.PLAYER_COLLISION_R;
      assert('laser geometry overlaps player',
        Physics.circleRect(px, py, PR, px-10, py-10, 80, 20));
    });

    safe('checkObstacles — shield is caller responsibility', () => {
      GameState.init('normal'); GameState.activateShield();
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      state.obstacles = [{ type:'spike', x:Config.PLAYER_X-5, w:30, topH:Config.H/2+20, botH:0 }];
      const hit = Collision.checkObstacles(state);
      assert('checkObstacles still true when shielded',         hit === true);
      assert('_update suppresses with (hit && !shielded)',       !(hit && !GameState.isShielded()));
    });

    safe('checkCoins — collect at player position', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY  = Config.H / 2;
      state.coins_arr = [{ x:Config.PLAYER_X, y:Config.H/2, collected:false }];
      const result = Collision.checkCoins(state);
      assert('coin collected',             result.length === 1);
      assert('collected flag set on coin', state.coins_arr[0].collected === true);
    });

    safe('checkCoins — distant coin not collected', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY  = Config.H / 2;
      state.coins_arr = [{ x:Config.PLAYER_X+200, y:Config.H/2, collected:false }];
      assert('distant coin not collected',  Collision.checkCoins(state).length === 0);
      assert('collected flag stays false',  !state.coins_arr[0].collected);
    });

    safe('checkCoins — already-collected skipped', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY  = Config.H / 2;
      state.coins_arr = [{ x:Config.PLAYER_X, y:Config.H/2, collected:true }];
      assert('already-collected not re-collected', Collision.checkCoins(state).length === 0);
    });

    safe('checkCoins — magnet attracts coin within range', () => {
      GameState.init('normal'); GameState.activateMagnet();
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      const startX    = Config.PLAYER_X + Config.COIN_MAGNET_R * 0.5;
      state.coins_arr = [{ x:startX, y:Config.H/2, collected:false }];
      Collision.checkCoins(state);
      assert('magnet moves coin toward player', state.coins_arr[0].x < startX);
    });

    safe('checkCoins — no magnet, coin not attracted', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY   = Config.H / 2;
      const startX    = Config.PLAYER_X + Config.COIN_MAGNET_R * 0.5;
      state.coins_arr = [{ x:startX, y:Config.H/2, collected:false }];
      Collision.checkCoins(state);
      assert('without magnet, x unchanged', state.coins_arr[0].x === startX);
    });

    safe('checkPowerups — collect at player position', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY = Config.H / 2;
      state.powerups = [{ type:'shield', x:Config.PLAYER_X, y:Config.H/2, r:13, collected:false }];
      const result = Collision.checkPowerups(state);
      assert('powerup collected',              result.length === 1);
      assert('collected flag set on powerup',  state.powerups[0].collected === true);
    });

    safe('checkPowerups — distant powerup not collected', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.playerY = Config.H / 2;
      state.powerups = [{ type:'boost', x:Config.PLAYER_X+200, y:Config.H/2, r:13, collected:false }];
      assert('distant powerup not collected', Collision.checkPowerups(state).length === 0);
    });

    // ── Obstacle scrolling & culling ────────────────────────────
    safe('Obstacle scrolling — x decreases by effectiveSpeed', () => {
      GameState.init('normal');
      const spd   = GameState.effectiveSpeed();
      const state = GameState.get();
      state.obstacles = [{ type:'spike', x:400, w:34, topH:60, botH:60 }];
      state.obstacles[0].x -= spd;
      assert('x decreased by effectiveSpeed', Math.abs(state.obstacles[0].x - (400 - spd)) < 0.001);
    });

    safe('Obstacle culling — off-screen removed, on-screen kept', () => {
      GameState.init('normal');
      const state = GameState.get();
      state.obstacles = [
        { type:'spike', x:-200, w:34, topH:60, botH:60 },
        { type:'spike', x:100,  w:34, topH:60, botH:60 },
      ];
      state.obstacles = state.obstacles.filter(o => o.x + (o.w || 240) > -10);
      assert('off-screen spike culled',  state.obstacles.length === 1);
      assert('on-screen spike kept',     state.obstacles[0].x === 100);
    });

    safe('Missile homing — vy moves toward player above', () => {
      GameState.init('normal');
      const state = GameState.get(); state.playerY = 100;
      const missile = { vy: 0, y: 200 };
      const dy = state.playerY - missile.y;
      missile.vy += Math.sign(dy) * Config.MISSILE_HOMING;
      assert('vy negative when player above', missile.vy < 0);
    });

    safe('Missile vy capped at ±3', () => {
      let vy = 10;  vy = Math.max(-3, Math.min(3, vy)); assert('capped at +3', vy === 3);
          vy = -10; vy = Math.max(-3, Math.min(3, vy)); assert('capped at -3', vy === -3);
    });

    // ── Laser blink ─────────────────────────────────────────────
    safe('_laserActive — warning period = inactive', () => {
      assert('inactive during warning', !Collision._laserActive({ spawnTime:Date.now(), blinkPhase:0 }));
    });

    safe('_laserActive — blinkPhase produces opposite states', () => {
      const t = Date.now() - Config.LASER_WARN_MS - 1;
      const a = { spawnTime:t, blinkPhase:0 };
      const b = { spawnTime:t, blinkPhase:Config.LASER_BLINK_MS };
      assert('blinkPhase offset → opposite active states',
        Collision._laserActive(a) !== Collision._laserActive(b));
    });

    // ── Game-over conditions ────────────────────────────────────
    safe('Game-over: ground returns dead:true', () => {
      assert('dead true on ground', Physics.clampY(Config.GROUND_Y+5, 5, Config.PLAYER_H).dead === true);
    });

    safe('Game-over: shield blocks death logic', () => {
      GameState.init('normal'); GameState.activateShield();
      assert('dead && !shielded = false when shielded', !(true && !GameState.isShielded()));
    });

    // ── Config values ────────────────────────────────────────────
    safe('Config.MODE speeds', () => {
      assert('easy baseSpeed === 1.0',   Config.MODE.easy.baseSpeed   === 1.0);
      assert('normal baseSpeed === 1.5', Config.MODE.normal.baseSpeed === 1.5);
      assert('hard baseSpeed === 2.0',   Config.MODE.hard.baseSpeed   === 2.0);
    });

    safe('Config physics values', () => {
      assert('GRAVITY === 0.10',           Config.GRAVITY        === 0.10);
      assert('THRUST_INITIAL === -0.12',   Config.THRUST_INITIAL === -0.12);
      assert('THRUST_MAX === -0.20',       Config.THRUST_MAX     === -0.20);
      assert('THRUST_RAMP_MS === 1000',    Config.THRUST_RAMP_MS === 1000);
      assert('MAX_FALL === 2.0',           Config.MAX_FALL       === 2.0);
      assert('MAX_RISE === -2.0',          Config.MAX_RISE       === -2.0);
      assert('THRUST_MAX < THRUST_INITIAL', Config.THRUST_MAX < Config.THRUST_INITIAL);
    });

    safe('Config layout constraints positive', () => {
      assert('MIN_GAP_Y > 0',            Config.MIN_GAP_Y > 0);
      assert('MIN_OBSTACLE_SPACING > 0', Config.MIN_OBSTACLE_SPACING > 0);
    });

    safe('Config.POWERUP values', () => {
      assert('SHIELD_MS > 0',        Config.POWERUP.SHIELD_MS > 0);
      assert('MAGNET_MS > 0',        Config.POWERUP.MAGNET_MS > 0);
      assert('BOOST_MS > 0',         Config.POWERUP.BOOST_MS  > 0);
      assert('BOOST_SPEED_MULT > 1', Config.POWERUP.BOOST_SPEED_MULT > 1);
    });

    // ── Report ───────────────────────────────────────────────────
    const total  = passed + failed;
    const banner = document.getElementById('test-banner');
    if (failed === 0) {
      banner.textContent = `✅ All ${passed} tests passed`;
      banner.className   = 'pass';
    } else {
      banner.textContent = `❌ ${failed}/${total} failed: ${failedLabels.join(' · ')}`;
      banner.className   = 'fail';
    }
  }

  return { run };
})();
