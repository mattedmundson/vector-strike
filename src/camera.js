import { v, sub, dot, basis } from './math.js';

export class Camera {
  constructor() {
    this.pos = v(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0; // applied in screen space by the renderer
    this.update();
  }

  update() {
    const cp = Math.cos(this.pitch);
    const fwd = v(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const b = basis(fwd);
    this.r = b.r; this.u = b.u; this.f = b.f;
  }

  /** World point -> camera space (x right, y up, z depth). */
  toCam(p) {
    const d = sub(p, this.pos);
    return v(dot(d, this.r), dot(d, this.u), dot(d, this.f));
  }

  /** Direction-only transform (for stars at infinity). */
  dirToCam(d) {
    return v(dot(d, this.r), dot(d, this.u), dot(d, this.f));
  }
}
