'use strict';
const Config = Object.freeze({

  GRID: Object.freeze({
    TILE:    32,
    COLS:    19,
    ROWS:    14,
    SIDEBAR: 200,   // px — canvas area reserved on the right for UI panel
  }),

  // Map cell type constants
  CELL: Object.freeze({ EMPTY: 0, PATH: 1, START: 2, END: 3 }),

  ECONOMY: Object.freeze({
    SELL_REFUND:      0.6,   // fraction of cost returned on sell
    MOVE_FEE:         20,    // credits charged to relocate a tower

    KILL_REWARDS: Object.freeze({
      drone:    5,
      soldier:  10,
      shielded: 20,
      heavy:    30,
      sprinter: 25,
      carrier:  30,
    }),

    WAVE_BONUS: Object.freeze({
      standard:     60,
      complex:      90,
      boss:        180,
      perfect_clear: 30,
      send_early:    20,
    }),
  }),

  TOWERS: Object.freeze({
    laser: Object.freeze({
      cost:80, upgrade1:60, upgrade2:100,
      lv1: Object.freeze({ range:3.0, fireRate:800,  damage:20, pierce:1 }),
      lv2: Object.freeze({ range:3.5, fireRate:680,  damage:20, pierce:2 }),
      lv3: Object.freeze({ range:4.0, fireRate:560,  damage:20, pierce:3 }),
    }),
    cryo: Object.freeze({
      cost:70, upgrade1:50, upgrade2:90,
      lv1: Object.freeze({ range:2.5, pulseRate:2000, damage:0, slowFactor:0.6, freezeMs:0 }),
      lv2: Object.freeze({ range:3.0, pulseRate:1800, damage:0, slowFactor:0.5, freezeMs:0 }),
      lv3: Object.freeze({ range:3.5, pulseRate:1600, damage:0, slowFactor:0.4, freezeMs:0 }),
    }),
    plasma: Object.freeze({
      cost:120, upgrade1:80, upgrade2:130,
      // splashRadius in tiles, burnDamage applied per 500ms tick for 3 ticks at lv3
      lv1: Object.freeze({ range:3.5, fireRate:2200, damage:55, splashRadius:1.2, burnDamage:0   }),
      lv2: Object.freeze({ range:3.8, fireRate:2000, damage:65, splashRadius:1.6, burnDamage:2   }),
      lv3: Object.freeze({ range:4.2, fireRate:1800, damage:75,splashRadius:2.0, burnDamage:4  }),
    }),
    tesla: Object.freeze({
      cost:90, upgrade1:70, upgrade2:110,
      // chains = max enemies the arc jumps to after initial target
      lv1: Object.freeze({ range:2.0, fireRate:1300, damage:28, chains:1 }),
      lv2: Object.freeze({ range:2.4, fireRate:1150, damage:45, chains:2 }),
      lv3: Object.freeze({ range:2.8, fireRate:1000,  damage:45, chains:4 }),
    }),
    missile: Object.freeze({
      cost:150, upgrade1:110, upgrade2:160,
      // splashRadius in tiles, homes toward target
      lv1: Object.freeze({ range:4.5, fireRate:3600, damage:65, splashRadius:1.5 }),
      lv2: Object.freeze({ range:5.0, fireRate:3000, damage:80, splashRadius:2.0 }),
      lv3: Object.freeze({ range:5.5, fireRate:2400, damage:100, splashRadius:2.5 }),
    }),
  }),

  ENEMIES: Object.freeze({
    drone:    Object.freeze({ hp: 80,  speed: 2.0, lives: 1, size: 0.55 }),
    soldier:  Object.freeze({ hp: 200, speed: 1.0, lives: 1, size: 0.80 }),
    shielded: Object.freeze({ hp: 240, speed: 0.9, lives: 1, size: 0.85, shieldHp: 150 }),
    heavy:    Object.freeze({ hp: 800, speed: 0.75, lives: 1, size: 1.05 }),
    sprinter: Object.freeze({ hp: 150, speed: 2.5, lives: 1, size: 0.75, shieldHp: 250 }),
    carrier:  Object.freeze({ hp: 400, speed: 0.8, lives: 2, size: 1.00, droneCount: 4 }),
  }),

  LIVES: Object.freeze({
    starting: 20,
  }),

  WAVE_COUNTDOWN_MS: 5000,    // auto-start delay between waves
  SEND_EARLY_WINDOW_MS: 4500, // how long the "send early" button is active

  SPAWN: Object.freeze({
    WITHIN_GROUP_MS:      600,   // gap between enemies inside a group
    BETWEEN_GROUP_STANDARD: 3000, // standard gap unit — multiply by group's gap scalar
    BETWEEN_GROUP_MIN:    600,   // floor: gap scalar of 0 clamps to one within-group tick
  }),

  // Wave definitions for Map 0 — Perimeter (10 waves).
  // Each group: { type, count, gap? }
  //   gap = multiplier on BETWEEN_GROUP_STANDARD for the pause BEFORE this group.
  //   gap omitted → defaults to 1 (3000ms standard pause).
  //   gap: 0  → clamped to BETWEEN_GROUP_MIN (no true zero — prevents spawn collision).
  //   gap: 2  → 6000ms pause.  gap: 0.5 → 1500ms pause.
  //   The first group in every wave never has a pre-pause regardless of gap value.
  // waveType: 'standard' | 'complex' | 'boss' — drives wave-clear bonus.
  WAVES: Object.freeze([
    // Wave 1 — tutorial: drones only
    Object.freeze({ waveType:'standard', groups:[
      { type:'drone',   count:4 },
      { type:'drone',   count:4, gap:2 },
    ]}),
    // Wave 2 — soldiers introduced
    Object.freeze({ waveType:'standard', groups:[
      { type:'drone',   count:6 },
      { type:'soldier', count:4, gap:1.5 },
      { type:'soldier', count:4, gap:2 },
    ]}),
    // Wave 3 — bigger groups, quick follow-up
    Object.freeze({ waveType:'standard', groups:[
      { type:'soldier', count:5 },
      { type:'soldier', count:6, gap:1.5 },
      { type:'drone',   count:6, gap:0.5 },
    ]}),
    // Wave 4 — shielded introduced, dramatic pause before them
    Object.freeze({ waveType:'complex', groups:[
      { type:'shielded',    count:4 },
      { type:'drone', count:8, gap:0.5 },
      { type:'soldier', count:6, gap:1.5 },
      { type:'soldier',  count:10 },
    ]}),
    // Wave 5 — heavy introduced with a long warning pause
    Object.freeze({ waveType:'complex', groups:[
      { type:'soldier',  count:5 },
      { type:'heavy',    count:2, gap:3 },
      { type:'drone',    count:6, gap:0.5 },
    ]}),
    // Wave 6 — sprinters rush in fast, then a breather before heavies
    Object.freeze({ waveType:'complex', groups:[
      { type:'sprinter', count:4 },
      { type:'shielded', count:3, gap:0.5 },
      { type:'heavy',    count:2, gap:2 },
    ]}),
    // Wave 7 — carrier with long pause so player can react, then flood
    Object.freeze({ waveType:'complex', groups:[
      { type:'carrier',  count:2 },
      { type:'soldier',  count:6, gap:0.5 },
      { type:'sprinter', count:4, gap:2 },
    ]}),
    // Wave 8 — relentless pressure, short gaps throughout
    Object.freeze({ waveType:'complex', groups:[
      { type:'heavy',    count:4 },
      { type:'shielded', count:5, gap:0.5 },
      { type:'sprinter', count:5, gap:0.5 },
    ]}),
    // Wave 9 — everything, with a dramatic 4× pause mid-wave
    Object.freeze({ waveType:'complex', groups:[
      { type:'drone',    count:8 },
      { type:'carrier',  count:3, gap:4 },
      { type:'heavy',    count:3, gap:0.5 },
      { type:'shielded', count:5, gap:2 },
    ]}),
    // Wave 10 — boss wave: each group separated by a tense pause
    Object.freeze({ waveType:'boss', groups:[
      { type:'sprinter', count:6 },
      { type:'carrier',  count:4, gap:2 },
      { type:'heavy',    count:6, gap:3 },
      { type:'shielded', count:6, gap:2 },
      { type:'drone',    count:10, gap:0.5 },
    ]}),
  ]),

  // Palette — all canvas colours drawn from here, nowhere else
  COLOURS: Object.freeze({
    bg:         '#060a0f',
    gridEven:   '#060e18',
    gridOdd:    '#07101c',
    gridLine:   '#0c1a28',
    path:       '#0a1e2e',
    pathEdge:   '#1a4060',
    pathArrow:  'rgba(0,212,255,0.15)',
    accent:     '#00d4ff',
    accentDim:  'rgba(0,212,255,0.08)',
    green:      '#40ff80',
    greenDim:   'rgba(64,255,128,0.10)',
    red:        '#ff4060',
    redDim:     'rgba(255,64,96,0.12)',
    amber:      '#ffa020',
    purple:     '#c060ff',
    text:       '#c0e0f0',
    textMuted:  '#2a6070',
    sidebar:    '#080e18',
    sidebarBorder: '#1a4060',
    hpGreen:    '#40c840',
    hpAmber:    '#c09020',
    hpRed:      '#c02020',
    // Tower accent colours
    laser:   '#00d4ff',
    cryo:    '#20c8d8',
    plasma:  '#c060ff',
    tesla:   '#d4d420',
    missile: '#ff6040',
  }),

  // Maps: each is a 2D array of CELL constants + metadata
  MAPS: Object.freeze([
    Object.freeze({
      name: 'Perimeter',
      waves: 10,
      startingCredits: 250,
      lives: 20,
      // 0=EMPTY, 1=PATH, 2=START, 3=END  (19 cols × 14 rows)
      tiles: Object.freeze([
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [2,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,0,0,0,1,0,1,0,0],
        [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
        [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
        [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ]),
    }),
  ]),
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAP LOADER
   Pure functions. Reads a map definition from Config and extracts structure.
   ═══════════════════════════════════════════════════════════════════════════ */
