'use strict';
const WaveController = (() => {
  let _spawnTimer   = null;   // interval id for enemy spawning
  let _countdownTimer = null; // timeout id for auto-starting next wave
  let _onWaveEnd    = null;   // callback fired when all enemies cleared

  // Begin the countdown before a wave starts.
  function startCountdown(onWaveEnd) {
    _onWaveEnd = onWaveEnd;
    _clearTimers();
    const state = GameState.get();
    GameState.setPhase('countdown');
    state.countdownEnd = Date.now() + Config.WAVE_COUNTDOWN_MS;
    _countdownTimer = setTimeout(_beginSpawning, Config.WAVE_COUNTDOWN_MS);
  }

  // Player clicks send-early — start immediately, award bonus.
  function sendEarly() {
    const state = GameState.get();
    if (state.phase !== 'countdown') return;
    const remaining = state.countdownEnd - Date.now();
    if (remaining <= 0) return;
    clearTimeout(_countdownTimer);
    GameState.addCredits(Config.ECONOMY.WAVE_BONUS.send_early);
    _beginSpawning();
  }

  function _beginSpawning() {
    const state = GameState.get();
    GameState.setPhase('wave');
    state.leakedThisWave  = false;
    state.waveStarted     = true;

    const waveDef = Config.WAVES[state.wave];
    if (!waveDef) { _onWaveEnd && _onWaveEnd(); return; }

    const queue = _buildSpawnQueue(waveDef);
    if (queue.length === 0) { _waveCleared(); return; }

    let qIdx    = 0;
    let elapsed = 0;
    const TICK  = 100; // base interval ms

    function startInterval(speed) {
      clearInterval(_spawnTimer);
      _spawnTimer = setInterval(() => {
        const s = GameState.get();
        if (s.phase !== 'wave') { _clearTimers(); return; }

        // Advance virtual time by tick scaled by current speed
        elapsed += TICK * Game.getSpeed();

        while (qIdx < queue.length && queue[qIdx].delayMs <= elapsed) {
          GameState.spawnEnemy(queue[qIdx].type, 0);
          qIdx++;
        }

        if (qIdx >= queue.length && s.enemies.length === 0) {
          _clearTimers();
          _waveCleared();
        }
      }, TICK);
    }

    // Store so rescaleInterval can restart without losing queue state
    _startInterval = startInterval;
    startInterval(1);
  }

  // Called by Game.setSpeed() — restarts interval at same queue position
  function rescaleInterval(speed) {
    if (_spawnTimer && _startInterval) _startInterval(speed);
  }

  let _startInterval = null;

  // Build ordered spawn queue from wave definition.
  // Returns [{type, delayMs}] in ascending delayMs order.
  // group.gap (optional, default 1) is a multiplier on BETWEEN_GROUP_STANDARD.
  // First group never has a pre-pause. gap <= 0 clamps to BETWEEN_GROUP_MIN.
  function _buildSpawnQueue(waveDef) {
    const sp    = Config.SPAWN;
    const queue = [];
    let cursor  = 0;

    waveDef.groups.forEach((group, gi) => {
      if (gi > 0) {
        const scalar   = group.gap !== undefined ? group.gap : 1;
        const rawGap   = scalar * sp.BETWEEN_GROUP_STANDARD;
        const groupGap = Math.max(sp.BETWEEN_GROUP_MIN, rawGap);
        cursor += groupGap;
      }
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, delayMs: cursor });
        cursor += sp.WITHIN_GROUP_MS;
      }
    });

    return queue;
  }

  function _waveCleared() {
    const state   = GameState.get();
    const waveDef = Config.WAVES[state.wave];
    const bonus   = Config.ECONOMY.WAVE_BONUS[waveDef.waveType] || Config.ECONOMY.WAVE_BONUS.standard;
    GameState.addCredits(bonus);
    if (!state.leakedThisWave) {
      GameState.addCredits(Config.ECONOMY.WAVE_BONUS.perfect_clear);
      state.perfectWaves++;
    }

    state.wave++;

    if (state.wave >= state.mapDef.waves) {
      GameState.setPhase('win');
      _onWaveEnd && _onWaveEnd('win');
    } else {
      _onWaveEnd && _onWaveEnd('next');
    }
  }

  function _clearTimers() {
    clearInterval(_spawnTimer);
    clearTimeout(_countdownTimer);
    _spawnTimer = null;
    _countdownTimer = null;
  }

  function reset() {
    _clearTimers();
    _onWaveEnd = null;
  }

  // Exposed for testing
  function buildSpawnQueue(waveDef) { return _buildSpawnQueue(waveDef); }

  return { startCountdown, sendEarly, reset, rescaleInterval, buildSpawnQueue };
})();

/* ═══════════════════════════════════════════════════════════════════════════
   SCREEN MANAGER
   Animated win/lose overlays and particle system.
   Draws on top of the frozen game canvas. Owns its own RAF loop while active.
   ═══════════════════════════════════════════════════════════════════════════ */
