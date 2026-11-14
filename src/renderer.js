// Fake colour-vector monitor: every line is batched per colour and stroked twice
// (a wide dim "bloom" pass, then a thin bright core) with additive blending.
// The frame isn't fully cleared, so lines leave a short phosphor trail.

export const NEAR = 1;

export const COLORS = {
  enemy: '#ff4040',
  fire: '#ffb020',
  grid: '#30ff70',
  trench: '#30ff70',
  tower: '#40a0ff',
  target: '#ff40ff',
  hud: '#ffe040',
  cross: '#ffe040',
  laser: '#ff5050',
  star: '#c8d8ff',
  white: '#ffffff',
  cyan: '#40ffff',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.batches = new Map();
    this.cam = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.f = Math.min(this.w, this.h) * 1.05; // focal length in px
    this.unit = Math.min(this.w, this.h) / 30; // HUD text unit
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  begin(persistence = 0.6) {
    const c = this.ctx;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = `rgba(0,0,0,${persistence})`;
    c.fillRect(0, 0, this.w, this.h);
    this.batches.clear();
  }

  /** Camera-space point -> screen {x, y, s} where s = px per world unit at that depth. */
  project(p) {
    const s = this.f / p.z;
    const dx = p.x * s, dy = -p.y * s;
    const roll = this.cam ? this.cam.roll : 0;
    if (!roll) return { x: this.cx + dx, y: this.cy + dy, s };
    const c = Math.cos(roll), n = Math.sin(roll);
    return { x: this.cx + dx * c - dy * n, y: this.cy + dx * n + dy * c, s };
  }

  line(x1, y1, x2, y2, color) {
    let b = this.batches.get(color);
    if (!b) this.batches.set(color, (b = []));
    b.push(x1, y1, x2, y2);
  }

  /** Line between two camera-space points, clipped against the near plane. */
  lineCam(a, b, color) {
    if (a.z < NEAR && b.z < NEAR) return;
    if (a.z < NEAR || b.z < NEAR) {
      const t = (NEAR - a.z) / (b.z - a.z);
      const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR };
      if (a.z < NEAR) a = m; else b = m;
    }
    const p = this.project(a), q = this.project(b);
    this.line(p.x, p.y, q.x, q.y, color);
  }

  /** Line between two world points (uses current camera). */
  line3(a, b, color) {
    this.lineCam(this.cam.toCam(a), this.cam.toCam(b), color);
  }

  /** Draw a wireframe given world-space vertices and edge index pairs. */
  wire(verts, edges, color) {
    const cs = verts.map((p) => this.cam.toCam(p));
    for (const [i, j] of edges) this.lineCam(cs[i], cs[j], color);
  }

  flush() {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    for (const [color, segs] of this.batches) {
      c.strokeStyle = color;
      c.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        c.moveTo(segs[i], segs[i + 1]);
        c.lineTo(segs[i + 2], segs[i + 3]);
      }
      c.globalAlpha = 0.16; c.lineWidth = 6; c.stroke();
      c.globalAlpha = 1; c.lineWidth = 1.6; c.stroke();
    }
    c.globalAlpha = 1;
  }

  text(str, x, y, size, color, align = 'center') {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.font = `bold ${Math.round(size)}px "Courier New", ui-monospace, monospace`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = size * 0.6;
    c.fillText(str, x, y);
    c.shadowBlur = 0;
  }

  flash(color, alpha) {
    if (alpha <= 0) return;
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.min(alpha, 1);
    c.fillStyle = color;
    c.fillRect(0, 0, this.w, this.h);
    c.globalAlpha = 1;
  }
}
