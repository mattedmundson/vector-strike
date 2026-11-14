import { v, add, sub, scale, norm, len, rand, basis, toWorld } from './math.js';
import { Camera } from './camera.js';
import { COLORS, NEAR } from './renderer.js';
import { sfx, unlockAudio } from './audio.js';
import { DART } from './models.js';
import { SpacePhase } from './phases/space.js';
import { SurfacePhase } from './phases/surface.js';
import { TrenchPhase } from './phases/trench.js';
import { TUNING } from './config.js';

export { TUNING };

const PHASES = { space: SpacePhase, surface: SurfacePhase, trench: TrenchPhase };

export class Game {
  constructor(renderer, input) {
    this.r = renderer;
    this.input = input;
    this.cam = new Camera();
    this.r.cam = this.cam;
    this.state = 'title';
    this.titleT = 0;
    this.hiScore = 0;
    try { this.hiScore = +localStorage.getItem('vs.hi') || 0; } catch { /* storage blocked */ }
    this.stars = Array.from({ length: 260 }, () => norm(v(rand(-1, 1), rand(-1, 1), rand(-1, 1))));
    this.resetRun();
  }

  resetRun() {
    this.score = 0;
    this.wave = 1;
    this.shields = TUNING.startShields;
    this.fireballs = [];
    this.particles = [];
    this.bolts = [];
    this.fireCD = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.whiteFlash = 0;
    this.banner = null;
    this.phase = null;
  }

  start() {
    unlockAudio();
    this.input.tilt.recentre(); // the way you're holding the phone now = centre
    this.resetRun();
    this.state = 'play';
    this.goto('space');
  }

  goto(name, opts = {}) {
    this.fireballs = [];
    this.cam.pos = v(0, 0, 0);
    this.cam.yaw = 0; this.cam.pitch = 0; this.cam.roll = 0;
    this.cam.update();
    this.phaseName = name;
    this.phase = new PHASES[name](this, opts);
    if (this.phase.title) this.showBanner(this.phase.title, this.phase.subtitle, 2.6);
  }

  nextWave() {
    this.wave++;
    this.shields++;
    this.goto('space');
  }

  showBanner(text, sub = '', t = 2.5) {
    this.banner = { text, sub, t, max: t };
    sfx.alarm();
  }

  addScore(n) { this.score += n; }

