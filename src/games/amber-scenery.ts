import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadAmberLandmark() {
  try {
    const { scene } = await new GLTFLoader().loadAsync('/games/assets/amber/stone-arch.glb');
    scene.traverse(object => {
      if (object instanceof T.Mesh) object.material = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    });
    return scene;
  } catch { return undefined; } // The original procedural arch remains usable.
}

// Amber's original sandstone garden. All objects are opaque and enter the
// existing static vertex-color batches; there are no lights or textures here.
const sage = new T.MeshLambertMaterial({ color: 0x799e86 });
const bark = new T.MeshLambertMaterial({ color: 0x8d625b });
const leaf = new T.SphereGeometry(1, 6, 4);
const stem = new T.CylinderGeometry(.12, .22, 1, 5);
const rockGeometry = new T.DodecahedronGeometry(1, 0);
rockGeometry.setIndex(Array.from({ length: rockGeometry.getAttribute('position').count }, (_, i) => i));

// Horizontal rings preserve the exact authored platform extent and flat top.
// Only the undersides taper. A few large color bands communicate strata
// without repeating texture detail along stretched platforms.
function strata(length: number, depth: number, rings: { y: number; inset: number; color: number }[]) {
  const positions: number[] = [], colors: number[] = [];
  const color = new T.Color();
  const ring = (index: number) => {
    const r = rings[index], x = Math.max(.1, length / 2 - r.inset), z = Math.max(.1, depth / 2 - r.inset);
    const bevel = Math.min(.16, x * .2, z * .2);
    return [[-x + bevel, r.y, -z], [x - bevel, r.y, -z], [x, r.y, -z + bevel], [x, r.y, z - bevel], [x - bevel, r.y, z], [-x + bevel, r.y, z], [-x, r.y, z - bevel], [-x, r.y, -z + bevel]];
  };
  const triangle = (a: number[], b: number[], c: number[], hex: number) => {
    positions.push(...a, ...b, ...c); color.setHex(hex);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const top = ring(0);
  for (let i = 0; i < 8; i++) triangle([0, rings[0].y, 0], top[(i + 1) % 8], top[i], rings[0].color);
  for (let r = 0; r < rings.length - 1; r++) {
    const a = ring(r), b = ring(r + 1);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      triangle(a[i], a[j], b[j], rings[r + 1].color);
      triangle(a[i], b[j], b[i], rings[r + 1].color);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  geometry.computeVertexNormals();
  return geometry;
}
const painted = new T.MeshLambertMaterial({ vertexColors: true });
export function placeSandstone(parent: T.Group, mid: number, top: number, length: number) {
  const geometry = strata(length, 3.4, [
    { y: 0, inset: 0, color: 0xf1d8a2 },
    { y: -.18, inset: 0, color: 0xe1b785 },
    { y: -.32, inset: .05, color: 0xa56958 },
    { y: -.68, inset: .08, color: 0xc58b70 },
    { y: -.78, inset: .1, color: 0xe2b08a },
    { y: -1.45, inset: .32, color: 0xa76c60 },
    { y: -1.95, inset: .65, color: 0x895a59 }
  ]);
  const mesh = new T.Mesh(geometry, painted); mesh.position.set(mid, top, 0); parent.add(mesh);
  // batchStatic clones this one-off geometry; release it after adoption.
  return geometry;
}
function plant(parent: T.Group, x: number, y: number, z: number, size: number) {
  const trunk = new T.Mesh(stem, bark); trunk.position.set(x, y + size * .5, z); trunk.scale.set(size, size, size); parent.add(trunk);
  for (let i = 0; i < 3; i++) {
    const crown = new T.Mesh(leaf, sage);
    crown.position.set(x + (i - 1) * size * .45, y + size * (1.1 + (i === 1 ? .3 : 0)), z + (i % 2) * .18 * size);
    crown.scale.set(size * .65, size * .7, size * .6); parent.add(crown);
  }
}
export function placeAmberPlants(parent: T.Group, a: number, b: number, top: number, hazards: readonly number[]) {
  // Short shrubs stay behind the player and clear every warning/gap edge.
  for (let x = a + 1.4; x < b - 1.4; x += 9) {
    if (hazards.every(h => Math.abs(h - x) > 1.6)) plant(parent, x, top, -1.48, .32);
  }
}
const archShape = new T.Shape();
archShape.moveTo(-4.5, 0); archShape.lineTo(-4.5, 4.2);
for (let i = 0; i <= 10; i++) {
  const angle = Math.PI - i * Math.PI / 10;
  archShape.lineTo(Math.cos(angle) * 4.5, 4.2 + Math.sin(angle) * 3.2);
}
archShape.lineTo(4.5, 0); archShape.lineTo(2.7, 0); archShape.lineTo(2.7, 4.2);
for (let i = 0; i <= 10; i++) {
  const angle = i * Math.PI / 10;
  archShape.lineTo(Math.cos(angle) * 2.7, 4.2 + Math.sin(angle) * 1.7);
}
archShape.lineTo(-2.7, 0); archShape.closePath();
const archGeometry = new T.ExtrudeGeometry(archShape, { depth: 1.8, bevelEnabled: false, steps: 1, curveSegments: 1 });
archGeometry.setIndex(Array.from({ length: archGeometry.getAttribute('position').count }, (_, i) => i));
// Tall distant walls continue below view instead of reading as floating slabs.
// Their broad silhouettes need much less geometry than near mesas.
const farGeometry = strata(16, 8, [
  { y: 0, inset: 2.2, color: 0xffffff },
  { y: -1.4, inset: .2, color: 0xffffff },
  { y: -60, inset: 1, color: 0xffffff }
]);
export function createAmberCanyon(horizon: T.Group, landmark?: T.Object3D) {
  const farMaterials = [0xd5c4d1, 0xcab2ba].map(color => new T.MeshBasicMaterial({ color }));
  for (let row = 0; row < 2; row++) for (let i = -2; i < 8; i++) {
    const mesh = new T.Mesh(farGeometry, farMaterials[row]);
    mesh.position.set(i * 16 + row * 8, (i + 2) % 3 * 1.3, -48 + row * 15);
    mesh.scale.set(1.1, 1, 1.2); horizon.add(mesh);
  }
  const archMaterial = new T.MeshLambertMaterial({ color: 0xc49caa });
  for (const x of [6, 35, 67, 99]) {
    const formation = new T.Group(); formation.position.set(x, -2, -19); formation.rotation.y = -.16;
    const arch = landmark ? landmark.clone(true) : new T.Mesh(archGeometry, archMaterial);
    formation.add(arch);
    // Embed both squared feet in distant rock shoulders. The supports extend
    // below the view and share the arch's existing static opaque batch.
    for (const side of [-1, 1]) {
      const root = new T.Mesh(rockGeometry, archMaterial);
      root.position.set(side * 3.6, -27, .9); root.scale.set(2.2, 30, 2);
      formation.add(root);
    }
    horizon.add(formation);
  }
  const cloudGeometry = new T.SphereGeometry(1, 6, 3), cloudMaterial = new T.MeshBasicMaterial({ color: 0xffeddb });
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
    const cloud = new T.Mesh(cloudGeometry, cloudMaterial);
    cloud.scale.set(2.3, .28 + j * .1, .5);
    cloud.position.set(i * 16 - 22 + j * 1.3, 10 + i % 2 + j * .14, -31); horizon.add(cloud);
  }
}
