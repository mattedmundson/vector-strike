// Phase 3: the trench run. Dodge catwalks, shoot turrets, then hit the
// exhaust port at the end. Don't fire at all in the trench for a big bonus.
import { v, rand, clamp, approach } from '../math.js';
import { COLORS } from '../renderer.js';
import { box } from '../models.js';
import { sfx } from '../audio.js';
import { TUNING } from '../config.js';

const HALF = 15, TOP = 38, VIEW = 650, RIB = 40;

export class TrenchPhase {
  constructor(game, opts = {}) {
    this.g = game;
    const w = game.wave;
    this.speed = 150 + w * 15;
    this.portZ = 3000 + w * 250;
    this.catwalks = [];
    this.turrets = [];
    this.shotsFired = 0;
    this.fireRate = Math.max(2.4 - w * 0.2, 0.9);
    this.state = 'run';
    this.title = opts.retry ? 'TRY AGAIN' : 'TRENCH RUN';
    this.subtitle = opts.retry ? 'YOU MISSED THE PORT' : 'DODGE THE CATWALKS · HIT THE EXHAUST PORT';
    const cam = game.cam;
    cam.pos = v(0, 18, 0);
    cam.pitch = -0.06;
    this.camVel = v(0, 0, this.speed);

    // obstacles
    const catwalkChance = Math.min(0.35 + w * 0.12, 0.9);
    for (let z = 450; z < this.portZ - 350; z += rand(160, 280)) {
      if (Math.random() < catwalkChance) {
        const y = rand(6, TOP - 10);
        this.catwalks.push({ z, y0: y, y1: y + 3.5, hitDone: false });
      } else {
        this.turrets.push({ x: (Math.random() < 0.5 ? -1 : 1) * (HALF + 5), z, alive: true, fireT: rand(0.3, 1.2) });
      }
    }
  }

  update(dt) {
    const g = this.g, cam = g.cam, inp = g.input;

    if (this.state === 'won') {
      cam.pos.z += this.speed * 0.4 * dt;
      cam.pos.y += 60 * dt; // pull up and out
      cam.pitch = approach(cam.pitch, 0.5, 1.5, dt);
      if ((this.winT -= dt) <= 0) g.nextWave();
      return;
    }

    cam.pos.x = clamp(cam.pos.x + inp.aimX * 55 * dt, -HALF + 3, HALF - 3);
    cam.pos.y = clamp(cam.pos.y + inp.aimY * 40 * dt, 3, TOP - 3);
    cam.pos.z += this.speed * dt;
    cam.roll = approach(cam.roll, -inp.aimX * 0.25, 4, dt);
    cam.pitch = -0.06;

    for (const c of this.catwalks) {
      if (!c.hitDone && cam.pos.z >= c.z) {
        c.hitDone = true;
        if (cam.pos.y > c.y0 - 2.5 && cam.pos.y < c.y1 + 2.5) g.damage();
      }
    }
    for (const t of this.turrets) {
      if (!t.alive) continue;
      const dz = t.z - cam.pos.z;
      t.fireT -= dt;
      if (t.fireT <= 0 && dz > 90 && dz < 380) {
        g.shootFireball(v(t.x, TOP + 4, t.z), 60 + g.wave * 6);
        t.fireT = rand(this.fireRate * 0.8, this.fireRate * 1.5);
      }
    }

    const dPort = this.portZ - cam.pos.z;
    if (!this.warned && dPort < 600) { this.warned = true; g.showBanner('EXHAUST PORT AHEAD', '', 1.6); }
    if (dPort < -10 && g.state === 'play') {
      g.goto('trench', { retry: true });
    }
  }

  targets() {
    const list = this.turrets.filter((t) => t.alive).map((t) => ({
      pos: v(t.x, TOP + 3, t.z), radius: 4,
      hit: () => {
        t.alive = false;
        this.g.addScore(TUNING.points.turret);
        this.g.explode(v(t.x, TOP + 3, t.z), COLORS.tower, 16, 30);
      },
    }));
    const dPort = this.portZ - this.g.cam.pos.z;
    if (this.state === 'run' && dPort > 8 && dPort < 160) {
      list.push({ pos: v(0, 0, this.portZ), radius: 4, hit: () => this.portHit() });
    }
    return list;
  }

