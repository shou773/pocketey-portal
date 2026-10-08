import * as THREE from 'three';
import { STAGE, type Cell, type State } from './model';

/** Neutral interaction-study geometry. Reference art is deliberately not applied. */
export function createView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 40);
  // A high, fixed oblique angle keeps adjacent 44px targets separate even at 320px.
  camera.position.set(2, 14, 8); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x718092, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-4, 9, 5); scene.add(light);
  const materials = {
    board: new THREE.MeshStandardMaterial({ color: 0xd3d8de, roughness: 1 }),
    base: new THREE.MeshStandardMaterial({ color: 0x8b9ba8, roughness: 1 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x26313f, roughness: 1 }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    selected: new THREE.MeshBasicMaterial({ color: 0xf5c84b }),
    parcel: new THREE.MeshStandardMaterial({ color: 0xd0ac7c, roughness: 1 }),
    tape: new THREE.MeshStandardMaterial({ color: 0xf5e9d1, roughness: 1 }),
    port: new THREE.MeshStandardMaterial({ color: 0x56697a, roughness: 1 }),
    finish: new THREE.MeshBasicMaterial({ color: 0xb4efce }),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const geometries: THREE.BufferGeometry[] = [cube];
  function box(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(cube, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
  }
  function position(cell: Cell, y: number) { return new THREE.Vector3((cell.x - 1.5) * 1.08, y, (cell.z - 1) * 1.08); }
  box(scene, materials.board, 0, -.17, 0, 4.6, .28, 3.5);
  // A single flat silhouette gives depth without shadow maps or post processing.
  const shadow = new THREE.MeshBasicMaterial({ color: 0x1d2b3b, transparent: true, opacity: .09 });
  box(scene, shadow, .08, -.325, .1, 4.7, .01, 3.6);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-.22, -.065); arrowShape.lineTo(.02, -.065); arrowShape.lineTo(.02, -.17);
  arrowShape.lineTo(.27, 0); arrowShape.lineTo(.02, .17); arrowShape.lineTo(.02, .065); arrowShape.lineTo(-.22, .065); arrowShape.closePath();
  const arrow = new THREE.ShapeGeometry(arrowShape); arrow.rotateX(-Math.PI / 2); geometries.push(arrow);
  const ribbon = new THREE.BufferGeometry();
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = -.5 * (1 - t) ** 2, z = .5 * t * t;
    const dx = 1 - t, dz = t, length = Math.hypot(dx, dz);
    for (const side of [-1, 1]) vertices.push(x - dz / length * .245 * side, .102, z + dx / length * .245 * side);
    if (i < 16) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); ribbon.setIndex(indices); ribbon.computeVertexNormals(); geometries.push(ribbon);
  const tileViews = new Map<string, { group: THREE.Group; ring: THREE.Group }>();
  for (const tile of STAGE.tiles) {
    const group = new THREE.Group(); group.position.copy(position(tile, .05)); scene.add(group);
    box(group, materials.base, 0, 0, 0, .98, .14, .98);
    if (tile.kind === 'straight') box(group, materials.belt, 0, .09, 0, 1.01, .025, .49);
    else group.add(new THREE.Mesh(ribbon, materials.belt));
    const mark = new THREE.Mesh(arrow, materials.white); mark.position.set(tile.kind === 'straight' ? .13 : -.015, .13, tile.kind === 'straight' ? 0 : .19);
    if (tile.kind === 'bend') mark.rotation.y = -Math.PI / 2;
    group.add(mark);
    // A white tail bar makes the inlet distinct from the arrowhead.
    box(group, materials.white, -.41, .126, 0, .045, .018, .26);
    const ring = new THREE.Group(); group.add(ring);
    for (const sign of [-1, 1]) {
      box(ring, materials.selected, sign * .51, -.02, 0, .045, .035, 1.06);
      box(ring, materials.selected, 0, -.02, sign * .51, 1.06, .035, .045);
    }
    tileViews.set(tile.id, { group, ring });
  }
  function station(cell: Cell, isExit: boolean) {
    const group = new THREE.Group(); group.position.copy(position(cell, .05)); scene.add(group);
    box(group, materials.port, 0, .18, 0, .84, .48, .87);
    box(group, materials.belt, isExit ? -.431 : .431, .16, 0, .026, .32, .54);
    box(group, materials.white, 0, .43, 0, .55, .035, .4);
    const mark = new THREE.Mesh(arrow, isExit ? materials.finish : materials.port); mark.scale.setScalar(.8); mark.position.y = .46; group.add(mark);
    return group;
  }
  station(STAGE.source, false); const exit = station(STAGE.exit, true);
  const parcel = new THREE.Group(); scene.add(parcel);
  box(parcel, materials.parcel, 0, 0, 0, .34, .32, .34);
  box(parcel, materials.tape, 0, .166, 0, .1, .012, .345);
  let width = 1, height = 1;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, rect.width), nextHeight = Math.max(1, rect.height);
    // Setting canvas dimensions clears its pixels, even when the size is unchanged.
    if (width === nextWidth && height === nextHeight) return;
    width = nextWidth; height = nextHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height, halfHeight = Math.max(2.4, 2.94 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function project(cell: Cell, y = .23) {
    const p = position(cell, y).project(camera);
    return { x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 };
  }
  function draw(state: State, boxPosition: Cell) {
    for (const tile of state.tiles) {
      const view = tileViews.get(tile.id)!;
      view.group.rotation.y = -tile.rotation * Math.PI / 2;
      view.ring.visible = state.selected === tile.id;
    }
    parcel.position.copy(position(boxPosition, .43));
    exit.scale.y = state.phase === 'success' ? 1.12 : 1;
    renderer.render(scene, camera);
  }
  function dispose() {
    geometries.forEach(geometry => geometry.dispose()); Object.values(materials).forEach(material => material.dispose()); shadow.dispose(); renderer.dispose();
  }
  resize();
  return { renderer, draw, project, resize, dispose };
}
