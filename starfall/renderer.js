'use strict';
const Renderer = (() => {
  const canvasEl = document.getElementById('game-canvas');
  const ctx      = canvasEl ? canvasEl.getContext('2d') : null;
  const COL      = Config.COLOURS;

  const T   = Config.GRID.TILE;
  const SB  = Config.GRID.SIDEBAR;   // sidebar width in px
  let COLS, ROWS, gridW, totalW, totalH;

  function setup(cols, rows) {
    if (!ctx) return;
    COLS = cols; ROWS = rows;
    gridW  = cols * T;
    totalW = gridW + SB;
    totalH = rows * T;

    // Scale canvas style for hi-DPI but keep logical size constant
    const maxW   = Math.min(window.innerWidth - 16, totalW);
    const scale  = Math.min(1, maxW / totalW);
    canvasEl.width  = totalW;
    canvasEl.height = totalH;
    canvasEl.style.width  = Math.floor(totalW * scale) + 'px';
    canvasEl.style.height = Math.floor(totalH * scale) + 'px';
  }

  // ── Grid ──────────────────────────────────────────────────────────────────
  function _drawGrid(tiles) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c*T, y = r*T, cell = tiles[r][c];
        const C = Config.CELL;

        if (cell === C.PATH || cell === C.START || cell === C.END) {
          ctx.fillStyle = COL.path;
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = COL.pathEdge;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x+0.5, y+0.5, T-1, T-1);
          // Subtle dot texture on path
          ctx.fillStyle = 'rgba(0,180,255,0.05)';
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.arc(x+8+i*16, y+8+j*16, 1, 0, Math.PI*2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = (c+r)%2===0 ? COL.gridEven : COL.gridOdd;
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = COL.gridLine;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x+0.5, y+0.5, T-1, T-1);
        }
      }
    }
  }

  function _drawPathArrows(tiles) {
    ctx.fillStyle = COL.pathArrow;
    const C = Config.CELL;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (tiles[r][c] !== C.PATH) continue;
        if ((c+r) % 2 !== 0) continue;
        const right = c < COLS-1 && (tiles[r][c+1] === C.PATH || tiles[r][c+1] === C.END);
        const down  = r < ROWS-1 && (tiles[r+1][c] === C.PATH || tiles[r+1][c] === C.END);
        if (!right && !down) continue;
        const ax = c*T+T/2, ay = r*T+T/2;
        ctx.save(); ctx.translate(ax, ay);
        if (down) ctx.rotate(Math.PI/2);
        ctx.beginPath(); ctx.moveTo(4,0); ctx.lineTo(-3,-3); ctx.lineTo(-3,3);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }

  function _drawStartEnd(tiles) {
    const C = Config.CELL;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = tiles[r][c];
        if (cell !== C.START && cell !== C.END) continue;
        const x = c*T, y = r*T;
        const isStart = cell === C.START;
        ctx.fillStyle = isStart ? COL.greenDim : COL.redDim;
        ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = isStart ? COL.green : COL.red;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x+1, y+1, T-2, T-2);
        ctx.fillStyle = isStart ? COL.green : COL.red;
        ctx.font = `700 7px 'Share Tech Mono',monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(isStart ? 'IN' : 'BASE', x+T/2, y+T/2);
      }
    }
  }

  // ── Hover / placement preview ─────────────────────────────────────────────
  function _drawHoverCell(state) {
    if (!state.hoveredCell || state.phase !== 'build') return;
    const { col, row } = state.hoveredCell;
    const x = col*T, y = row*T;
    const cx = x+T/2, cy = y+T/2;
    const canPlace = GameState.isBuildable(col, row) &&
                     GameState.canAfford(Config.TOWERS[state.selectedType].cost) &&
                     !state.movingTower;

    if (canPlace) {
      const range     = Config.TOWERS[state.selectedType].lv1.range * T;
      const towerAccent = COL[state.selectedType] || COL.accent;

      // Filled range zone — drawn first so tower highlight sits on top
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,212,255,0.10)';
      ctx.fill();

      // Highlight cells inside range for extra clarity
      const rangeInTiles = Config.TOWERS[state.selectedType].range;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const dx = (c - col), dy = (r - row);
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= rangeInTiles && !(c === col && r === row)) {
            ctx.fillStyle = 'rgba(0,212,255,0.07)';
            ctx.fillRect(c*T+1, r*T+1, T-2, T-2);
          }
        }
      }

      // Solid bright border ring
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI*2);
      ctx.strokeStyle = towerAccent;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tick marks around the ring every 45° for readability
      for (let a = 0; a < Math.PI*2; a += Math.PI/4) {
        const ix = cx + Math.cos(a) * (range - 4);
        const iy = cy + Math.sin(a) * (range - 4);
        const ox = cx + Math.cos(a) * (range + 4);
        const oy = cy + Math.sin(a) * (range + 4);
        ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(ox, oy);
        ctx.strokeStyle = towerAccent+'cc';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Hovered cell — green placement highlight
      ctx.fillStyle = 'rgba(64,255,128,0.18)';
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = COL.green;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x+0.5, y+0.5, T-1, T-1);

    } else {
      // Cannot place — red highlight only, no range preview
      ctx.fillStyle = 'rgba(255,64,96,0.15)';
      ctx.fillRect(x, y, T, T);
      ctx.strokeStyle = COL.red;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x+0.5, y+0.5, T-1, T-1);
    }
  }

  // ── Tower sprites ─────────────────────────────────────────────────────────
  function _drawTower(col, row, type, level) {
    const x = col*T, y = row*T;
    const cx = x+T/2, cy = y+T/2;
    const ac = COL[type] || COL.accent;
    const base = _darken(ac, 0.18);

    // Base plate
    ctx.fillStyle = base;
    ctx.fillRect(x+3, y+T-10, T-6, 7);
    ctx.strokeStyle = ac+'55'; ctx.lineWidth = 0.5;
    ctx.strokeRect(x+3, y+T-10, T-6, 7);

    // Body
    ctx.fillStyle = base;
    ctx.fillRect(x+7, y+7, T-14, T-15);
    ctx.strokeStyle = ac+'88'; ctx.lineWidth = 0.5;
    ctx.strokeRect(x+7, y+7, T-14, T-15);

    // Top highlight
    ctx.fillStyle = ac+'33';
    ctx.fillRect(x+7, y+7, T-14, Math.floor((T-15)*0.4));

    // Level pip(s)
    for (let i = 0; i < level-1; i++) {
      ctx.fillStyle = ac;
      ctx.beginPath(); ctx.arc(x+6+i*5, y+T-4, 1.5, 0, Math.PI*2); ctx.fill();
    }

    // Type-specific weapon
    if (type === 'laser') {
      ctx.fillStyle = ac; ctx.fillRect(cx-2, y+5, 4, 10); ctx.fillRect(cx+2, cy-2, 14, 4);
      ctx.fillStyle = ac+'aa'; ctx.fillRect(cx+16, cy-1, 6, 2);
    } else if (type === 'cryo') {
      ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(cx, cy-2, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(cx-1, cy-3, 2, 0, Math.PI*2); ctx.fill();
    } else if (type === 'plasma') {
      ctx.fillStyle = ac; ctx.fillRect(cx-3, y+5, 6, 16); ctx.fillRect(cx+3, cy-3, 12, 6);
      ctx.beginPath(); ctx.arc(cx+16, cy, 4, 0, Math.PI*2); ctx.fill();
    } else if (type === 'tesla') {
      ctx.fillStyle = ac; ctx.fillRect(cx-2, y+4, 4, 14); ctx.fillRect(cx-6, y+4, 12, 4);
      ctx.strokeStyle = ac+'cc'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(cx, y+4); ctx.lineTo(cx-7, y-2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, y+4); ctx.lineTo(cx+7, y-2); ctx.stroke();
    } else if (type === 'missile') {
      [-7, 0, 7].forEach(ox => {
        ctx.fillStyle = base; ctx.fillRect(cx+ox-3, y+4, 6, 12);
        ctx.fillStyle = ac; ctx.fillRect(cx+ox-2, y+5, 4, 9);
        ctx.beginPath(); ctx.moveTo(cx+ox-2,y+5); ctx.lineTo(cx+ox,y+2); ctx.lineTo(cx+ox+2,y+5); ctx.fill();
      });
    }

    // Glow dot
    ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(cx, cy-6, 2, 0, Math.PI*2); ctx.fill();
  }

  // ── Enemy sprites ─────────────────────────────────────────────────────────
  function _drawEnemy(enemy) {
    // Enemies use pixel positions (set by EnemyManager in step 3).
    // For now we draw at grid cell centre as a placeholder.
    const cfg  = Config.ENEMIES[enemy.type];
    const col  = enemy.col !== undefined ? enemy.col : 0;
    const row  = enemy.row !== undefined ? enemy.row : 0;
    const px   = enemy.px  !== undefined ? enemy.px  : col*T + T/2;
    const py   = enemy.py  !== undefined ? enemy.py  : row*T + T/2;

    const accs = { drone:'#40ff80', soldier:'#c080ff', shielded:'#40b0ff', heavy:'#d09040', sprinter:'#b050ff', carrier:'#ff6060' };
    const cols = { drone:'#1a3a1a', soldier:'#2a1a3a', shielded:'#1a2a3a', heavy:'#2a1808', sprinter:'#1e0a30', carrier:'#280808' };
    const ac   = accs[enemy.type] || '#ffffff';
    const bc   = cols[enemy.type] || '#1a1a1a';
    const s    = cfg.size;
    const bw   = Math.round(T*0.36*s), bh = Math.round(T*0.48*s);
    const cx   = px, cy = py;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(cx, cy+bh/2+4, bw*0.45, 3, 0, 0, Math.PI*2); ctx.fill();

    // Body
    ctx.fillStyle = bc;
    ctx.fillRect(cx-bw/2, cy-bh/2, bw, bh);
    ctx.strokeStyle = ac+'88'; ctx.lineWidth = 0.5;
    ctx.strokeRect(cx-bw/2, cy-bh/2, bw, bh);

    // Head
    const hh = Math.round(bh*0.27);
    ctx.fillStyle = bc;
    ctx.fillRect(cx-bw*0.32, cy-bh/2-hh, bw*0.64, hh);
    ctx.strokeStyle = ac+'55'; ctx.lineWidth = 0.5;
    ctx.strokeRect(cx-bw*0.32, cy-bh/2-hh, bw*0.64, hh);

    // Visor
    ctx.fillStyle = ac;
    ctx.fillRect(cx-bw*0.24, cy-bh/2-hh+hh*0.25, bw*0.48, hh*0.35);

    // Type extras
    if (enemy.type === 'heavy') {
      ctx.fillStyle = bc;
      ctx.fillRect(cx-bw/2-5, cy-bh/2, 4, bh*0.6);
      ctx.fillRect(cx+bw/2+1, cy-bh/2, 4, bh*0.6);
      ctx.strokeStyle = ac+'44'; ctx.lineWidth = 0.5;
      ctx.strokeRect(cx-bw/2-5, cy-bh/2, 4, bh*0.6);
      ctx.strokeRect(cx+bw/2+1, cy-bh/2, 4, bh*0.6);
    }
    if (enemy.type === 'shielded') {
      ctx.fillStyle = 'rgba(40,120,220,0.2)';
      ctx.strokeStyle = 'rgba(80,180,255,0.7)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx-bw/2-7, cy-bh/2-2);
      ctx.lineTo(cx-bw/2-7, cy+bh*0.45);
      ctx.quadraticCurveTo(cx-bw/2-8, cy+bh*0.65, cx-bw/2, cy+bh*0.7);
      ctx.lineTo(cx-bw/2+1, cy+bh*0.35);
      ctx.lineTo(cx-bw/2+1, cy-bh/2-2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (enemy.type === 'drone') {
      ctx.strokeStyle = ac+'50'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy+2, bw*1.1, bw*0.35, 0, 0, Math.PI*2); ctx.stroke();
    }
    if (enemy.type === 'sprinter') {
      [0,7,14].forEach((oy,i) => {
        ctx.fillStyle = `rgba(176,80,255,${0.35-i*0.1})`;
        ctx.fillRect(cx-bw/2-10+i*2, cy-bh/2+oy, 8-i*2, 2);
      });
    }
    if (enemy.type === 'carrier') {
      ctx.strokeStyle = ac+'40'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy-2, bw*1.3, bw*0.45, 0, 0, Math.PI*2); ctx.stroke();
    }

    // HP bar
    const hpFrac = enemy.hp / Config.ENEMIES[enemy.type].hp;
    const bary   = cy - bh/2 - hh - 6;
    ctx.fillStyle = '#111'; ctx.fillRect(cx-bw/2, bary, bw, 3.5);
    ctx.fillStyle = hpFrac > 0.6 ? COL.hpGreen : hpFrac > 0.3 ? COL.hpAmber : COL.hpRed;
    ctx.fillRect(cx-bw/2, bary, bw*hpFrac, 3.5);

    // Shield bar (shielded enemies only) — drawn above HP bar in blue
    if (enemy.maxShieldHp > 0) {
      const shieldFrac = enemy.shieldHp / enemy.maxShieldHp;
      const sbary = bary - 5;
      ctx.fillStyle = '#0a1a2a';
      ctx.fillRect(cx-bw/2, sbary, bw, 3);
      ctx.fillStyle = shieldFrac > 0 ? '#40b0ff' : '#0a1a2a';
      ctx.fillRect(cx-bw/2, sbary, bw*shieldFrac, 3);
    }
  }

  // ── Sidebar UI panel ──────────────────────────────────────────────────────
  function _drawSidebar(state) {
    const sx = gridW;
    const sw = SB;
    const sh = totalH;

    // Background
    ctx.fillStyle = COL.sidebar;
    ctx.fillRect(sx, 0, sw, sh);
    ctx.strokeStyle = COL.sidebarBorder;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx+0.5, 0); ctx.lineTo(sx+0.5, sh); ctx.stroke();

    let y = 10;
    const cx = sx + sw/2;
    const btnW = sw - 16;

    // ── HUD: credits / lives / wave ───────────────────────────────────────
    _sbLabel(cx, y, 'CREDITS', COL.textMuted); y += 13;
    _sbValue(cx, y, state.credits + 'cr', COL.green); y += 18;

    _sbDivider(sx, y, sw); y += 7;
    _sbLabel(cx, y, 'LIVES', COL.textMuted); y += 13;
    const livePct = state.lives / state.mapDef.lives;
    const liveCol = livePct > 0.5 ? COL.green : livePct > 0.25 ? COL.amber : COL.red;
    _sbValue(cx, y, state.lives + ' / ' + state.mapDef.lives, liveCol); y += 18;

    _sbDivider(sx, y, sw); y += 7;
    _sbLabel(cx, y, 'WAVE', COL.textMuted); y += 13;
    _sbValue(cx, y, (state.wave+1) + ' / ' + state.mapDef.waves, COL.accent); y += 14;

    // ── Phase label + wave action button ─────────────────────────────────
    _sbDivider(sx, y, sw); y += 7;
    const phaseText = { build:'▶ BUILD PHASE', wave:'◉ WAVE ACTIVE', countdown:'◎ INCOMING', win:'★ VICTORY', lose:'✕ DEFEATED' };
    const phaseCol  = { build: COL.green, wave: COL.red, countdown: COL.amber, win: COL.green, lose: COL.red };
    _sbLabel(cx, y, phaseText[state.phase] || state.phase, phaseCol[state.phase] || COL.accent); y += 13;

    if (state.phase === 'countdown') {
      const remaining = Math.max(0, state.countdownEnd - Date.now());
      const secsLeft  = Math.ceil(remaining / 1000 / Game.getSpeed());
      ctx.fillStyle = COL.amber;
      ctx.font = `700 18px 'Orbitron',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(secsLeft + 's', cx, y + 6); y += 16;

      const btnH = 36, btnY = y;
      ctx.fillStyle = 'rgba(255,160,32,0.15)';
      ctx.fillRect(sx+8, btnY, btnW, btnH);
      ctx.strokeStyle = COL.amber; ctx.lineWidth = 0.5;
      ctx.strokeRect(sx+8, btnY, btnW, btnH);
      ctx.fillStyle = COL.amber;
      ctx.font = `10px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SEND EARLY +' + Config.ECONOMY.WAVE_BONUS.send_early + 'cr', cx, btnY + btnH/2);
      _lastHitRegions.sendEarly = { x: sx+8, y: btnY, w: btnW, h: btnH };
      y += btnH + 4;
    } else {
      _lastHitRegions.sendEarly = null;
      if (state.phase === 'build' && state.wave < state.mapDef.waves) {
        const btnH = 36, btnY = y;
        ctx.fillStyle = 'rgba(64,255,128,0.10)';
        ctx.fillRect(sx+8, btnY, btnW, btnH);
        ctx.strokeStyle = COL.green; ctx.lineWidth = 0.5;
        ctx.strokeRect(sx+8, btnY, btnW, btnH);
        ctx.fillStyle = COL.green;
        ctx.font = `10px 'Share Tech Mono',monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('START WAVE ' + (state.wave + 1), cx, btnY + btnH/2);
        _lastHitRegions.startWave = { x: sx+8, y: btnY, w: btnW, h: btnH };
        y += btnH + 4;
      } else {
        _lastHitRegions.startWave = null;
        y += 4;
      }
    }

    // ── Context-sensitive middle section ──────────────────────────────────
    // When a tower is selected: show upgrade/move/sell panel.
    // When nothing is selected: show tower type selector.
    // The two never coexist, freeing vertical space for larger touch targets.
    _sbDivider(sx, y, sw); y += 7;

    if (state.selectedTower) {
      const st  = state.selectedTower;
      const cfg = Config.TOWERS[st.type];
      const ac  = COL[st.type] || COL.accent;
      const btnH = 36;

      ctx.fillStyle = ac;
      ctx.font = `500 11px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(st.type.toUpperCase() + ' · LV' + st.level, cx, y); y += 16;

      // Upgrade
      const canUpgrade   = st.level < 3;
      const upgCost      = st.level === 1 ? cfg.upgrade1 : cfg.upgrade2;
      const canAffordUpg = canUpgrade && GameState.canAfford(upgCost);
      const upgY = y;
      ctx.fillStyle = canAffordUpg ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(sx+8, upgY, btnW, btnH);
      ctx.strokeStyle = canAffordUpg ? COL.accent : COL.textMuted;
      ctx.lineWidth = 0.5; ctx.strokeRect(sx+8, upgY, btnW, btnH);
      ctx.fillStyle = canAffordUpg ? COL.accent : COL.textMuted;
      ctx.font = `10px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(canUpgrade ? 'UPGRADE  ' + upgCost + 'cr' : 'MAX LEVEL', cx, upgY + btnH/2);
      y += btnH + 4;

      // Move
      const moveCost     = Config.ECONOMY.MOVE_FEE;
      const canAffordMove = GameState.canAfford(moveCost);
      const isMoving     = state.movingTower !== null;
      const moveY = y;
      ctx.fillStyle = isMoving ? 'rgba(255,160,32,0.15)' : canAffordMove ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(sx+8, moveY, btnW, btnH);
      ctx.strokeStyle = isMoving ? COL.amber : canAffordMove ? COL.accent : COL.textMuted;
      ctx.lineWidth = 0.5; ctx.strokeRect(sx+8, moveY, btnW, btnH);
      ctx.fillStyle = isMoving ? COL.amber : canAffordMove ? COL.accent : COL.textMuted;
      ctx.font = `10px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(isMoving ? 'PLACING...' : 'MOVE  ' + moveCost + 'cr', cx, moveY + btnH/2);
      y += btnH + 4;

      // Sell
      const sellRefund = Math.floor(cfg.cost * Config.ECONOMY.SELL_REFUND);
      const sellY = y;
      ctx.fillStyle = 'rgba(255,64,96,0.10)';
      ctx.fillRect(sx+8, sellY, btnW, btnH);
      ctx.strokeStyle = COL.red; ctx.lineWidth = 0.5;
      ctx.strokeRect(sx+8, sellY, btnW, btnH);
      ctx.fillStyle = COL.red;
      ctx.font = `10px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SELL  +' + sellRefund + 'cr', cx, sellY + btnH/2);
      y += btnH + 6;

      _lastHitRegions.upgrade = { x: sx+8, y: upgY,  w: btnW, h: btnH };
      _lastHitRegions.move    = { x: sx+8, y: moveY, w: btnW, h: btnH };
      _lastHitRegions.sell    = { x: sx+8, y: sellY, w: btnW, h: btnH };
      _lastHitRegions.towerSelectorY = -1;
      _lastHitRegions.towerRowH      = 0;

    } else {
      _lastHitRegions.upgrade = null;
      _lastHitRegions.move    = null;
      _lastHitRegions.sell    = null;

      _sbLabel(cx, y, 'BUILD TOWERS', COL.textMuted); y += 13;
      _towerSelectorY = y;

      const towerTypes = ['laser','cryo','plasma','tesla','missile'];
      const rowH = 30;
      towerTypes.forEach(type => {
        const cost   = Config.TOWERS[type].cost;
        const sel    = state.selectedType === type;
        const canBuy = GameState.canAfford(cost);
        const rowY   = y;

        ctx.fillStyle = sel ? 'rgba(0,212,255,0.07)' : 'transparent';
        ctx.fillRect(sx+1, rowY, sw-2, rowH);
        if (sel) { ctx.fillStyle = COL.accent; ctx.fillRect(sx+1, rowY, 2, rowH); }

        _drawTowerMini(sx+8, rowY+5, 20, type);

        ctx.fillStyle = canBuy ? COL.text : COL.textMuted;
        ctx.font = `500 10px 'Share Tech Mono',monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(type.toUpperCase(), sx+32, rowY+rowH*0.38);
        ctx.fillStyle = canBuy ? COL.green : COL.red;
        ctx.font = `10px 'Share Tech Mono',monospace`;
        ctx.fillText(cost+'cr', sx+32, rowY+rowH*0.72);
        y += rowH + 2;
      });

      _lastHitRegions.towerSelectorY = _towerSelectorY;
      _lastHitRegions.towerRowH      = rowH + 2;
    }

    // ── Speed control (always visible) ────────────────────────────────────
    _sbDivider(sx, y, sw); y += 7;
    _sbLabel(cx, y, 'GAME SPEED', COL.textMuted); y += 12;
    const speeds   = [1, 2, 3];
    const curSpeed = Game.getSpeed();
    const sbtnW    = Math.floor((sw - 20) / 3);
    const sbtH     = 30;
    speeds.forEach((spd, i) => {
      const bx  = sx + 8 + i * (sbtnW + 2);
      const by  = y;
      const sel = curSpeed === spd;
      ctx.fillStyle = sel ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(bx, by, sbtnW, sbtH);
      ctx.strokeStyle = sel ? COL.accent : COL.textMuted;
      ctx.lineWidth = sel ? 1 : 0.5;
      ctx.strokeRect(bx, by, sbtnW, sbtH);
      ctx.fillStyle = sel ? COL.accent : COL.textMuted;
      ctx.font = `${sel ? '500' : '400'} 10px 'Share Tech Mono',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spd + '×', bx + sbtnW/2, by + sbtH/2);
    });
    _lastHitRegions.speedBtns = speeds.map((spd, i) => ({
      spd, x: sx + 8 + i * (sbtnW + 2), y, w: sbtnW, h: sbtH,
    }));
  }

  // Hit region storage — updated each frame by _drawSidebar
  const _lastHitRegions = {
    upgrade: null, move: null, sell: null,
    startWave: null, sendEarly: null,
    speedBtns: [],
    towerSelectorY: 0,
    towerRowH: 32,
  };
  let _towerSelectorY = 0;   // set during sidebar draw, read by hit test

  function getHitRegions() { return _lastHitRegions; }

  // Sidebar helpers
  function _sbLabel(cx, y, text, color) {
    ctx.fillStyle = color;
    ctx.font = `9px 'Share Tech Mono',monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y);
  }
  function _sbValue(cx, y, text, color) {
    ctx.fillStyle = color;
    ctx.font = `700 14px 'Orbitron',monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y);
  }
  function _sbDivider(sx, y, sw) {
    ctx.strokeStyle = COL.sidebarBorder;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(sx+8, y); ctx.lineTo(sx+sw-8, y); ctx.stroke();
  }

  // Tiny tower sprite for sidebar
  function _drawTowerMini(x, y, S, type) {
    const cx = x+S/2, cy = y+S/2;
    const ac = COL[type] || COL.accent;
    ctx.fillStyle = _darken(ac, 0.18);
    ctx.fillRect(x+1, y+S-6, S-2, 4);
    ctx.fillRect(x+3, y+3, S-6, S-9);
    ctx.fillStyle = ac+'44';
    ctx.fillRect(x+3, y+3, S-6, 4);
    ctx.strokeStyle = ac+'77'; ctx.lineWidth = 0.5;
    ctx.strokeRect(x+3, y+3, S-6, S-9);
    ctx.fillStyle = ac;
    ctx.beginPath(); ctx.arc(cx, cy-2, 2, 0, Math.PI*2); ctx.fill();
  }

  // Utility: darken a hex colour by mixing with black
  function _darken(hex, amount) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.round(r*amount)},${Math.round(g*amount)},${Math.round(b*amount)})`;
  }

  // ── Corner brackets ───────────────────────────────────────────────────────
  function _drawCorners() {
    const len = 10, w = 1.5;
    ctx.fillStyle = COL.accent;
    [[0,0,1,1],[gridW-1,0,-1,1],[0,totalH-1,1,-1],[gridW-1,totalH-1,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.fillRect(x, y, len*dx, w*dy);
      ctx.fillRect(x, y, w*dx, len*dy);
    });
  }

  // ── Master draw ───────────────────────────────────────────────────────────
  function drawFrame(state) {
    if (!ctx) return;
    ctx.clearRect(0, 0, totalW, totalH);

    _drawGrid(state.tiles);
    _drawPathArrows(state.tiles);
    _drawStartEnd(state.tiles);
    _drawHoverCell(state);

    // Towers — highlight selected one
    state.towers.forEach(t => {
      _drawTower(t.col, t.row, t.type, t.level);
      if (state.selectedTower && state.selectedTower.id === t.id && !state.movingTower) {
        // Selection ring around selected tower
        const ac = Config.COLOURS[t.type] || Config.COLOURS.accent;
        ctx.strokeStyle = ac;
        ctx.lineWidth = 2;
        ctx.strokeRect(t.col*T+1, t.row*T+1, T-2, T-2);
        // Range ring for selected tower
        const stats = GameState.towerStats(t);
        const range = stats.range * T;
        ctx.strokeStyle = ac + '55';
        ctx.lineWidth = 1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.arc(t.col*T+T/2, t.row*T+T/2, range, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Moving tower — ghost at hover cell
    if (state.movingTower && state.hoveredCell) {
      const { col, row } = state.hoveredCell;
      const canDrop = GameState.isBuildable(col, row);
      ctx.globalAlpha = 0.5;
      _drawTower(col, row, state.movingTower.type, state.movingTower.level);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = canDrop ? Config.COLOURS.green : Config.COLOURS.red;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(col*T+1, row*T+1, T-2, T-2);
    }

    state.enemies.forEach(e => _drawEnemy(e));

    // Projectiles
    state.projectiles.forEach(p => _drawProjectile(p));

    // Wave preview panel (build phase)
    ScreenManager.drawWavePreview(ctx, state, gridW, totalH);

    _drawCorners();
    _drawSidebar(state);
  }

  function _drawProjectile(p) {
    if (p.type === 'laser') {
      ctx.strokeStyle = '#80eeff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 4;
      // Draw a short bolt behind the projectile
      const len = 14;
      const dx = p.lastDx || 1, dy = p.lastDy || 0;
      const norm = Math.sqrt(dx*dx+dy*dy)||1;
      ctx.beginPath();
      ctx.moveTo(p.px - (dx/norm)*len, p.py - (dy/norm)*len);
      ctx.lineTo(p.px, p.py);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Bright tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.px, p.py, 2, 0, Math.PI*2); ctx.fill();
    }

    else if (p.type === 'tesla') {
      // Flickering arc between chain targets
      const alpha = p.life / p.maxLife;
      ctx.strokeStyle = `rgba(255,255,80,${alpha * 0.9})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffff40';
      ctx.shadowBlur = 6;
      const pts = [{ px: p.ox, py: p.oy }, ...p.chainTargets];
      for (let i = 1; i < pts.length; i++) {
        ctx.beginPath();
        const mx = (pts[i-1].px + pts[i].px)/2 + (Math.random()-0.5)*10;
        const my = (pts[i-1].py + pts[i].py)/2 + (Math.random()-0.5)*10;
        ctx.moveTo(pts[i-1].px, pts[i-1].py);
        ctx.quadraticCurveTo(mx, my, pts[i].px, pts[i].py);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    else if (p.type === 'plasma') {
      const r = 5 + (1 - Math.min(1, p.life||1)) * 2;
      ctx.fillStyle = '#c060ff';
      ctx.shadowColor = '#c060ff';
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#e0a0ff88';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.px, p.py, r+3, 0, Math.PI*2); ctx.stroke();
    }

    else if (p.type === 'missile') {
      ctx.fillStyle = '#ff6040';
      ctx.shadowColor = '#ff8060';
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(p.px, p.py, 4, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // Exhaust trail
      const spd = Math.sqrt((p.vx||0)**2+(p.vy||0)**2)||1;
      const tx = -(p.vx||1)/spd, ty = -(p.vy||0)/spd;
      ctx.strokeStyle = 'rgba(255,160,80,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.px + tx*6, p.py + ty*6);
      ctx.lineTo(p.px + tx*16, p.py + ty*16);
      ctx.stroke();
    }

    else if (p.type === 'impact') {
      const t = 1 - p.life / p.maxLife;
      const alpha = (1 - t) * 0.6;
      const r = p.radius * t;
      ctx.strokeStyle = p.color + Math.round(alpha*255).toString(16).padStart(2,'0');
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.px, p.py, Math.max(1,r), 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = p.color + Math.round(alpha*0.3*255).toString(16).padStart(2,'0');
      ctx.fill();
    }
  }

  function getCanvas()      { return canvasEl; }
  function getGridWidth()   { return gridW; }
  function getTotalWidth()  { return totalW; }

  return { setup, drawFrame, getCanvas, getGridWidth, getTotalWidth, getHitRegions };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   INPUT
   Unified pointer handler (mouse + touch via Pointer Events API).
   Reads _onPointerDown / _onPointerMove / _onPointerUp callbacks at call-time
   so Input.reset() takes effect immediately (KB §11).
   ═══════════════════════════════════════════════════════════════════════════ */