  portHit() {
    const g = this.g;
    this.state = 'won';
    this.winT = 4;
    g.fireballs = [];
    g.whiteFlash = 0.85;
    g.addScore(TUNING.points.port * g.wave);
    let sub = `PORT BONUS ${TUNING.points.port * g.wave}`;
    if (this.shotsFired <= 1) { // the winning shot itself counts as one
      g.addScore(TUNING.points.instinctBonus);
      sub = `PURE INSTINCT BONUS ${TUNING.points.instinctBonus}`;
    }
    g.explode(v(0, 0, this.portZ), COLORS.white, 60, 140, 2);
    sfx.bigBoom(); setTimeout(sfx.bonus, 900);
    g.showBanner('STATION DESTROYED', sub, 3.5);
  }

  draw(r) {
    const cam = this.g.cam;
    this.g.drawStars();
    const z0 = cam.pos.z + 1.5;
    const z1 = Math.min(cam.pos.z + VIEW, this.portZ + 300);
    const C = COLORS.trench;
    // long rails
    for (const s of [-1, 1]) {
      r.line3(v(s * HALF, 0, z0), v(s * HALF, 0, z1), C);
      r.line3(v(s * HALF, TOP, z0), v(s * HALF, TOP, z1), C);
      r.line3(v(s * HALF * 3, TOP, z0), v(s * HALF * 3, TOP, z1), C);
      r.line3(v(s * HALF * 6, TOP, z0), v(s * HALF * 6, TOP, z1), C);
    }
    // ribs
    for (let z = Math.ceil(z0 / RIB) * RIB; z < z1; z += RIB) {
      r.line3(v(-HALF, 0, z), v(HALF, 0, z), C);
      r.line3(v(-HALF, 0, z), v(-HALF, TOP, z), C);
      r.line3(v(HALF, 0, z), v(HALF, TOP, z), C);
      r.line3(v(-HALF * 6, TOP, z), v(-HALF, TOP, z), C);
      r.line3(v(HALF, TOP, z), v(HALF * 6, TOP, z), C);
    }
    // end wall beyond the port
    const endZ = this.portZ + 300;
    if (endZ < cam.pos.z + VIEW) {
      r.line3(v(-HALF, 0, endZ), v(-HALF, TOP, endZ), C); r.line3(v(HALF, 0, endZ), v(HALF, TOP, endZ), C);
      r.line3(v(-HALF, TOP, endZ), v(HALF, TOP, endZ), C);
    }

    for (const c of this.catwalks) {
      if (c.z < z0 - 4 || c.z > z1) continue;
      const b = box(-HALF, HALF, c.y0, c.y1, c.z - 2, c.z + 2);
      r.wire(b.verts, b.edges, COLORS.tower);
    }
    for (const t of this.turrets) {
      if (!t.alive || t.z < z0 || t.z > z1) continue;
      const b = box(t.x - 3, t.x + 3, TOP, TOP + 5, t.z - 3, t.z + 3);
      r.wire(b.verts, b.edges, COLORS.enemy);
      r.line3(v(t.x, TOP + 5, t.z), v(t.x - Math.sign(t.x) * 6, TOP + 7, t.z - 4), COLORS.enemy);
    }

    // exhaust port
    if (this.state === 'run' && this.portZ < z1) {
      const P = this.portZ;
      for (const k of [5, 3, 1.2]) {
        const b = [v(-k, 0.05, P - k), v(k, 0.05, P - k), v(k, 0.05, P + k), v(-k, 0.05, P + k)];
        for (let i = 0; i < 4; i++) r.line3(b[i], b[(i + 1) % 4], COLORS.target);
      }
    }
  }

  hud(r) {
    if (this.state !== 'run') return;
    const d = Math.max(0, Math.round(this.portZ - this.g.cam.pos.z));
    const inRange = d < 160 && d > 8;
    r.text(inRange ? 'PORT IN RANGE — FIRE!' : `EXHAUST PORT ${d}`, r.cx, r.h - r.unit * 1.2, r.unit * 0.85, inRange ? COLORS.target : COLORS.trench);
    if (this.shotsFired === 0) r.text('HOLD FIRE FOR BONUS', r.cx, r.h - r.unit * 2.4, r.unit * 0.55, COLORS.cyan);
  }
}
