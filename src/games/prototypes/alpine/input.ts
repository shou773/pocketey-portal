import type { Direction } from './model';

export function flick(dx: number, dy: number, ms: number): Direction | null {
  return ms >= 0 && ms <= 600 && Math.abs(dx) >= 28 && Math.abs(dx) > Math.abs(dy) * 1.3 ? dx < 0 ? -1 : 1 : null;
}

/** One pointer gesture, cleared by cancellation, pause, settings and retry. */
export function bindFlick(surface: HTMLElement, turn: (direction: Direction) => void) {
  let start: { id: number; x: number; y: number; at: number } | null = null;
  const clear = () => { start = null; };
  const down = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0 || start) return;
    start = { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp };
    surface.setPointerCapture(e.pointerId);
  };
  const up = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    const direction = flick(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.at);
    clear();
    if (direction !== null) turn(direction);
  };
  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', clear);
  surface.addEventListener('lostpointercapture', clear);
  return { clear, dispose() {
    surface.removeEventListener('pointerdown', down); surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', clear); surface.removeEventListener('lostpointercapture', clear);
  } };
}
