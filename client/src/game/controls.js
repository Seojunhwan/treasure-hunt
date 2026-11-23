// Left half of the screen: floating joystick. Right half: drag to turn the camera.
// Keyboard (WASD/arrows) is a desktop fallback for testing.
const RADIUS = 50; // px the knob can travel

export function createControls(el) {
  const move = { x: 0, y: 0 };
  const look = { dx: 0, dy: 0 };
  const keys = new Set();
  let stickId = null, lookId = null, origin = null, last = null;

  const base = document.createElement('div');
  const knob = document.createElement('div');
  base.className = 'stick'; knob.className = 'knob';
  base.appendChild(knob);
  base.hidden = true;
  document.body.appendChild(base);

  el.addEventListener('pointerdown', (e) => {
    if (e.clientX < innerWidth / 2 && stickId === null) {
      stickId = e.pointerId;
      origin = { x: e.clientX, y: e.clientY };
      base.style.left = origin.x + 'px';
      base.style.top = origin.y + 'px';
      base.hidden = false;
    } else if (lookId === null) {
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
    } else return;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      move.x = dx / RADIUS;
      move.y = -dy / RADIUS; // screen up = forward
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    } else if (e.pointerId === lookId) {
      look.dx += e.clientX - last.x;
      look.dy += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    }
  });

  const end = (e) => {
    if (e.pointerId === stickId) {
      stickId = null; move.x = move.y = 0;
      knob.style.transform = ''; base.hidden = true;
    } else if (e.pointerId === lookId) lookId = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  return {
    // Joystick wins over keyboard; both give x/y in [-1, 1].
    getMove() {
      if (stickId !== null) return move;
      const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
      const x = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
      const y = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len };
    },
    takeLook() {
      const out = { ...look };
      look.dx = look.dy = 0;
      return out;
    },
  };
}
