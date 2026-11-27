import { lineOfSight } from './collision.js';

export function interactionInReach(player, target, slack = 0) {
  const eyeY = (player.y ?? 0) + 1.2;
  const reach = target.reach ?? 2.4;
  return Math.hypot(player.x - target.x, player.z - target.z) <= reach + slack &&
    Math.abs(eyeY - target.y) <= 1.25 &&
    (!target.side || (player.z - target.z) * target.side >= 0.35) &&
    lineOfSight([player.x, eyeY, player.z], [target.x, target.y, target.z]);
}
