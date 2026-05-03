'use strict';

const Config = Object.freeze({
  W: 560, H: 320,
  GROUND_Y: 290, CEIL_Y: 10,
  PLAYER_X: 90,
  PLAYER_W: 28, PLAYER_H: 28,
  PLAYER_COLLISION_R: 11,

  // Physics
  GRAVITY:        0.10,
  MAX_FALL:       2.0,   // terminal velocity downward
  MAX_RISE:      -2.0,   // terminal velocity upward

  // Progressive thrust: ramps from INITIAL to MAX over RAMP_MS of held time
  THRUST_INITIAL: -0.12, // impulse per frame at t=0
  THRUST_MAX:     -0.20, // impulse per frame at full ramp
  THRUST_RAMP_MS: 1000,  // ms to reach full thrust

  // Obstacle layout guarantees
  MIN_GAP_Y:            100, // minimum vertical passage through a spike pair (px)
  MIN_OBSTACLE_SPACING: 220, // minimum horizontal gap between obstacle leading edges (px)

  MODE: Object.freeze({
    easy:   Object.freeze({ baseSpeed:1.0, speedInc:0.00004, obstacleRate:0.010, laserOn:false, missileOn:false }),
    normal: Object.freeze({ baseSpeed:1.5, speedInc:0.00006, obstacleRate:0.016, laserOn:true,  missileOn:true  }),
    hard:   Object.freeze({ baseSpeed:2.0, speedInc:0.00010, obstacleRate:0.022, laserOn:true,  missileOn:true  }),
  }),

  POWERUP: Object.freeze({
    SHIELD_MS: 5000, MAGNET_MS: 6000, BOOST_MS: 3000, BOOST_SPEED_MULT: 1.6,
  }),

  COIN_R: 7, COIN_MAGNET_R: 110,
  LASER_BLINK_MS: 700, LASER_WARN_MS: 400,
  MISSILE_SPEED: 2.0, MISSILE_HOMING: 0.04,
  COIN_SPAWN_EVERY: 90, PU_SPAWN_EVERY: 400,
});
