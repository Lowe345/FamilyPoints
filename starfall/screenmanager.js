'use strict';
const ScreenManager = (() => {
  let _rafId      = null;
  let _particles  = [];
  let _startedAt  = 0;
  let _phase      = null;   // 'win' | 'lose' | null
  let _onRestart  = null;
  let _restartBtn = null;   // {x,y,w,h}

  const TAU = Math.PI * 2;

  function showWin(state, onRestart) {
    _begin('win', state, onRestart);
    _burstParticles(state, 'win');
  }

  function showLose(state, onRestart) {
    _begin('lose', state, onRestart);
  }

  function _begin(phase, state, onRestart) {
    cancelAnimationFrame(_rafId);
    _phase     = phase;
    _onRestart = onRestart;
    _startedAt = performance.now();
    _restartBtn = null;
    _loop(state, performance.now());
  }

  function reset() {
    cancelAnimationFrame(_rafId);
    _particles = [];
    _phase     = null;
    _onRestart = null;
    _restartBtn = null;
  }

  function handleClick(pos) {
    if (!_restartBtn) return false;
    const b = _restartBtn;
    if (pos.x >= b.x && pos.x <= b.x+b.w && pos.y >= b.y && pos.y <= b.y+b.h) {
      const cb = _onRestart;   // capture before reset() clears it
      reset();
      cb && cb();
      return true;
    }
    return false;
  }

  function isActive() { return _phase !== null; }

  // ── Particle burst ─────────────────────────────────────────────────────────
  function _burstParticles(state, type) {
    const cx = (Config.GRID.COLS * Config.GRID.TILE) / 2;
    const cy = (Config.GRID.ROWS * Config.GRID.TILE) / 2;
    const count = 60;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + Math.random() * 0.3;
      const speed = 80 + Math.random() * 180;
      const hue   = type === 'win'
        ? ['#40ff80','#00d4ff','#c060ff','#ffa020'][Math.floor(Math.random()*4)]
        : ['#ff4060','#ff8020','#ff2040'][Math.floor(Math.random()*3)];
      _particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.6 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color: hue,
      });
    }
  }

  // ── Animation loop ─────────────────────────────────────────────────────────
  function _loop(state, now) {
    const elapsed = (now - _startedAt) / 1000;
    const canvas  = Renderer.getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width, H = canvas.height;
    const gridW = Renderer.getGridWidth();

    // Redraw the frozen game frame underneath
    Renderer.drawFrame(state);

    // ── Dark overlay (fades in over 0.4s) ─────────────────────────────────
    const overlayAlpha = Math.min(1, elapsed / 0.4) * 0.78;
    ctx.fillStyle = `rgba(4,8,16,${overlayAlpha})`;
    ctx.fillRect(0, 0, gridW, H);

    // ── Scanlines ─────────────────────────────────────────────────────────
    if (elapsed > 0.2) {
      const scanAlpha = Math.min(0.12, (elapsed - 0.2) * 0.3);
      ctx.fillStyle = `rgba(0,0,0,${scanAlpha})`;
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, gridW, 2);
    }

    // ── Particles ─────────────────────────────────────────────────────────
    const dt = Math.min(1/30, 1/60);
    for (const p of _particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 120 * dt;   // gravity
      p.vx   *= 0.98;
      p.life -= p.decay * dt;
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, TAU);
      ctx.fill();
    }
    _particles = _particles.filter(p => p.life > 0);
    ctx.globalAlpha = 1;

    // ── Title (fades + scales in after 0.15s) ──────────────────────────────
    const titleT = Math.max(0, elapsed - 0.15);
    if (titleT > 0) {
      const titleAlpha = Math.min(1, titleT / 0.35);
      const scale      = 0.6 + Math.min(0.4, titleT / 0.3);
      const isWin      = _phase === 'win';
      const title      = isWin ? 'VICTORY' : 'DEFEATED';
      const titleColor = isWin ? '#40ff80' : '#ff4060';
      ctx.save();
      ctx.globalAlpha = titleAlpha;
      ctx.translate(gridW / 2, H * 0.32);
      ctx.scale(scale, scale);
      ctx.fillStyle   = titleColor;
      ctx.font        = `900 48px 'Orbitron',monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      // Subtle glow
      ctx.shadowColor = titleColor;
      ctx.shadowBlur  = 20 * titleAlpha;
      ctx.fillText(title, 0, 0);
      ctx.shadowBlur  = 0;
      ctx.restore();
    }

    // ── Stats (stagger in from 0.6s) ───────────────────────────────────────
    if (elapsed > 0.6) {
      const statsT    = elapsed - 0.6;
      const elapsed2  = Math.floor((Date.now() - state.startTime) / 1000);
      const mins      = Math.floor(elapsed2 / 60), secs = elapsed2 % 60;
      const timeStr   = `${mins}:${secs.toString().padStart(2,'0')}`;
      const lines     = _phase === 'win' ? [
        { label:'Waves completed', val: state.wave + ' / ' + state.mapDef.waves },
        { label:'Enemies destroyed', val: state.enemiesKilled },
        { label:'Perfect waves',     val: state.perfectWaves },
        { label:'Time',              val: timeStr },
        { label:'Credits remaining', val: state.credits + 'cr' },
      ] : [
        { label:'Wave reached',      val: (state.wave + 1) + ' / ' + state.mapDef.waves },
        { label:'Lives remaining',   val: state.lives + ' / ' + state.mapDef.lives },
        { label:'Enemies destroyed', val: state.enemiesKilled },
        { label:'Time',              val: timeStr },
      ];

      const lineH  = 22, startY = H * 0.48;
      lines.forEach((line, i) => {
        const lineT = statsT - i * 0.12;
        if (lineT <= 0) return;
        const alpha = Math.min(1, lineT / 0.2);
        ctx.globalAlpha = alpha;
        ctx.font        = `400 11px 'Share Tech Mono',monospace`;
        ctx.textAlign   = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle   = '#2a6070';
        ctx.fillText(line.label, gridW * 0.2, startY + i * lineH);
        ctx.fillStyle   = '#c0e0f0';
        ctx.textAlign   = 'right';
        ctx.fillText(line.val, gridW * 0.8, startY + i * lineH);
        ctx.globalAlpha = 1;
      });
    }

    // ── Restart button (appears at 1.2s) ───────────────────────────────────
    const btnT = elapsed - 1.2;
    if (btnT > 0) {
      const btnAlpha = Math.min(1, btnT / 0.3);
      const bw = 180, bh = 36;
      const bx = gridW/2 - bw/2, by = H * 0.82;
      _restartBtn = { x:bx, y:by, w:bw, h:bh };

      ctx.globalAlpha = btnAlpha;
      ctx.fillStyle   = _phase === 'win' ? 'rgba(64,255,128,0.12)' : 'rgba(255,64,96,0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = _phase === 'win' ? '#40ff80' : '#ff4060';
      ctx.lineWidth   = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle   = _phase === 'win' ? '#40ff80' : '#ff4060';
      ctx.font        = `700 13px 'Orbitron',monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(_phase === 'win' ? 'PLAY AGAIN' : 'TRY AGAIN', gridW/2, by + bh/2);
      ctx.globalAlpha = 1;
    }

    _rafId = requestAnimationFrame(t => _loop(state, t));
  }

  // ── Wave preview panel (drawn during build phase) ─────────────────────────
  function drawWavePreview(ctx, state, gridW, totalH) {
    if (state.phase !== 'build') return;
    const nextWave = Config.WAVES[state.wave];
    if (!nextWave) return;

    const T       = Config.GRID.TILE;
    const isFinal = state.wave === state.mapDef.waves - 1;
    const panelH  = 44;
    const panelY  = totalH - panelH - 4;
    const panelW  = gridW - 8;

    // Background
    ctx.fillStyle   = 'rgba(6,10,15,0.88)';
    ctx.fillRect(4, panelY, panelW, panelH);
    ctx.strokeStyle = isFinal ? '#ff4060' : '#1a4060';
    ctx.lineWidth   = 1;
    ctx.strokeRect(4, panelY, panelW, panelH);

    // Label
    ctx.fillStyle    = isFinal ? '#ff4060' : '#2a6070';
    ctx.font         = `400 8px 'Share Tech Mono',monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isFinal ? 'FINAL WAVE — INCOMING' : `WAVE ${state.wave + 1} INCOMING`, 12, panelY + 11);

    // Enemy group icons
    const accs = {
      drone:'#40ff80', soldier:'#c080ff', shielded:'#40b0ff',
      heavy:'#d09040', sprinter:'#b050ff', carrier:'#ff6060',
    };
    let px = 12;
    nextWave.groups.forEach(group => {
      const ac  = accs[group.type] || '#ffffff';
      const dot = 5;

      // Mini coloured dot
      ctx.fillStyle = ac;
      ctx.beginPath(); ctx.arc(px + dot, panelY + 30, dot, 0, Math.PI*2); ctx.fill();

      // Count
      ctx.fillStyle    = ac;
      ctx.font         = `400 9px 'Share Tech Mono',monospace`;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('×' + group.count, px + dot*2 + 3, panelY + 30);

      // Type label
      ctx.fillStyle = '#2a6070';
      ctx.font      = `400 7px 'Share Tech Mono',monospace`;
      ctx.fillText(group.type.slice(0,4).toUpperCase(), px, panelY + 40);

      px += 52;
      if (px > panelW - 20) return; // clip if too many groups
    });
  }

  return { showWin, showLose, reset, handleClick, isActive, drawWavePreview };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   RENDERER
   Pure canvas. Draws everything — grid, towers, UI panel, HUD.
   All colour references go through Config.COLOURS.
   Canvas element is null-guarded at module body level (KB §10).
   ═══════════════════════════════════════════════════════════════════════════ */
