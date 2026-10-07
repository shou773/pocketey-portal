import * as T from 'three';
import { stages, type Kind, type State } from './model';
export function createView(canvas: HTMLCanvasElement, kind: Kind) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new T.Scene();
  const bg = kind === 'orbit' ? 0x10182f : 0x29213c;
  scene.background = new T.Color(bg); scene.fog = new T.Fog(bg, 30, 100);
  scene.add(new T.HemisphereLight(0xe9f5ff, 0x41415f, 2.7));
  const light = new T.DirectionalLight(0xffead2, 3); light.position.set(-8, 15, 5); scene.add(light);
  const camera = new T.PerspectiveCamera(54, 1, .1, 160);
  const level = new T.Group(); scene.add(level);
  const geo = new T.BoxGeometry(1, 1, 1);
  const spikeGeometry = new T.ConeGeometry(.4, .65, 4);
  const mats = {
    floor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x3b778b : 0xb07e68 }),
    edge: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x93f9da : 0xffdc9f, emissive: kind === 'orbit' ? 0x245d5a : 0x794521, emissiveIntensity: .65 }),
    danger: new T.MeshLambertMaterial({ color: 0xff687e, emissive: 0x7b143b, emissiveIntensity: .4 }),
    body: new T.MeshLambertMaterial({ color: 0xfff4de }),
    face: new T.MeshLambertMaterial({ color: 0x162b42 }),
    decor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x304967 : 0x685374 })
  };
  const box = (parent: T.Object3D, x: number, y: number, z: number, w: number, height: number, d: number, material: T.Material) => {
    const mesh = new T.Mesh(geo, material); mesh.position.set(x, y, z); mesh.scale.set(w, height, d); parent.add(mesh); return mesh;
  };
  const coord = (x: number, y: number, z: number): [number, number, number] => kind === 'orbit' ? [z, y, -x] : [x, y, z];
  const courier = new T.Group(); scene.add(courier);
  box(courier, 0, .35, 0, .55, .65, .55, mats.body);
  box(courier, 0, .43, .281, .4, .18, .03, mats.face);
  box(courier, 0, .74, 0, .2, .1, .2, mats.edge);
  if (kind === 'amber') courier.scale.setScalar(1.12);
  const celestial = new T.Group(); scene.add(celestial);
  const moon = new T.Mesh(new T.SphereGeometry(kind === 'orbit' ? 2.2 : 3.5, 24, 16), new T.MeshBasicMaterial({color: kind === 'orbit' ? 0x304962 : 0x896475}));
  celestial.add(moon);
  const ring = new T.Mesh(new T.TorusGeometry(kind === 'orbit' ? 4 : 5, .025, 6, 64), new T.MeshBasicMaterial({color: kind === 'orbit' ? 0x527f90 : 0xc4927c}));
  ring.rotation.x = .4; ring.rotation.y = .3; celestial.add(ring);
  const shadow = new T.Mesh(new T.CircleGeometry(.42, 20), new T.MeshBasicMaterial({ color: 0x070f22, transparent: true, opacity: .4 })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const particles = new T.BufferGeometry(); const points: number[] = [];
  for (let i = 0; i < 220; i++) points.push(Math.sin(i * 82.7) * 80, 4 + ((i * 17) % 35), -100 + ((i * 31) % 170));
  particles.setAttribute('position', new T.Float32BufferAttribute(points, 3)); scene.add(new T.Points(particles, new T.PointsMaterial({ color: 0xa5bfdc, size: .075 })));
  function load(index: number) {
    level.children.forEach(child => { if (child instanceof T.InstancedMesh) child.dispose(); });
    level.clear();
    const data = stages[kind][index];
    for (const p of data.platforms) {
      const mid = (p.a + p.b) / 2, len = p.b - p.a;
      box(level, ...coord(mid, p.y - .36, p.z), kind === 'orbit' ? p.w : len, .72, kind === 'orbit' ? len : 3.4, mats.floor);
      box(level, ...coord(p.b - .1, p.y + .025, p.z), kind === 'orbit' ? p.w : .18, .05, kind === 'orbit' ? .18 : 3.4, mats.edge);
      box(level, ...coord(p.a + .1, p.y + .025, p.z), kind === 'orbit' ? p.w : .18, .05, kind === 'orbit' ? .18 : 3.4, mats.edge);
      if (kind === 'orbit') for (const z of [-3.45, 3.45]) box(level, ...coord(mid, p.y + .025, z), .07, .05, len, mats.edge);
      else { box(level, mid, p.y - 1.3, 0, len * .7, 1.2, 2.1, mats.decor); }
      // Small surface dashes communicate depth and forward speed.
      for (let x = p.a + 2; x < p.b - 1; x += 3) box(level, ...coord(x, p.y + .03, 0), kind === 'orbit' ? .07 : .35, .03, kind === 'orbit' ? .4 : .07, mats.edge);
    }
    for (const h of data.hazards) {
      if (kind === 'orbit') {
        box(level, ...coord(h.x, h.y + h.h / 2, h.z), h.w, h.h, h.d, mats.danger);
        box(level, ...coord(h.x, h.y + h.h + .035, h.z), h.w + .08, .07, h.d + .08, mats.edge);
      } else {
        for (let z = -1.2; z <= 1.2; z += .6) { const spike = new T.Mesh(spikeGeometry, mats.danger); spike.position.set(h.x, h.y + h.h / 2, z); level.add(spike); }
      }
    }
    for (const z of [-2.8, 2.8]) box(level, ...coord(data.length + 1, 1.5, z), .15, 3, .15, mats.edge);
    box(level, ...coord(data.length + 1, 3, 0), kind === 'orbit' ? 5.75 : .15, .15, kind === 'orbit' ? .15 : 5.75, mats.edge);
    for (let i = 0; i < 20; i++) box(level, ...coord(i * 8, -4 - i % 3, i % 2 ? -10 : 10), 2, 2, 2, mats.decor);
    // Batch static geometry: long courses cost a handful of draw calls instead of one per dash.
    const batches = new Map<string, T.Mesh[]>();
    for (const object of level.children) {
      const mesh = object as T.Mesh<T.BufferGeometry, T.Material>;
      const key = mesh.geometry.uuid + mesh.material.uuid;
      const batch = batches.get(key) ?? []; batch.push(mesh); batches.set(key, batch);
    }
    level.clear();
    for (const batch of batches.values()) {
      const instances = new T.InstancedMesh(batch[0].geometry, batch[0].material, batch.length);
      batch.forEach((mesh, index) => { mesh.updateMatrix(); instances.setMatrixAt(index, mesh.matrix); });
      instances.computeBoundingSphere(); level.add(instances);
    }
  }
  // ResizeObserver supplies dimensions after layout. Reading clientWidth after HUD
  // mutations forced a synchronous layout on every animation frame.
  let width = canvas.clientWidth, height = canvas.clientHeight, resized = true, pixelRatio = 0;
  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width: w, height: h } = entry.contentRect;
    if (w !== width || h !== height) { width = w; height = h; resized = true; }
  });
  resizeObserver.observe(canvas);
  function draw(s: State) {
    const ratio = Math.min(devicePixelRatio, 1.6, Math.sqrt(450000 / Math.max(1, width * height)));
    if (resized || ratio !== pixelRatio) { resized = false; pixelRatio = ratio; renderer.setPixelRatio(ratio); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
    courier.position.set(...coord(s.x, s.y, s.z));
    courier.rotation.z = s.grounded ? Math.sin(s.time * 18) * .045 : -.14;
    const under = stages[kind][s.stage].platforms.find(p => s.x >= p.a && s.x <= p.b && Math.abs(s.z - p.z) <= p.w / 2);
    shadow.visible = !!under; shadow.position.set(...coord(s.x, (under?.y ?? 0) + .045, s.z));
    if (kind === 'orbit') {
      celestial.position.set(14, 12, -s.x - 68);
      camera.position.set(s.z * .3, 5.4, -s.x + 9.6); camera.lookAt(s.z * .25, .1, -s.x - 12);
    } else {
      celestial.position.set(s.x + 10, 9, -28);
      const distance = camera.aspect < 1 ? 16 / camera.aspect ** .3 : 12;
      camera.position.set(s.x + 3.2, 5.6, distance); camera.lookAt(s.x + 3.2, 1.3, 0);
    }
    renderer.render(scene, camera);
  }
  return { load, draw, renderer };
}
