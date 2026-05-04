'use strict';

const Config = Object.freeze({
  W: 560, H: 320,
  GROUND_Y: 290, CEIL_Y: 10,
  PLAYER_X: 90,
  PLAYER_W: 28, PLAYER_H: 28,
  PLAYER_COLLISION_R: 11,

  // Physics
  GRAVITY:        0.10,
  MAX_FALL:       2.0,
  MAX_RISE:      -2.0,

  // Progressive thrust
  THRUST_INITIAL: -0.12,
  THRUST_MAX:     -0.20,
  THRUST_RAMP_MS: 1000,

  // Obstacle layout guarantees
  // MIN_GAP_Y: minimum vertical clear passage through a spike pair (px).
  //   Must be large enough for the player to fly through comfortably.
  //   Player collision radius is 11px, so 80px gives ~4x diameter of clearance.
  MIN_GAP_Y: 80,

  // MIN_OBSTACLE_SPACING: minimum horizontal distance (px) between the
  //   *current scrolled position* of the last obstacle and the new spawn point.
  //   Prevents two obstacles occupying the screen at the same time too close together.
  //   Spawn always happens at x = W + 20 = 580. This value must be < W so that
  //   an obstacle can scroll off the left before a new one is allowed.
  MIN_OBSTACLE_SPACING: 300,

  MODE: Object.freeze({
    //   minSpawnFrames: minimum frames between any two obstacle spawns.
    //   At ~60fps: easy=240f=4s, normal=150f=2.5s, hard=90f=1.5s
    easy:   Object.freeze({ baseSpeed:1.0, speedInc:0.00004, minSpawnFrames:240, laserOn:false, missileOn:false }),
    normal: Object.freeze({ baseSpeed:1.5, speedInc:0.00006, minSpawnFrames:150, laserOn:true,  missileOn:true  }),
    hard:   Object.freeze({ baseSpeed:2.0, speedInc:0.00010, minSpawnFrames:90,  laserOn:true,  missileOn:true  }),
  }),

  POWERUP: Object.freeze({
    SHIELD_MS: 5000, MAGNET_MS: 6000, BOOST_MS: 3000, BOOST_SPEED_MULT: 1.6,
  }),

  COIN_R: 7, COIN_MAGNET_R: 110,
  LASER_BLINK_MS: 700, LASER_WARN_MS: 400,
  MISSILE_SPEED: 2.0, MISSILE_HOMING: 0.04,
  COIN_SPAWN_EVERY: 90, PU_SPAWN_EVERY: 400,
});
