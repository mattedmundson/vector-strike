// Gameplay tuning in one place.
export const TUNING = {
  startShields: 6,
  fireCooldown: 0.17,
  invulnTime: 0.8,
  fireballHitRadius: 5,
  // steering speeds
  spaceYawRate: 1.7,     // rad/s at full deflection (was 1.25)
  spacePitchRate: 1.15,
  surfaceStrafe: 125,    // units/s sideways
  trenchStrafe: 72,
  points: { fighter: 1000, fireball: 33, tower: 200, turret: 300, port: 5000, instinctBonus: 25000 },
};
