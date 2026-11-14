// Unified input. Produces:
//   aimX, aimY  in -1..1  (crosshair position; +y is up)
//   fire        true while the trigger is held
//   anyPress    true for one frame when any button/tap/key starts (menus)
//
// Sources: mouse (absolute), keyboard (arrows/WASD + space), touch
// (drag anywhere = virtual stick, FIRE button bottom-right), and any USB
// gamepad/joystick via the Gamepad API — which is how the home-made
// yoke (Arduino Leonardo / Pro Micro as a HID joystick) plugs in.
import { clamp, approach } from './math.js';

export const CONFIG = {
  gamepadInvertY: false, // pull back on yoke = crosshair up (arcade default)
  gamepadDeadzone: 0.08,
  keySpeed: 2.4,
};

export class Input {
  constructor(canvas, renderer) {
    this.r = renderer;
    this.aimX = 0; this.aimY = 0;
    this.fire = false;
    this.anyPress = false;
    this.mode = 'mouse';
    this.keys = new Set();
    this.mouseDown = false;
    this.mouse = null;
    this.stick = null;     // { id, x0, y0, x, y }
    this.fireTouch = null; // touch id
    this.isTouch = false;
    this._press = false;
    this.padPrevFire = false;

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.code)) this._press = true;
      this.keys.add(e.code);
      this.mode = 'keys';
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; this.mode = 'mouse'; });
    canvas.addEventListener('mousedown', (e) => { this.mouseDown = true; this._press = true; this.mouse = { x: e.clientX, y: e.clientY }; this.mode = 'mouse'; });
    addEventListener('mouseup', () => (this.mouseDown = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const opts = { passive: false };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouch = true; this.mode = 'touch'; this._press = true;
      for (const t of e.changedTouches) {
        if (this.inFireButton(t.clientX, t.clientY) && this.fireTouch === null) this.fireTouch = t.identifier;
        else if (!this.stick) this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
      }
    }, opts);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) { this.stick.x = t.clientX; this.stick.y = t.clientY; }
      }
    }, opts);
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) this.stick = null;
        if (t.identifier === this.fireTouch) this.fireTouch = null;
      }
    };
    canvas.addEventListener('touchend', end, opts);
    canvas.addEventListener('touchcancel', end, opts);
  }

  fireButton() {
    const r = Math.max(42, Math.min(this.r.w, this.r.h) * 0.11);
    return { x: this.r.w - r * 1.5, y: this.r.h - r * 1.5, r };
  }

  inFireButton(x, y) {
    const b = this.fireButton();
    return Math.hypot(x - b.x, y - b.y) < b.r * 1.35;
  }

  /** Crosshair position in screen pixels. */
  screenAim() {
    return { x: this.r.cx + this.aimX * this.r.w * 0.45, y: this.r.cy - this.aimY * this.r.h * 0.42 };
  }

  update(dt) {
    this.anyPress = this._press;
    this._press = false;
    let fire = false;

    // Gamepad / yoke takes over whenever it is moved or pressed.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const dz = CONFIG.gamepadDeadzone;
      const ax = Math.abs(p.axes[0] || 0) > dz ? p.axes[0] : 0;
      const ay = Math.abs(p.axes[1] || 0) > dz ? p.axes[1] : 0;
      const pressed = p.buttons.some((b) => b.pressed);
      if (ax || ay || pressed) this.mode = 'pad';
      if (this.mode === 'pad') {
        this.aimX = clamp(ax, -1, 1);
        this.aimY = clamp(CONFIG.gamepadInvertY ? -ay : ay, -1, 1);
        fire = fire || pressed;
        if (pressed && !this.padPrevFire) this.anyPress = true;
        this.padPrevFire = pressed;
      }
      break;
    }

    if (this.mode === 'mouse' && this.mouse) {
      this.aimX = clamp((this.mouse.x - this.r.cx) / (this.r.w * 0.45), -1, 1);
      this.aimY = clamp(-(this.mouse.y - this.r.cy) / (this.r.h * 0.42), -1, 1);
      fire = this.mouseDown;
    } else if (this.mode === 'keys') {
      const k = this.keys;
      const dx = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
      const dy = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0);
      this.aimX = dx ? clamp(this.aimX + dx * CONFIG.keySpeed * dt, -1, 1) : approach(this.aimX, 0, 3, dt);
      this.aimY = dy ? clamp(this.aimY + dy * CONFIG.keySpeed * dt, -1, 1) : approach(this.aimY, 0, 3, dt);
      fire = k.has('Space') || k.has('KeyJ') || k.has('Enter');
    } else if (this.mode === 'touch') {
      if (this.stick) {
        const range = Math.min(this.r.w, this.r.h) * 0.16;
        this.aimX = clamp((this.stick.x - this.stick.x0) / range, -1, 1);
        this.aimY = clamp(-(this.stick.y - this.stick.y0) / range, -1, 1);
      } else {
        this.aimX = approach(this.aimX, 0, 6, dt);
        this.aimY = approach(this.aimY, 0, 6, dt);
      }
      fire = this.fireTouch !== null;
    }
    this.fire = fire;
  }
}
