import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Game } from './game.js';

const canvas = document.getElementById('screen');
const renderer = new Renderer(canvas);
const input = new Input(canvas, renderer);
const game = new Game(renderer, input);
window.__game = game; // handy for debugging in the console

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
