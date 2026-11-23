export const MOVE_SPEED = 5; // m/s
export const PLAYER_RADIUS = 0.4;
export const PICKUP_RADIUS = 2; // m from treasure center where the pickup button shows
export const PICKUP_TOLERANCE = 0.5; // server-side slack on top of PICKUP_RADIUS
export const RANKING_SIZE = 10;
export const MIN_QUESTIONS = 25; // admin can't start with fewer (one gift per question)
export const QUIZ_SECONDS = 20;
export const HINT_SECONDS = 180; // hint turns on when this much time is left
// m; beyond this the hint stays quiet. 25 m was always-on: with 40 treasures the nearest is ~7.5 m away (median)
export const HINT_RANGE = 12;
export const PLAYER_HEIGHT = 1.8;
export const STEP_HEIGHT = 0.6; // highest ledge a walker steps onto without stairs
export const GRAVITY = 22; // m/s²
export const JUMP_SPEED = 7.5; // m/s up; peak = JUMP_SPEED² / 2g ≈ 1.28 m, so a 1.9 m ledge is the highest you can land on
export const MAX_FALL = 25; // m/s terminal speed
export const HEAD_ROOM = 1.6; // m a jump needs under a roof or deck (a bit under PLAYER_HEIGHT so beds still fit)
export const PICKUP_HEIGHT = 1.2; // max height difference between player feet and treasure
export const NAME_MAX = 12;
export const GAME_SECONDS_DEFAULT = 900; // 15 min; server env GAME_SECONDS overrides for testing
export const TICK_MS = 100; // position send + broadcast rate (10 Hz)
export const SPEED_TOLERANCE = 1.5; // server accepts moves up to this multiple of MOVE_SPEED
export const CAMERA_DISTANCE = 6;
export const CAMERA_MIN_PITCH = 0.15; // radians above horizon
export const CAMERA_MAX_PITCH = 1.2;
export const LOOK_SENSITIVITY = 0.005; // radians per drag pixel
