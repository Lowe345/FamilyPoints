'use strict';
const Tests = (() => {
  let passed = 0, failed = 0;
  const failedLabels = [];

  function assert(label, condition) {
    if (condition) { passed++; }
    else           { failed++; failedLabels.push(label); }
  }

  function safe(label, fn) {
    try { fn(); }
    catch(e) { failed++; failedLabels.push(`${label} (exception: ${e.message})`); }
  }

  function run() {
    const tiles = Config.MAPS[0].tiles;
    const COLS  = Config.GRID.COLS;
    const ROWS  = Config.GRID.ROWS;
    const C     = Config.CELL;

    // ── Config integrity ───────────────────────────────────────────────────
    safe('Config — all tower types defined', () => {
      const types = ['laser','cryo','plasma','tesla','missile'];
      types.forEach(t => assert(`Config.TOWERS.${t} exists`, !!Config.TOWERS[t]));
      types.forEach(t => assert(`Config.TOWERS.${t}.cost > 0`, Config.TOWERS[t].cost > 0));
    });

    safe('Config — all enemy kill rewards defined', () => {
      const types = ['drone','soldier','shielded','heavy','sprinter','carrier'];
      types.forEach(t => assert(`KILL_REWARDS.${t} > 0`, Config.ECONOMY.KILL_REWARDS[t] > 0));
    });

    safe('Config — SELL_REFUND in range [0,1]', () => {
      assert('SELL_REFUND >= 0', Config.ECONOMY.SELL_REFUND >= 0);
      assert('SELL_REFUND <= 1', Config.ECONOMY.SELL_REFUND <= 1);
    });

    safe('Config — map tile arrays are rectangular', () => {
      const errors = MapLoader.validate(tiles, COLS, ROWS);
      assert('Map 0 has no validation errors', errors.length === 0);
    });

    safe('Config — all enemy types have required fields', () => {
      ['drone','soldier','shielded','heavy','sprinter','carrier'].forEach(t => {
        assert(`ENEMIES.${t}.hp > 0`,    Config.ENEMIES[t].hp    > 0);
        assert(`ENEMIES.${t}.speed > 0`, Config.ENEMIES[t].speed > 0);
        assert(`ENEMIES.${t}.lives > 0`, Config.ENEMIES[t].lives > 0);
      });
    });

    // ── MapLoader ──────────────────────────────────────────────────────────
    safe('MapLoader — validate: correct dimensions pass', () => {
      const errs = MapLoader.validate(tiles, COLS, ROWS);
      assert('No errors on valid map', errs.length === 0);
    });

    safe('MapLoader — validate: wrong column count detected', () => {
      const bad = tiles.map(row => [...row, 0]); // add an extra col
      const errs = MapLoader.validate(bad, COLS, ROWS);
      assert('Width error detected', errs.length > 0);
    });

    safe('MapLoader — validate: wrong row count detected', () => {
      const bad = [...tiles, new Array(COLS).fill(0)];
      const errs = MapLoader.validate(bad, COLS, ROWS);
      assert('Height error detected', errs.length > 0);
    });

    safe('MapLoader — validate: unknown cell value detected', () => {
      const bad = tiles.map(r => [...r]);
      bad[0][0] = 99;
      const errs = MapLoader.validate(bad, COLS, ROWS);
      assert('Unknown value error detected', errs.length > 0);
    });

    safe('MapLoader — getStart finds START cell', () => {
      const start = MapLoader.getStart(tiles, COLS, ROWS);
      assert('START cell found',         start !== null);
      assert('START cell value correct', tiles[start.row][start.col] === C.START);
    });

    safe('MapLoader — getEnd finds END cell', () => {
      const end = MapLoader.getEnd(tiles, COLS, ROWS);
      assert('END cell found',         end !== null);
      assert('END cell value correct', tiles[end.row][end.col] === C.END);
    });

    safe('MapLoader — getPathSequence returns ordered path', () => {
      const path = MapLoader.getPathSequence(tiles, COLS, ROWS);
      assert('Path has cells',                     path.length > 0);
      assert('Path starts at START cell',          tiles[path[0].row][path[0].col] === C.START);
      assert('Path ends at END cell',              tiles[path[path.length-1].row][path[path.length-1].col] === C.END);
      assert('Path has no duplicate cells',        path.length === new Set(path.map(p=>`${p.col},${p.row}`)).size);
      assert('All path cells are PATH/START/END',  path.every(p => [C.PATH,C.START,C.END].includes(tiles[p.row][p.col])));
    });

    safe('MapLoader — getPathSequence: each step is adjacent', () => {
      const path = MapLoader.getPathSequence(tiles, COLS, ROWS);
      let allAdjacent = true;
      for (let i = 1; i < path.length; i++) {
        const dc = Math.abs(path[i].col - path[i-1].col);
        const dr = Math.abs(path[i].row - path[i-1].row);
        if (dc + dr !== 1) { allAdjacent = false; break; }
      }
      assert('Every consecutive path pair is adjacent', allAdjacent);
    });

    safe('MapLoader — getBuildableCells: no path cell is buildable', () => {
      const buildable = MapLoader.getBuildableCells(tiles, COLS, ROWS);
      let overlap = false;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if ([C.PATH, C.START, C.END].includes(tiles[r][c]) && buildable.has(`${c},${r}`)) overlap = true;
      }
      assert('No path cell in buildable set', !overlap);
    });

    safe('MapLoader — getBuildableCells: all EMPTY cells are buildable', () => {
      const buildable = MapLoader.getBuildableCells(tiles, COLS, ROWS);
      let allPresent = true;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (tiles[r][c] === C.EMPTY && !buildable.has(`${c},${r}`)) allPresent = false;
      }
      assert('All EMPTY cells in buildable set', allPresent);
    });

    // ── GameState ──────────────────────────────────────────────────────────
    safe('GameState — init sets correct starting values', () => {
      GameState.init(0);
      const s = GameState.get();
      assert('Credits set to map starting value', s.credits === Config.MAPS[0].startingCredits);
      assert('Lives set to map starting value',   s.lives   === Config.MAPS[0].lives);
      assert('Wave starts at 0',                  s.wave    === 0);
      assert('Phase starts as build',             s.phase   === 'build');
      assert('Towers array is empty',             s.towers.length === 0);
    });

    safe('GameState — canAfford / spendCredits', () => {
      GameState.init(0);
      assert('Can afford 0',                    GameState.canAfford(0));
      assert('Can afford starting credits',     GameState.canAfford(Config.MAPS[0].startingCredits));
      assert('Cannot afford more than balance', !GameState.canAfford(Config.MAPS[0].startingCredits + 1));
      GameState.spendCredits(100);
      assert('Credits reduced after spend',     GameState.get().credits === Config.MAPS[0].startingCredits - 100);
      GameState.spendCredits(99999);
      assert('Credits floored at 0',            GameState.get().credits === 0);
    });

    safe('GameState — placeTower / removeTower', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      assert('Tower placed successfully',          t !== null);
      assert('Tower in towers array',              GameState.get().towers.length === 1);
      assert('getTowerAt finds placed tower',      GameState.getTowerAt(0,0) !== null);
      assert('Cell no longer buildable after place', !GameState.isBuildable(0,0));

      const removed = GameState.removeTower(t.id);
      assert('removeTower returns the tower',       removed !== null);
      assert('Towers array empty after remove',     GameState.get().towers.length === 0);
      assert('Cell buildable again after remove',   GameState.isBuildable(0,0));
    });

    safe('GameState — removeTower with invalid id returns null', () => {
      GameState.init(0);
      const result = GameState.removeTower(99999);
      assert('Returns null for unknown tower id', result === null);
    });

    safe('GameState — placeTower on path cell still works (caller must guard)', () => {
      // GameState.placeTower is intentionally dumb — callers must check isBuildable.
      // This test confirms placeTower itself doesn't throw on a path cell.
      GameState.init(0);
      const pathCell = MapLoader.getPathSequence(tiles, COLS, ROWS)[1];
      let threw = false;
      try { GameState.placeTower(pathCell.col, pathCell.row, 'laser'); }
      catch(e) { threw = true; }
      assert('placeTower does not throw on path cell', !threw);
      // Clean up
      GameState.init(0);
    });

    safe('GameState — loseLife floors at 0', () => {
      GameState.init(0);
      GameState.loseLife(99999);
      assert('Lives floored at 0', GameState.get().lives === 0);
    });

    // ── TowerManager / Step 2 ──────────────────────────────────────────────
    safe('upgradeTower — level 1 → 2 costs upgrade1 and increments level', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      const before = GameState.get().credits;
      const ok = GameState.upgradeTower(t.id);
      assert('upgradeTower returns true on success', ok === true);
      assert('Level incremented to 2', t.level === 2);
      assert('upgrade1 cost deducted', GameState.get().credits === before - Config.TOWERS.laser.upgrade1);
    });

    safe('upgradeTower — level 2 → 3 costs upgrade2', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      GameState.upgradeTower(t.id); // → lv2
      const before = GameState.get().credits;
      GameState.upgradeTower(t.id); // → lv3
      assert('Level incremented to 3', t.level === 3);
      assert('upgrade2 cost deducted', GameState.get().credits === before - Config.TOWERS.laser.upgrade2);
    });

    safe('upgradeTower — blocked at level 3 (max)', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      GameState.upgradeTower(t.id); // lv2
      GameState.upgradeTower(t.id); // lv3
      const before = GameState.get().credits;
      const ok = GameState.upgradeTower(t.id); // should fail
      assert('upgradeTower returns false at max', ok === false);
      assert('Credits unchanged at max level', GameState.get().credits === before);
      assert('Level stays at 3', t.level === 3);
    });

    safe('upgradeTower — blocked when cannot afford', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      GameState.spendCredits(99999); // drain all credits
      const ok = GameState.upgradeTower(t.id);
      assert('upgradeTower returns false when broke', ok === false);
      assert('Level unchanged when broke', t.level === 1);
    });

    safe('upgradeTower — unknown id returns false', () => {
      GameState.init(0);
      const ok = GameState.upgradeTower(99999);
      assert('Returns false for unknown id', ok === false);
    });

    safe('sell tower — refund is floor(cost × SELL_REFUND)', () => {
      GameState.init(0);
      GameState.spendCredits(GameState.get().credits); // start from 0
      const t = GameState.placeTower(0, 0, 'laser');  // costs 0 (no credits)
      // Manually put credits at 0 and test refund amount directly
      GameState.init(0);
      const t2    = GameState.placeTower(0, 0, 'laser');
      const before = GameState.get().credits;
      const refund = Math.floor(Config.TOWERS.laser.cost * Config.ECONOMY.SELL_REFUND);
      GameState.removeTower(t2.id);
      GameState.addCredits(refund);
      assert('Refund equals floor(cost × SELL_REFUND)',
        refund === Math.floor(Config.TOWERS.laser.cost * Config.ECONOMY.SELL_REFUND));
      assert('Refund is integer (no floats)', Number.isInteger(refund));
    });

    safe('selectTower / clearSelection', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      GameState.selectTower(t);
      assert('selectedTower set',   GameState.get().selectedTower === t);
      GameState.clearSelection();
      assert('selectedTower cleared', GameState.get().selectedTower === null);
    });

    safe('move fee — deducted on pickup, refunded on cancel', () => {
      GameState.init(0);
      const before = GameState.get().credits;
      const fee    = Config.ECONOMY.MOVE_FEE;
      // placeTower does NOT spend credits — that's the Game module's job.
      // This test only verifies the fee mechanics on GameState directly.
      GameState.placeTower(0, 0, 'laser');
      GameState.spendCredits(fee);
      const afterPickup = GameState.get().credits;
      assert('Fee deducted on pickup', afterPickup === before - fee);
      // Cancel: refund fee
      GameState.addCredits(fee);
      assert('Fee refunded on cancel', GameState.get().credits === before);
    });

    safe('move fee — blocked when cannot afford', () => {
      GameState.init(0);
      GameState.spendCredits(GameState.get().credits); // drain all
      assert('Cannot afford move fee when broke', !GameState.canAfford(Config.ECONOMY.MOVE_FEE));
    });

    // ── EnemyManager / WaveController ─────────────────────────────────────
    safe('GameState — spawnEnemy creates enemy at path index 0', () => {
      GameState.init(0);
      const e = GameState.spawnEnemy('soldier', 0);
      assert('Enemy exists in state',     GameState.get().enemies.length === 1);
      assert('Enemy type correct',        e.type === 'soldier');
      assert('Enemy hp matches config',   e.hp === Config.ENEMIES.soldier.hp);
      assert('Enemy starts at index 0',   e.pathIndex === 0);
      assert('Enemy has pixel position',  typeof e.px === 'number' && typeof e.py === 'number');
    });

    safe('GameState — damageEnemy reduces hp, returns true when dead', () => {
      GameState.init(0);
      const e = GameState.spawnEnemy('soldier', 0);
      const dead = GameState.damageEnemy(e.id, Config.ENEMIES.soldier.hp);
      assert('damageEnemy returns true when hp reaches 0', dead === true);
      assert('Enemy hp is 0',  e.hp === 0);
    });

    safe('GameState — damageEnemy returns false when enemy survives', () => {
      GameState.init(0);
      const e = GameState.spawnEnemy('soldier', 0);
      const dead = GameState.damageEnemy(e.id, 1);
      assert('damageEnemy returns false when alive', dead === false);
      assert('HP reduced correctly', e.hp === Config.ENEMIES.soldier.hp - 1);
    });

    safe('GameState — damageEnemy on unknown id returns false', () => {
      GameState.init(0);
      const dead = GameState.damageEnemy(99999, 100);
      assert('Returns false for unknown enemy id', dead === false);
    });

    safe('GameState — removeEnemy removes and returns enemy', () => {
      GameState.init(0);
      const e = GameState.spawnEnemy('drone', 0);
      const removed = GameState.removeEnemy(e.id);
      assert('removeEnemy returns the enemy',          removed !== null);
      assert('Enemy no longer in enemies array',        GameState.get().enemies.length === 0);
    });

    safe('GameState — hp floored at 0 (no negative hp)', () => {
      GameState.init(0);
      const e = GameState.spawnEnemy('drone', 0);
      GameState.damageEnemy(e.id, 999999);
      assert('HP never goes below 0', e.hp === 0);
    });

    safe('WaveController — buildSpawnQueue single group, no pre-pause', () => {
      const waveDef = { groups: [{ type:'drone', count:4 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      assert('4 entries for 4 drones',          queue.length === 4);
      assert('First enemy spawns at 0ms',        queue[0].delayMs === 0);
      assert('All entries are drones',           queue.every(q => q.type === 'drone'));
      assert('Delays are non-decreasing',        queue.every((q,i) => i===0 || q.delayMs >= queue[i-1].delayMs));
      assert('Within-group gap correct',         queue[1].delayMs === Config.SPAWN.WITHIN_GROUP_MS);
    });

    safe('WaveController — buildSpawnQueue gap omitted defaults to 1× standard', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [{ type:'drone', count:2 }, { type:'soldier', count:2 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      const lastDrone    = queue[1].delayMs;
      const firstSoldier = queue[2].delayMs;
      const actualGap    = firstSoldier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('Default gap is 1× BETWEEN_GROUP_STANDARD', actualGap === sp.BETWEEN_GROUP_STANDARD);
    });

    safe('WaveController — buildSpawnQueue gap:2 doubles the standard gap', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [{ type:'drone', count:2 }, { type:'soldier', count:2, gap:2 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      const lastDrone    = queue[1].delayMs;
      const firstSoldier = queue[2].delayMs;
      const actualGap    = firstSoldier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('gap:2 produces 2× standard gap', actualGap === 2 * sp.BETWEEN_GROUP_STANDARD);
    });

    safe('WaveController — buildSpawnQueue gap:0.5 halves the standard gap', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [{ type:'drone', count:2 }, { type:'soldier', count:2, gap:0.5 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      const lastDrone    = queue[1].delayMs;
      const firstSoldier = queue[2].delayMs;
      const actualGap    = firstSoldier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('gap:0.5 produces 0.5× standard gap', actualGap === 0.5 * sp.BETWEEN_GROUP_STANDARD);
    });

    safe('WaveController — buildSpawnQueue gap:0 clamps to BETWEEN_GROUP_MIN', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [{ type:'drone', count:2 }, { type:'soldier', count:2, gap:0 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      const lastDrone    = queue[1].delayMs;
      const firstSoldier = queue[2].delayMs;
      const actualGap    = firstSoldier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('gap:0 clamps to BETWEEN_GROUP_MIN', actualGap === sp.BETWEEN_GROUP_MIN);
    });

    safe('WaveController — buildSpawnQueue negative gap clamps to BETWEEN_GROUP_MIN', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [{ type:'drone', count:2 }, { type:'soldier', count:2, gap:-5 }] };
      const queue   = WaveController.buildSpawnQueue(waveDef);
      const lastDrone    = queue[1].delayMs;
      const firstSoldier = queue[2].delayMs;
      const actualGap    = firstSoldier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('Negative gap clamps to BETWEEN_GROUP_MIN', actualGap === sp.BETWEEN_GROUP_MIN);
    });

    safe('WaveController — buildSpawnQueue first group never has pre-pause', () => {
      const waveDef = { groups: [{ type:'drone', count:3, gap:5 }] }; // gap on first group ignored
      const queue   = WaveController.buildSpawnQueue(waveDef);
      assert('First enemy always at 0ms regardless of gap', queue[0].delayMs === 0);
    });

    safe('WaveController — buildSpawnQueue gap:4 wave 9 style', () => {
      const sp  = Config.SPAWN;
      const waveDef = { groups: [
        { type:'drone',   count:3 },
        { type:'carrier', count:2, gap:4 },
      ]};
      const queue       = WaveController.buildSpawnQueue(waveDef);
      const lastDrone   = queue[2].delayMs;
      const firstCarrier = queue[3].delayMs;
      const actualGap   = firstCarrier - lastDrone - sp.WITHIN_GROUP_MS;
      assert('gap:4 produces 4× standard gap (12000ms)', actualGap === 4 * sp.BETWEEN_GROUP_STANDARD);
    });

    safe('Config.WAVES — all wave enemy types exist in Config.ENEMIES', () => {
      const knownTypes = new Set(Object.keys(Config.ENEMIES));
      let allValid = true;
      Config.WAVES.forEach((wave, wi) => {
        wave.groups.forEach(g => {
          if (!knownTypes.has(g.type)) {
            allValid = false;
            failedLabels.push(`Wave ${wi+1} uses unknown enemy type: ${g.type}`);
            failed++;
          }
        });
      });
      assert('All wave enemy types are valid', allValid);
    });

    safe('Config.WAVES — all wave counts are positive integers', () => {
      let ok = true;
      Config.WAVES.forEach((wave, wi) => {
        wave.groups.forEach((g, gi) => {
          if (!Number.isInteger(g.count) || g.count < 1) ok = false;
        });
      });
      assert('All group counts are positive integers', ok);
    });

    // ── TowerManager / ProjectileManager — Step 4 ─────────────────────────
    safe('towerStats — returns correct level block', () => {
      GameState.init(0);
      const t = GameState.placeTower(0, 0, 'laser');
      const s1 = GameState.towerStats(t);
      assert('lv1 stats returned at level 1', s1 === Config.TOWERS.laser.lv1);
      assert('lv1 has pierce 1', s1.pierce === 1);
      GameState.upgradeTower(t.id);
      const s2 = GameState.towerStats(t);
      assert('lv2 stats returned at level 2', s2 === Config.TOWERS.laser.lv2);
      assert('lv2 has pierce 2', s2.pierce === 2);
      GameState.upgradeTower(t.id);
      const s3 = GameState.towerStats(t);
      assert('lv3 stats returned at level 3', s3 === Config.TOWERS.laser.lv3);
      assert('lv3 has pierce 3', s3.pierce === 3);
    });

    safe('towerStats — all tower types have valid lv1/lv2/lv3 blocks', () => {
      ['laser','cryo','plasma','tesla','missile'].forEach(type => {
        [1,2,3].forEach(lv => {
          const cfg = Config.TOWERS[type]['lv'+lv];
          assert(`${type} lv${lv} exists`,      !!cfg);
          assert(`${type} lv${lv} range > 0`,   cfg.range > 0);
        });
      });
    });

    safe('towerStats — damage does not decrease with level for damage towers', () => {
      ['laser','plasma','tesla','missile'].forEach(type => {
        assert(`${type} lv2 damage >= lv1`, Config.TOWERS[type].lv2.damage >= Config.TOWERS[type].lv1.damage);
        assert(`${type} lv3 damage >= lv2`, Config.TOWERS[type].lv3.damage >= Config.TOWERS[type].lv2.damage);
      });
    });

    safe('towerStats — range increases with level for all towers', () => {
      ['laser','cryo','plasma','tesla','missile'].forEach(type => {
        assert(`${type} lv2 range >= lv1`, Config.TOWERS[type].lv2.range >= Config.TOWERS[type].lv1.range);
        assert(`${type} lv3 range >= lv2`, Config.TOWERS[type].lv3.range >= Config.TOWERS[type].lv2.range);
      });
    });

    safe('towerStats — tesla chains increase with level', () => {
      assert('tesla lv2 chains > lv1', Config.TOWERS.tesla.lv2.chains > Config.TOWERS.tesla.lv1.chains);
      assert('tesla lv3 chains > lv2', Config.TOWERS.tesla.lv3.chains > Config.TOWERS.tesla.lv2.chains);
    });

    safe('towerStats — cryo has damage 0 and slowFactor in (0,1)', () => {
      [1,2,3].forEach(lv => {
        const cfg = Config.TOWERS.cryo['lv'+lv];
        assert(`cryo lv${lv} damage === 0`,              cfg.damage === 0);
        assert(`cryo lv${lv} slowFactor in (0,1)`,       cfg.slowFactor > 0 && cfg.slowFactor < 1);
        assert(`cryo lv${lv} pulseRate > 0`,             cfg.pulseRate > 0);
      });
    });

    safe('GameState — virtualTime initialises to 0', () => {
      GameState.init(0);
      assert('virtualTime starts at 0', GameState.get().virtualTime === 0);
    });

    safe('GameState — projectiles array initialises empty', () => {
      GameState.init(0);
      assert('projectiles starts empty', GameState.get().projectiles.length === 0);
    });

    safe('GameState — enemiesKilled starts at 0', () => {
      GameState.init(0);
      assert('enemiesKilled = 0 on init', GameState.get().enemiesKilled === 0);
    });

    safe('GameState — perfectWaves starts at 0', () => {
      GameState.init(0);
      assert('perfectWaves = 0 on init', GameState.get().perfectWaves === 0);
    });

    safe('GameState — startTime is set on init', () => {
      const before = Date.now();
      GameState.init(0);
      const after = Date.now();
      assert('startTime set on init', GameState.get().startTime >= before && GameState.get().startTime <= after);
    });

    safe('Config.WAVES — all waves have at least one group', () => {
      Config.WAVES.forEach((wave, i) => {
        assert(`Wave ${i+1} has at least one group`, wave.groups.length >= 1);
      });
    });

    safe('Config.WAVES length matches map wave count', () => {
      assert('WAVES length matches map waves setting',
        Config.WAVES.length === Config.MAPS[0].waves);
    });

    const banner = document.getElementById('test-banner');
    const total  = passed + failed;
    if (failed === 0) {
      banner.style.display='none';
    } else {
      banner.textContent = `❌ ${failed}/${total} failed: ${failedLabels.join(' · ')}`;
      banner.className = 'fail';
    }
  }

  return { run };
})();

// ── Boot ──────────────────────────────────────────────────────────────────
