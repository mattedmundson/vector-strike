// Phase 2 (wave 2+): low-level run over the battle-station surface.
// Fly between gun towers, shoot their caps, don't fly into them.
import { v, rand, clamp, approach } from '../math.js';
import { COLORS } from '../renderer.js';
import { box, pyramid } from '../models.js';
import { TUNING } from '../config.js';

const VIEW = 700;

export class SurfacePhase {
  constructor(game) {
    this.g = game;
    const w = game.wave;
    this.speed = 110 + w * 12;
    this.length = 2600 + w * 200;
    this.towers = [];
    this.nextRow = 250;
    this.destroyed = 0;
    this.total = 0;
    this.fireRate = Math.max(2.6 - w * 0.2, 1.0);
    this.title = 'SURFACE RUN';
    this.subtitle = 'SHOOT THE TOWER CAPS';
    const cam = game.cam;
    cam.pos = v(0, 22, 0);
    cam.pitch = -0.12;
    this.camVel = v(0, 0, this.speed);
    this.done = false;
  }

  update(dt) {
    const g = this.g, cam = g.cam, inp = g.input;
    cam.pos.x = clamp(cam.pos.x + inp.aimX * TUNING.surfaceStrafe * dt, -160, 160);
    cam.pos.y = clamp(cam.pos.y + inp.aimY * 45 * dt, 6, 60);
    cam.pos.z += this.speed * dt;
    cam.roll = approach(cam.roll, -inp.aimX * 0.3, 4, dt);
    cam.pitch = -0.12;

    if (this.done) { if ((this.doneT -= dt) <= 0) g.goto('trench'); return; }

    // spawn rows of towers ahead
    while (this.nextRow < Math.min(cam.pos.z + VIEW, this.length - 150)) {
      const n = 1 + Math.floor(Math.random() * Math.min(1 + g.wave, 4));
      for (let i = 0; i < n; i++) {
        const h = rand(14, 48);
        this.towers.push({ x: cam.pos.x * 0.3 + rand(-140, 140), z: this.nextRow + rand(-15, 15), h, half: 4, alive: true, fireT: rand(0.5, this.fireRate) });
        this.total++;
      }
      this.nextRow += rand(70, 120);
    }

    for (const t of this.towers) {
      if (!t.alive) continue;
      const dz = t.z - cam.pos.z;
      t.fireT -= dt;
      if (t.fireT <= 0 && dz > 110 && dz < 420) {
        g.shootFireball(v(t.x, t.h + 4, t.z), 70 + g.wave * 6);
        t.fireT = rand(this.fireRate * 0.8, this.fireRate * 1.6);
      }
      // collision as we pass through the tower's z
      if (Math.abs(dz) < this.speed * dt + 1 && Math.abs(t.x - cam.pos.x) < t.half + 2 && cam.pos.y < t.h + 6) {
        t.alive = false;
        g.explode(v(t.x, t.h, t.z), COLORS.tower, 14, 30);
        g.damage();
      }
    }
    this.towers = this.towers.filter((t) => t.z > cam.pos.z - 10);

    if (cam.pos.z >= this.length) {
      this.done = true; this.doneT = 1.8;
      g.showBanner('TRENCH AHEAD', `TOWERS DESTROYED ${this.destroyed}`, 1.8);
    }
  }

  targets() {
    return this.towers.filter((t) => t.alive).map((t) => ({
      pos: v(t.x, t.h + 3, t.z), radius: 5,
      hit: () => {
        t.alive = false;
        this.destroyed++;
        this.g.addScore(TUNING.points.tower);
        this.g.explode(v(t.x, t.h + 2, t.z), COLORS.tower, 20, 35);
      },
    }));
  }

  draw(r) {
    const cam = this.g.cam;
    this.g.drawStars();
    const z0 = cam.pos.z + 2, z1 = cam.pos.z + VIEW;
    // ground grid
    const gx = Math.round(cam.pos.x / 40) * 40;
    for (let k = -7; k <= 7; k++) r.line3(v(gx + k * 40, 0, z0), v(gx + k * 40, 0, z1), COLORS.grid);
    for (let z = Math.ceil(z0 / 50) * 50; z < z1; z += 50) r.line3(v(gx - 300, 0, z), v(gx + 300, 0, z), COLORS.grid);

    for (const t of this.towers) {
      if (!t.alive || t.z > z1) continue;
      const b = box(t.x - t.half, t.x + t.half, 0, t.h, t.z - t.half, t.z + t.half);
      r.wire(b.verts, b.edges, COLORS.tower);
      const p = pyramid(t.x, t.h, t.z, t.half * 0.9, 5);
      r.wire(p.verts, p.edges, COLORS.target);
    }
  }

  hud(r) {
    const left = Math.max(0, Math.round(this.length - this.g.cam.pos.z));
    r.text(`TOWERS ${this.destroyed}   TRENCH ${left}`, r.cx, r.h - r.unit * 1.2, r.unit * 0.75, COLORS.tower);
  }
}
