export const MOVE_SPEED = 5; // m/s
export const PLAYER_RADIUS = 0.4;
export const PICKUP_RADIUS = 2; // m from treasure center where the pickup button shows
export const PICKUP_TOLERANCE = 0.5; // server-side slack on top of PICKUP_RADIUS
export const RANKING_SIZE = 10;
export const HINT_SECONDS = 180; // hint turns on when this much time is left
// m; beyond this the hint stays quiet. 25 m was always-on: with 40 treasures the nearest is ~7.5 m away (median)
export const HINT_RANGE = 12;
export const PLAYER_HEIGHT = 1.8; // boxes starting above this (roofs) don't block walking
export const NAME_MAX = 12;
export const GAME_SECONDS_DEFAULT = 900; // 15 min; server env GAME_SECONDS overrides for testing
export const TICK_MS = 100; // position send + broadcast rate (10 Hz)
export const SPEED_TOLERANCE = 1.5; // server accepts moves up to this multiple of MOVE_SPEED
export const CAMERA_DISTANCE = 6;
export const CAMERA_MIN_PITCH = 0.15; // radians above horizon
export const CAMERA_MAX_PITCH = 1.2;
export const LOOK_SENSITIVITY = 0.005; // radians per drag pixel
