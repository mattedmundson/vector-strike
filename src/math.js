// Tiny 3D vector helpers. Coordinate system: x right, y up, z forward (into the screen).
export const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a, s) => v(a.x * s, a.y * s, a.z * s);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const norm = (a) => { const l = len(a) || 1; return scale(a, 1 / l); };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);

const Y = v(0, 1, 0);

/** Orthonormal basis that points local +z along `fwd` (with optional roll). */
export function basis(fwd, roll = 0) {
  const f = norm(fwd);
  let r = cross(Y, f);
  if (len(r) < 1e-4) r = v(1, 0, 0);
  r = norm(r);
  let u = cross(f, r);
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2 = add(scale(r, c), scale(u, s));
    u = add(scale(u, c), scale(r, -s));
    r = r2;
  }
  return { r, u, f };
}

/** Transform a model-space point into world space given position + basis. */
export const toWorld = (p, pos, b, s = 1) =>
  v(
    pos.x + (b.r.x * p[0] + b.u.x * p[1] + b.f.x * p[2]) * s,
    pos.y + (b.r.y * p[0] + b.u.y * p[1] + b.f.y * p[2]) * s,
    pos.z + (b.r.z * p[0] + b.u.z * p[1] + b.f.z * p[2]) * s,
  );
