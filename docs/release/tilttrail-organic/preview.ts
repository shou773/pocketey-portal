// Isolated evidence viewer only; never imported by the game.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export async function preview(canvas: HTMLCanvasElement, kind: string) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(800, 800, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x51788a);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xc9fff3, 0x142938, 2.3));
  const sun = new THREE.DirectionalLight(0xffecd0, 2.7); sun.position.set(-6, 14, 8); scene.add(sun);
  const loaded = await new GLTFLoader().loadAsync(`/games/tilttrail/models/${kind}.glb`);
  const geometries: THREE.BufferGeometry[] = [];
  loaded.scene.traverse(o => { if (o instanceof THREE.Mesh) geometries.push(o.geometry); });
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(new THREE.Mesh(geometries[0], material));
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 60);
  camera.position.set(10.8, 6.7, 12.2); camera.lookAt(0, -.9, 0);
  renderer.render(scene, camera);
  const result = { image: canvas.toDataURL(), triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls, camera: camera.position.toArray(), lighting: 'same hemisphere/sun and Lambert vertex material as runtime' };
  renderer.dispose(); geometries.forEach(g => g.dispose()); material.dispose();
  return result;
}