  damage() {
    if (this.invuln > 0 || this.state !== 'play') return;
    this.shields--;
    this.invuln = TUNING.invulnTime;
    this.hurtFlash = 0.45;
    sfx.hit();
    if (this.shields <= 0) {
      this.state = 'over';
      this.overT = 0;
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        try { localStorage.setItem('vs.hi', String(this.score)); } catch { /* ignore */ }
      }
    }
  }

  // ---- shared effects ----------------------------------------------------

  explode(pos, color, n = 18, speed = 45, life = 0.9) {
    for (let i = 0; i < n; i++) {
      const dir = norm(v(rand(-1, 1), rand(-1, 1), rand(-1, 1)));
      const l = rand(0.6, 1.2) * life;
      this.particles.push({ pos: { ...pos }, vel: scale(dir, rand(0.3, 1) * speed), life: l, max: l, color, len: rand(2, 6) });
    }
    sfx.boom();
  }

  /** Spawn an enemy fireball at `from`, aimed to intercept the player. */
  shootFireball(from, speed = 90) {
    const camVel = this.phase.camVel || v(0, 0, 0);
    let target = this.cam.pos;
    // simple lead: assume the player keeps moving forward
    const d = len(sub(target, from));
    const t = d / (speed + Math.max(0, camVel.z));
    target = add(target, scale(camVel, t));
    const vel = scale(sub(target, from), 1 / Math.max(t, 0.3));
    this.fireballs.push({ pos: { ...from }, vel, life: 7, spin: rand(0, 6) });
    sfx.fireball();
  }

  /** Everything the crosshair can hit this frame. */
  targets() {
    const list = this.phase ? this.phase.targets() : [];
    for (const fb of this.fireballs) {
      list.push({
        pos: fb.pos, radius: 3,
        hit: () => {
          fb.dead = true;
          this.addScore(TUNING.points.fireball);
          this.explode(fb.pos, COLORS.fire, 8, 25, 0.5);
        },
      });
    }
    return list;
  }

  tryFire() {
    if (this.fireCD > 0) return;
    this.fireCD = TUNING.fireCooldown;
    this.phase.shotsFired = (this.phase.shotsFired || 0) + 1;
    sfx.laser();
    const aim = this.input.screenAim();
    const { w, h } = this.r;
    for (const o of [[0, h], [w, h], [0, h * 0.62], [w, h * 0.62]]) this.bolts.push({ x0: o[0], y0: o[1], x1: aim.x, y1: aim.y, t: 0 });

    let best = null, bestZ = Infinity;
    for (const t of this.targets()) {
      const c = this.cam.toCam(t.pos);
      if (c.z < NEAR + 2) continue;
      const p = this.r.project(c);
      const rad = Math.max(t.radius * p.s, 10) + 8;
      if (Math.hypot(p.x - aim.x, p.y - aim.y) < rad && c.z < bestZ) { best = t; bestZ = c.z; }
    }
    if (best) best.hit();
  }

  // ---- loop ----------------------------------------------------------------

  update(dt) {
    const inp = this.input;
    inp.update(dt);

    if (this.state === 'title') {
      this.titleT += dt;
      if (inp.anyPress && this.titleT > 0.3) this.start();
      return;
    }
    if (this.state === 'over') {
      this.overT += dt;
      if (inp.anyPress && this.overT > 1.5) { this.state = 'title'; this.titleT = 0; }
    }

    this.fireCD -= dt;
    this.invuln -= dt;
    this.hurtFlash -= dt;
    this.whiteFlash -= dt * 1.6;
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;

    if (this.state === 'play' && inp.fire) this.tryFire();

    this.phase.update(dt);
    this.cam.update();

    // fireballs
    for (const fb of this.fireballs) {
      fb.pos = add(fb.pos, scale(fb.vel, dt));
      fb.life -= dt;
      fb.spin += dt * 6;
      const c = this.cam.toCam(fb.pos);
      if (Math.hypot(c.x, c.y, c.z) < TUNING.fireballHitRadius) { fb.dead = true; this.damage(); }
      else if (c.z < -10 || fb.life <= 0) fb.dead = true;
    }
    this.fireballs = this.fireballs.filter((f) => !f.dead);

    for (const p of this.particles) { p.pos = add(p.pos, scale(p.vel, dt)); p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const b of this.bolts) b.t += dt / 0.14;
    this.bolts = this.bolts.filter((b) => b.t < 1.3);
  }

  draw() {
    const r = this.r;
    r.begin(this.state === 'title' ? 0.35 : 0.55);
    if (this.state === 'title') { this.drawTitle(); r.flush(); return; }

    this.phase.draw(r);

    // fireballs: spinning starbursts
    for (const fb of this.fireballs) {
      const c = this.cam.toCam(fb.pos);
      if (c.z < NEAR + 1) continue;
      const p = r.project(c);
      const s = Math.max(2.5 * p.s, 3);
      for (let i = 0; i < 8; i++) {
        const a = fb.spin + (i * Math.PI) / 4;
        const k = i % 2 ? 0.55 : 1;
        r.line(p.x, p.y, p.x + Math.cos(a) * s * k, p.y + Math.sin(a) * s * k, COLORS.fire);
      }
    }

    for (const pt of this.particles) {
      const tail = add(pt.pos, scale(norm(pt.vel), pt.len * (pt.life / pt.max)));
      r.line3(pt.pos, tail, pt.color);
    }

    // laser bolts converge on the crosshair
    for (const b of this.bolts) {
      const t0 = Math.min(b.t, 1), t1 = Math.min(b.t + 0.3, 1);
      if (t0 >= 1) continue;
      r.line(b.x0 + (b.x1 - b.x0) * t0, b.y0 + (b.y1 - b.y0) * t0, b.x0 + (b.x1 - b.x0) * t1, b.y0 + (b.y1 - b.y0) * t1, COLORS.laser);
    }

    if (this.state === 'play') this.drawCrosshair();
    r.flush();

    this.drawHud();
    if (this.hurtFlash > 0) r.flash('#ff2020', this.hurtFlash * 0.6);
    if (this.whiteFlash > 0) r.flash('#ffffff', this.whiteFlash);
  }

  drawCrosshair() {
    const r = this.r, a = this.input.screenAim(), s = r.unit * 1.1, g = s * 0.45, c = COLORS.cross;
    r.line(a.x - s, a.y, a.x - g, a.y, c); r.line(a.x + g, a.y, a.x + s, a.y, c);
    r.line(a.x, a.y - s, a.x, a.y - g, c); r.line(a.x, a.y + g, a.x, a.y + s, c);
    const k = s * 0.7;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      r.line(a.x + dx * k, a.y + dy * k, a.x + dx * k * 0.6, a.y + dy * k, c);
      r.line(a.x + dx * k, a.y + dy * k, a.x + dx * k, a.y + dy * k * 0.6, c);
    }
  }

  drawHud() {
    const r = this.r, u = r.unit, c = COLORS.hud;
    r.text(`SCORE ${this.score}`, u, u * 1.2, u * 0.9, c, 'left');
    r.text(`WAVE ${this.wave}`, r.w - u, u * 1.2, u * 0.9, c, 'right');

    // shield blocks
    const n = Math.max(this.shields, 0), bw = u * 0.9, gap = u * 0.25;
    const total = Math.max(n, TUNING.startShields);
    const x0 = r.cx - (total * (bw + gap)) / 2;
    r.text('SHIELDS', r.cx, u * 1.0, u * 0.6, COLORS.cyan);
    const ctx = r.ctx;
    for (let i = 0; i < total; i++) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = COLORS.cyan; ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + i * (bw + gap), u * 1.6, bw, u * 0.55);
      if (i < n) { ctx.fillStyle = n <= 2 ? '#ff4040' : COLORS.cyan; ctx.globalAlpha = 0.7; ctx.fillRect(x0 + i * (bw + gap) + 2, u * 1.6 + 2, bw - 4, u * 0.55 - 4); ctx.globalAlpha = 1; }
    }

    if (this.phase && this.phase.hud) this.phase.hud(r);

    if (this.banner) {
      const a = Math.min(1, this.banner.t * 2, (this.banner.max - this.banner.t) * 4);
      r.ctx.globalAlpha = Math.max(a, 0);
      r.text(this.banner.text, r.cx, r.cy - u * 3, u * 1.5, c);
      if (this.banner.sub) r.text(this.banner.sub, r.cx, r.cy - u * 1.4, u * 0.75, COLORS.cyan);
      r.ctx.globalAlpha = 1;
    }

    if (this.input.mode === 'touch' && this.state === 'play') {
      const b = this.input.fireButton(), ctx2 = r.ctx;
      ctx2.globalCompositeOperation = 'lighter';
      ctx2.strokeStyle = COLORS.laser; ctx2.lineWidth = 2;
      ctx2.globalAlpha = this.input.fire ? 0.9 : 0.45;
      ctx2.beginPath(); ctx2.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx2.stroke();
      ctx2.globalAlpha = 1;
      r.text('FIRE', b.x, b.y, u * 0.7, COLORS.laser);
    }

    if (this.state === 'over') {
      r.text('GAME OVER', r.cx, r.cy, u * 2.2, '#ff4040');
      r.text(`SCORE ${this.score}   HIGH ${this.hiScore}`, r.cx, r.cy + u * 2, u * 0.9, c);
      if (this.overT > 1.5) r.text('PRESS FIRE', r.cx, r.cy + u * 3.6, u * 0.8, COLORS.cyan);
    }
  }

  drawTitle() {
    const r = this.r, u = r.unit, t = this.titleT;
    this.cam.pos = v(0, 0, 0); this.cam.yaw = t * 0.05; this.cam.pitch = 0; this.cam.roll = 0; this.cam.update();
    this.drawStars();
    const pos = add(this.cam.pos, scale(this.cam.f, 70));
    const b = basis(v(Math.sin(t * 0.7), 0.25 * Math.sin(t * 0.4), Math.cos(t * 0.7)), Math.sin(t) * 0.4);
    r.wire(DART.verts.map((p) => toWorld(p, pos, b, 1.3)), DART.edges, COLORS.enemy);
    r.flush();
    r.text('VECTOR STRIKE', r.cx, r.cy - u * 6.5, u * 2.4, COLORS.hud);
    r.text('DOGFIGHT  ·  SURFACE RUN  ·  TRENCH RUN', r.cx, r.cy - u * 4.6, u * 0.7, COLORS.cyan);
    const tilt = this.input.tilt.available;
    const how = this.input.isTouch
      ? (tilt ? 'TILT TO STEER  ·  HOLD FIRE  ·  QUICK TAP = RE-CENTRE' : 'DRAG TO STEER  ·  HOLD FIRE BUTTON')
      : 'MOUSE OR ARROWS TO STEER  ·  CLICK / SPACE TO FIRE  ·  GAMEPAD OK';
    r.text(how, r.cx, r.cy + u * 5.2, u * 0.6, COLORS.star);
    if (Math.floor(t * 2) % 2 === 0) r.text(this.input.isTouch ? 'TAP TO START' : 'PRESS FIRE TO START', r.cx, r.cy + u * 7, u * 0.95, COLORS.hud);
    if (this.hiScore) r.text(`HIGH SCORE ${this.hiScore}`, r.cx, r.h - u * 1.5, u * 0.6, COLORS.hud);
  }

  drawStars() {
    const r = this.r;
    for (const d of this.stars) {
      const c = this.cam.dirToCam(d);
      if (c.z < 0.05) continue;
      const p = r.project(c);
      if (p.x < 0 || p.y < 0 || p.x > r.w || p.y > r.h) continue;
      r.line(p.x, p.y, p.x + 1, p.y + 0.5, COLORS.star);
    }
  }
}
