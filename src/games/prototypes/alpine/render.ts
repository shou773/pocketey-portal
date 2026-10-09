import * as THREE from 'three';
import { createAlpineScene } from './scene';
import type { State } from './model';

export function createView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const view = createAlpineScene();
  let width = 0, height = 0;
  return {
    renderer,
    draw(state: State) {
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      if (w !== width || h !== height) {
        width = w; height = h;
        renderer.setSize(w, h, false);
      }
      view.update(state, w / h);
      renderer.render(view.scene, view.camera);
    },
    dispose() { view.dispose(); renderer.dispose(); },
  };
}
