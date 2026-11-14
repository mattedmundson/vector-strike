// Phase 1: open-space dogfight. The player only rotates (yaw/pitch);
// enemies swoop in from ahead, weave, fire, and fly past.
import { v, add, sub, scale, norm, len, rand, clamp, approach, basis, toWorld } from '../math.js';
import { COLORS } from '../renderer.js';
import { DART } from '../models.js';
import { TUNING } from '../config.js';

export class SpacePhase {
  constructor(game) {
    this.g = game;
    const w = game.wave;
    this.needed = 6 + w * 2;
    this.kills = 0;
    this.maxEnemies = Math.min(2 + Math.ceil(w / 2), 6);
    this.speed = 70 + w * 10;
    this.fireRate = Math.max(2.8 - w * 0.25, 0.9);
    this.enemies = [];
    this.delay = 1.5;
    this.spawnT = 0;
    this.camVel = v(0, 0, 0);
    this.done = false;
    this.title = `WAVE ${w}`;
    this.subtitle = 'DESTROY THE INTERCEPTORS';
  }

  spawn() {
    const c = this.g.cam;
    const dist = rand(380, 480);
    const start = add(add(scale(c.f, dist), scale(c.r, rand(-180, 180))), scale(c.u, rand(-100, 100)));
    const miss = add(scale(c.r, rand(-45, 45)), scale(c.u, rand(-35, 35)));
    const vel = scale(norm(sub(miss, start)), this.speed * rand(0.85, 1.15));
    this.enemies.push({
      start, vel, t: 0,
      side: c.r, up: c.u,
      weaveA: rand(15, 45), weaveF: rand(0.8, 1.8), weaveP: rand(0, 6),
      bobA: rand(5, 25), bobF: rand(0.6, 1.4),
      fireT: rand(1, this.fireRate + 1),
      pos: start, alive: true,
    });
  }

  update(dt) {
    const g = this.g, inp = g.input, cam = g.cam;
    // steering: crosshair offset sets turn rate
    cam.yaw += inp.aimX * 1.25 * dt;
    cam.pitch = clamp(cam.pitch + inp.aimY * 1.0 * dt, -1.1, 1.1);
    cam.roll = approach(cam.roll, -inp.aimX * 0.35, 4, dt);

    if (this.done) {
      if ((this.doneT -= dt) <= 0) g.goto(g.wave >= 2 ? 'surface' : 'trench');
      return;
    }

    this.delay -= dt;
    if (this.delay <= 0 && this.enemies.length < this.maxEnemies && this.kills + this.enemies.length < this.needed + 2) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawn(); this.spawnT = rand(0.6, 1.6); }
    }

    for (const e of this.enemies) {
      e.t += dt;
      const weave = Math.sin(e.t * e.weaveF + e.weaveP) * e.weaveA;
      const bob = Math.sin(e.t * e.bobF) * e.bobA;
      e.pos = add(add(add(e.start, scale(e.vel, e.t)), scale(e.side, weave)), scale(e.up, bob));
      const d = len(e.pos);
      // facing: along path derivative (approx)
      e.fwd = add(e.vel, scale(e.side, Math.cos(e.t * e.weaveF + e.weaveP) * e.weaveA * e.weaveF));
      e.bank = -Math.cos(e.t * e.weaveF + e.weaveP) * 0.9;

      e.fireT -= dt;
      const c = cam.toCam(e.pos);
      if (e.fireT <= 0 && c.z > 60 && d > 110 && d < 420) {
        g.shootFireball(e.pos, 85 + g.wave * 6);
        e.fireT = rand(this.fireRate * 0.7, this.fireRate * 1.4);
      }
      if (d < 22 || e.t > 14) e.alive = false; // flew past
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  targets() {
    return this.enemies.map((e) => ({
      pos: e.pos, radius: DART.radius,
      hit: () => {
        e.alive = false;
        this.kills++;
        this.g.addScore(TUNING.points.fighter);
        this.g.explode(e.pos, COLORS.enemy, 22, 50);
        if (this.kills >= this.needed && !this.done) {
          this.done = true; this.doneT = 2.2;
          this.enemies.forEach((o) => { if (o !== e) this.g.explode(o.pos, COLORS.enemy, 14, 40); });
          this.enemies = [];
          this.g.fireballs = [];
          this.g.showBanner('SECTOR CLEAR', this.g.wave >= 2 ? 'DESCENDING TO THE SURFACE' : 'ENTERING THE TRENCH', 2.2);
        }
      },
    }));
  }

  draw(r) {
    this.g.drawStars();
    for (const e of this.enemies) {
      const b = basis(e.fwd, e.bank);
      r.wire(DART.verts.map((p) => toWorld(p, e.pos, b, 1.2)), DART.edges, COLORS.enemy);
    }
  }

  hud(r) {
    const left = Math.max(this.needed - this.kills, 0);
    r.text(`INTERCEPTORS ${left}`, r.cx, r.h - r.unit * 1.2, r.unit * 0.75, COLORS.enemy);
  }
}
