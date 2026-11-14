// Tilt steering: the phone becomes the yoke.
//   Turn it like a steering wheel  -> aimX
//   Pull the top towards you       -> aimY up (push away = dive)
//
// Works from DeviceOrientationEvent, converted to a rotation matrix and
// measured *relative to a calibrated "centre" pose*, so it doesn't matter
// how the player is holding the phone or which way the screen is rotated,
// and there's no gimbal flip when the phone is held upright.
//
// Needs a normal https page (or localhost). Sandboxed frames — including
// the Claude artifact viewer — block motion sensors, in which case
// `available` simply never becomes true and touch steering is used.
import { clamp } from './math.js';

export const TILT = {
  steerRange: 18, // degrees of wheel turn for full crosshair deflection (was 28)
  pitchRange: 22, // degrees of pull/push for full deflection
  deadzone: 1.5,  // degrees
  smoothing: 18,  // higher = snappier
  invertPitch: false, // flip if pulling back dives instead of climbs
};

const D2R = Math.PI / 180;

function matrix(a, b, g) {
  // W3C DeviceOrientation spec: R = Rz(alpha) * Rx(beta) * Ry(gamma)
  const cA = Math.cos(a * D2R), sA = Math.sin(a * D2R);
  const cB = Math.cos(b * D2R), sB = Math.sin(b * D2R);
  const cG = Math.cos(g * D2R), sG = Math.sin(g * D2R);
  return [
    [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ];
}

// M = A^T * B  (rotation of B expressed in A's frame)
function relative(A, B) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    M[i][j] = A[0][i] * B[0][j] + A[1][i] * B[1][j] + A[2][i] * B[2][j];
  }
  return M;
}

function screenAngle() {
  const o = screen.orientation;
  if (o && typeof o.angle === 'number') return o.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

export class Tilt {
  constructor() {
    this.available = false; // true once real sensor data has arrived
    this.requested = false;
    this.base = null;
    this.current = null;
    this.rawX = 0; this.rawY = 0;
    this.x = 0; this.y = 0;
    this.onEvent = (e) => {
      if (e.alpha == null && e.beta == null && e.gamma == null) return;
      this.current = matrix(e.alpha || 0, e.beta || 0, e.gamma || 0);
      if (!this.base) this.base = this.current;
      this.available = true;
      this.compute();
    };
  }

  /** Must be called from a user gesture (iOS asks for permission). */
  request() {
    if (this.requested) return;
    this.requested = true;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    const listen = () => addEventListener('deviceorientation', this.onEvent);
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then((r) => { if (r === 'granted') listen(); }).catch(() => {});
    } else {
      listen();
    }
  }

  /** Make the current pose the centre. */
  recentre() {
    this.base = this.current;
    this.rawX = this.rawY = this.x = this.y = 0;
  }

  compute() {
    if (!this.base || !this.current) return;
    const M = relative(this.base, this.current);
    // small-angle rotation vector in the (base) device frame
    const wx = (M[2][1] - M[1][2]) / 2;
    const wy = (M[0][2] - M[2][0]) / 2;
    const wz = (M[1][0] - M[0][1]) / 2;
    // device axes -> screen axes for the current screen rotation
    const t = screenAngle() * D2R;
    const rightX = Math.cos(t), rightY = -Math.sin(t); // screen-right in device coords
    const pitchDeg = Math.asin(clamp(wx * rightX + wy * rightY, -1, 1)) / D2R; // + = top towards you
    const wheelDeg = Math.asin(clamp(wz, -1, 1)) / D2R;                       // + = anticlockwise
    const dz = (d) => (Math.abs(d) < TILT.deadzone ? 0 : d - Math.sign(d) * TILT.deadzone);
    this.rawX = clamp(-dz(wheelDeg) / TILT.steerRange, -1, 1);
    this.rawY = clamp(((TILT.invertPitch ? -1 : 1) * dz(pitchDeg)) / TILT.pitchRange, -1, 1);
  }

  update(dt) {
    const k = Math.min(1, TILT.smoothing * dt);
    this.x += (this.rawX - this.x) * k;
    this.y += (this.rawY - this.y) * k;
  }
}
