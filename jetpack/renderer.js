'use strict';

const Renderer = (() => {
  const canvas = document.getElementById('game-canvas');
  const ctx    = canvas.getContext('2d');

  function setup() {
    canvas.width  = Config.W;
    canvas.height = Config.H;
    const scale = Math.min(1, (Math.min(window.innerWidth - 20, 620)) / Config.W);
    canvas.style.width  = Math.floor(Config.W * scale) + 'px';
    canvas.style.height = Math.floor(Config.H * scale) + 'px';
  }

  // ── Background ───────────────────────────────────────────────
  function _bg(state) {
    const g = ctx.createLinearGradient(0, 0, 0, Config.H);
    g.addColorStop(0, '#05080f'); g.addColorStop(0.6, '#08101e'); g.addColorStop(1, '#0a1828');
    ctx.fillStyle = g; ctx.fillRect(0, 0, Config.W, Config.H);

    const sp = GameState.effectiveSpeed() * 0.3;
    for (const st of state.bgStars) {
      st.x -= st.sp * (sp / 2.0);
      if (st.x < 0) { st.x = Config.W; st.y = Math.random() * Config.H; }
      ctx.fillStyle = `rgba(180,220,255,${0.3 + st.r * 0.2})`;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    }

    const gg = ctx.createLinearGradient(0, Config.GROUND_Y - 4, 0, Config.H);
    gg.addColorStop(0, '#00d4ff44'); gg.addColorStop(1, '#00d4ff00');
    ctx.fillStyle = gg;
    ctx.fillRect(0, Config.GROUND_Y - 4, Config.W, Config.H - Config.GROUND_Y + 4);
    ctx.strokeStyle = '#00d4ff66'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, Config.GROUND_Y); ctx.lineTo(Config.W, Config.GROUND_Y); ctx.stroke();
    ctx.strokeStyle = '#00d4ff33'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Config.CEIL_Y); ctx.lineTo(Config.W, Config.CEIL_Y); ctx.stroke();

    const off = (state.frame * GameState.effectiveSpeed() * 0.5) % 60;
    ctx.strokeStyle = '#00d4ff18'; ctx.lineWidth = 1;
    for (let x = -off; x < Config.W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, Config.GROUND_Y); ctx.lineTo(x + 20, Config.H); ctx.stroke();
    }
  }

  // ── Obstacles ────────────────────────────────────────────────
  function _spike(o) {
    function half(y1, h, flip) {
      if (h <= 0) return;
      const gr = ctx.createLinearGradient(0, y1, 0, y1 + h);
      gr.addColorStop(0, '#1a3a5a'); gr.addColorStop(1, '#2a6a9a');
      ctx.fillStyle = gr; ctx.fillRect(o.x, y1, o.w, h);
      ctx.fillStyle = '#50b0e0'; ctx.beginPath();
      ctx.moveTo(o.x, y1 + h);
      ctx.lineTo(o.x + o.w / 2, y1 + h + (flip ? -16 : 16));
      ctx.lineTo(o.x + o.w, y1 + h);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#80d0ff'; ctx.lineWidth = 1;
      ctx.strokeRect(o.x, y1, o.w, h);
    }
    half(Config.CEIL_Y,              o.topH, false);
    half(Config.GROUND_Y - o.botH,   o.botH, true);
  }

  function _laser(o) {
    const age = Date.now() - o.spawnTime;
    if (age < Config.LASER_WARN_MS) {
      const a = 0.3 + 0.5 * Math.sin(age / 60 * Math.PI);
      ctx.fillStyle   = `rgba(255,80,80,${a})`;   ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = `rgba(255,150,80,${a})`; ctx.lineWidth = 1; ctx.strokeRect(o.x, o.y, o.w, o.h);
      return;
    }
    const cyc    = (age - Config.LASER_WARN_MS + o.blinkPhase) % (Config.LASER_BLINK_MS * 2);
    const active = cyc < Config.LASER_BLINK_MS;
    if (!active) { ctx.fillStyle = 'rgba(80,20,20,0.4)'; ctx.fillRect(o.x, o.y, o.w, o.h); return; }
    ctx.save(); ctx.shadowColor = '#ff4040'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff2020'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#ffaaaa'; ctx.fillRect(o.x, o.y + o.h * 0.3, o.w, o.h * 0.4);
    ctx.restore();
    ctx.fillStyle = '#ff6060';
    ctx.beginPath(); ctx.arc(o.x,       o.y + o.h / 2, o.h * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x + o.w, o.y + o.h / 2, o.h * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  function _missile(o) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.atan2(o.vy, -2));
    ctx.fillStyle = '#d0d0e0'; ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
    ctx.fillStyle = '#f05050';
    ctx.beginPath(); ctx.moveTo(-o.w/2, -o.h/2); ctx.lineTo(-o.w/2 - 10, 0); ctx.lineTo(-o.w/2, o.h/2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8080a0';
    ctx.beginPath(); ctx.moveTo(o.w/2, -o.h/2); ctx.lineTo(o.w/2+8, -o.h/2-6); ctx.lineTo(o.w/2, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(o.w/2,  o.h/2);  ctx.lineTo(o.w/2+8,  o.h/2+6);  ctx.lineTo(o.w/2, 0); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff8040'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ff8040'; ctx.beginPath(); ctx.arc(o.w/2 + 3, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); ctx.restore();
  }

  // ── Coins ────────────────────────────────────────────────────
  function _coins(state) {
    const pulse = 0.85 + 0.15 * Math.sin(state.frame / 8);
    for (const c of state.coins_arr) {
      if (c.collected) continue;
      ctx.save(); ctx.shadowColor = '#ffd060'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd060'; ctx.beginPath(); ctx.arc(c.x, c.y, Config.COIN_R * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe890'; ctx.beginPath(); ctx.arc(c.x - 2, c.y - 2, Config.COIN_R * pulse * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Power-ups ────────────────────────────────────────────────
  const PUC = { shield: '#40c0ff', magnet: '#ff40ff', boost: '#ff8020' };
  const PUL = { shield: 'S',       magnet: 'M',       boost: 'B'       };

  function _pups(state) {
    for (const p of state.powerups) {
      if (p.collected) continue;
      const col = PUC[p.type];
      const bob = Math.sin(state.frame / 12 + p.x) * 3;
      ctx.save(); ctx.translate(p.x, p.y + bob); ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col + '33'; ctx.fill();
      ctx.rotate(state.frame / 30); ctx.fillStyle = col;
      ctx.fillRect(-3, -p.r + 4, 6, 8); ctx.fillRect(-p.r + 4, -3, 8, 6);
      ctx.restore();
      ctx.fillStyle = col;
      ctx.font = 'bold 9px Orbitron,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(PUL[p.type], p.x, p.y + bob);
    }
  }

  // ── Player (canvas primitives — no emoji) ────────────────────
  function _player(state) {
    const px = Config.PLAYER_X, py = state.playerY;
    const th = state.thrusting, sh = GameState.isShielded(), bo = GameState.isBoosted(), t = state.frame;
    ctx.save(); ctx.translate(px, py);

    // Shield bubble
    if (sh) {
      const sr = 20 + Math.sin(t / 8) * 2;
      ctx.save(); ctx.shadowColor = '#40c0ff'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#40c0ff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, sr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#40c0ff'; ctx.fill(); ctx.restore();
    }

    // Jetpack flame
    if (bo || th) {
      const fc  = bo ? '#ff8020' : '#00aaff';
      const fc2 = bo ? '#ffdd40' : '#80e0ff';
      const fH  = 10 + Math.random() * (bo ? 16 : 10);
      const fW  = 8  + Math.random() * 4;
      ctx.save(); ctx.shadowColor = fc; ctx.shadowBlur = 12;
      const gr = ctx.createLinearGradient(-14, 4, -14 - fH, 4);
      gr.addColorStop(0, fc2); gr.addColorStop(1, fc + '00');
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(-12 - fH, 4 - fW/2); ctx.lineTo(-12 - fH*0.6, 4);
      ctx.lineTo(-12 - fH, 4 + fW/2); ctx.lineTo(-12, 8);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // Jetpack body
    ctx.fillStyle = '#304060'; ctx.fillRect(-14, -8, 8, 18);
    ctx.fillStyle = '#405070'; ctx.fillRect(-13, -6, 6, 6);
    ctx.fillStyle = '#506090'; ctx.fillRect(-13,  1, 6, 6);
    ctx.fillStyle = '#203040'; ctx.fillRect(-15,  7, 4, 5);
    ctx.fillStyle = '#ff8040';
    if (th) { ctx.shadowColor = '#ff8040'; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.arc(-13, 12, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

    // Legs
    const lg = th ? Math.sin(t / 4) * 3 : 0;
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(-4,  8, 6, 8 + lg); ctx.fillRect(2, 8, 6, 8 - lg);
    ctx.fillStyle = '#1a2a40';
    ctx.fillRect(-5, 14 + lg, 7, 4); ctx.fillRect(1, 14 - lg, 7, 4);

    // Torso
    ctx.fillStyle = '#3050a0'; ctx.fillRect(-6, -5, 16, 14);
    ctx.fillStyle = '#4070c0'; ctx.fillRect(-4, -4,  5,  6);
    ctx.fillStyle = bo ? '#ff8020' : '#00d4ff'; ctx.fillRect(1, -3, 4, 10);

    // Arms
    const ay = th ? -2 : 0;
    ctx.fillStyle = '#2a3a6a';
    ctx.fillRect(-6, -3, 4, 8 + ay); ctx.fillRect(10, -3, 4, 8 - ay);
    ctx.fillStyle = '#3a5080';
    ctx.fillRect(-7, 4 + ay, 5, 4); ctx.fillRect(10, 4 - ay, 5, 4);

    // Head + helmet
    ctx.fillStyle = '#e8c090'; ctx.fillRect(-3, -14, 10, 9);
    ctx.fillStyle = '#3050a0';
    ctx.fillRect(-4, -17, 12, 8); ctx.fillRect(-4, -14, 2, 5); ctx.fillRect(10, -14, 2, 5);
    ctx.fillStyle = bo ? '#ffaa40' : '#00d4ff';
    ctx.shadowColor = bo ? '#ff8020' : '#00d4ff'; ctx.shadowBlur = 6;
    ctx.fillRect(-1, -13, 8, 5); ctx.shadowBlur = 0;
    ctx.fillStyle = '#f05050'; ctx.fillRect(1, -21, 4, 5);

    ctx.restore();
  }

  // ── Particles ────────────────────────────────────────────────
  function _particles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── "Press to start" overlay ─────────────────────────────────
  function _startHint(state) {
    if (state.started) return;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(state.frame / 18));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle   = '#00d4ff';
    ctx.font        = 'bold 13px Orbitron,monospace';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PRESS TO START', Config.W / 2, Config.H / 2 - 30);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Main draw call ───────────────────────────────────────────
  function drawFrame(state) {
    _bg(state);
    for (const o of state.obstacles) {
      if      (o.type === 'spike')   _spike(o);
      else if (o.type === 'laser')   _laser(o);
      else if (o.type === 'missile') _missile(o);
    }
    _coins(state); _pups(state); _particles(state); _player(state); _startHint(state);
  }

  // ── Menu preview animation ───────────────────────────────────
  function drawMenuPreview(cv) {
    const c = cv.getContext('2d'), t = Date.now() / 60;
    c.clearRect(0, 0, 400, 120); c.fillStyle = '#05080f'; c.fillRect(0, 0, 400, 120);
    c.strokeStyle = '#00d4ff44'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 105); c.lineTo(400, 105); c.stroke();
    const sx = 300 - (t * 1.5) % 350;
    c.fillStyle = '#2a6a9a'; c.fillRect(sx, 85, 30, 20);
    c.fillStyle = '#50b0e0'; c.beginPath(); c.moveTo(sx,85); c.lineTo(sx+15,70); c.lineTo(sx+30,85); c.closePath(); c.fill();
    const lx = 380 - (t * 1.5) % 450;
    c.save(); c.shadowColor = '#ff4040'; c.shadowBlur = 10; c.fillStyle = '#ff2020'; c.fillRect(lx,50,80,12); c.restore();
    for (let i = 0; i < 5; i++) {
      const cx = 180 + i*22 - (t*1.5)%280;
      c.save(); c.shadowColor='#ffd060'; c.shadowBlur=6; c.fillStyle='#ffd060';
      c.beginPath(); c.arc(cx,75,5,0,Math.PI*2); c.fill(); c.restore();
    }
    const py2 = 60 + Math.sin(t * 0.06) * 18;
    c.fillStyle='#3050a0'; c.fillRect(60,py2-8,18,16);
    c.fillStyle='#00d4ff'; c.fillRect(62,py2-7,5,10);
    c.fillStyle='#e8c090'; c.fillRect(65,py2-16,10,9);
    c.fillStyle='#3050a0'; c.fillRect(64,py2-19,12,7); c.fillStyle='#00d4ff'; c.fillRect(66,py2-17,8,5);
    c.fillStyle='#304060'; c.fillRect(52,py2-7,8,16);
    c.save(); c.shadowColor='#00aaff'; c.shadowBlur=10; c.fillStyle='#80e0ff'; c.fillRect(46,py2+2,8,4); c.restore();
  }

  // Draws a death overlay directly onto the frozen game canvas.
  // Called once by _endGame after loops stop. Canvas pointer events are
  // disabled by Input.reset() so the hit-test areas are registered via
  // the click listener added here, cleared on the next Game.start().
  let _deathClickHandler = null;
  function drawDeathScreen(dist, coins) {
    const W = Config.W, H = Config.H;
    const cx = W / 2;

    // Dim the frozen game
    ctx.fillStyle = 'rgba(5,8,15,0.78)';
    ctx.fillRect(0, 0, W, H);

    // CRASHED heading
    ctx.save();
    ctx.shadowColor = '#f05050'; ctx.shadowBlur = 24;
    ctx.fillStyle   = '#f05050';
    ctx.font        = 'bold 900 28px Orbitron, monospace';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CRASHED!', cx, H/2 - 68);
    ctx.restore();

    // Stats line
    ctx.fillStyle   = '#8090a0';
    ctx.font        = '13px Exo\\ 2, sans-serif';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${dist}m · ${coins} coins`, cx, H/2 - 40);

    // Button geometry
    const btnW = 130, btnH = 40, gap = 16;
    const totalW = btnW * 2 + gap;
    const retryX  = cx - totalW/2;
    const menuX   = cx + gap/2;
    const btnY    = H/2 - btnH/2 + 10;

    // RETRY button
    ctx.save();
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 12;
    ctx.fillStyle   = '#003a5a';
    _roundRect(ctx, retryX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.fillStyle   = '#00d4ff';
    ctx.font        = 'bold 12px Orbitron, monospace';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RETRY ⚡', retryX + btnW/2, btnY + btnH/2);

    // MENU button
    ctx.save();
    ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 12;
    ctx.fillStyle   = '#003a5a';
    _roundRect(ctx, menuX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.fillStyle   = '#00d4ff';
    ctx.font        = 'bold 12px Orbitron, monospace';
    ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('← MENU', menuX + btnW/2, btnY + btnH/2);

    // Register a single click handler on the canvas for these buttons.
    // We store it so Game.start() can remove it before the next game.
    if (_deathClickHandler) canvas.removeEventListener('click', _deathClickHandler);
    const scale = canvas.getBoundingClientRect().width / W;
    _deathClickHandler = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top)  / scale;
      if (mx >= retryX && mx <= retryX+btnW && my >= btnY && my <= btnY+btnH) Game.restart();
      if (mx >= menuX  && mx <= menuX+btnW  && my >= btnY && my <= btnY+btnH) Game.returnToMenu();
    };
    canvas.addEventListener('click', _deathClickHandler);
  }

  function clearDeathScreen() {
    if (_deathClickHandler) {
      canvas.removeEventListener('click', _deathClickHandler);
      _deathClickHandler = null;
    }
  }

  function _roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x+r, y);
    c.lineTo(x+w-r, y); c.arcTo(x+w, y,   x+w, y+r,   r);
    c.lineTo(x+w, y+h-r); c.arcTo(x+w, y+h, x+w-r, y+h, r);
    c.lineTo(x+r, y+h); c.arcTo(x,   y+h, x,   y+h-r, r);
    c.lineTo(x, y+r);   c.arcTo(x,   y,   x+r, y,     r);
    c.closePath();
  }

  return { setup, drawFrame, drawMenuPreview, drawDeathScreen, clearDeathScreen };
})();
