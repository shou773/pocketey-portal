import * as T from 'three';
import { stages, type Kind, type State } from './model';
import { loadArt, batchStatic, clearStatic, placeArt, placeGrass, createSky, type Art } from './art';
export function createView(canvas: HTMLCanvasElement, kind: Kind) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new T.Scene();
  const bg = kind === 'orbit' ? 0x152541 : 0xe9b391;
  scene.background = new T.Color(bg); scene.fog = new T.Fog(bg, kind === 'orbit' ? 48 : 30, 105);
  const sky = createSky(kind); scene.add(sky);
  scene.add(new T.HemisphereLight(0xe9f5ff, kind === 'orbit' ? 0x384b70 : 0x91745b, 2.2));
  const light = new T.DirectionalLight(0xffe4c5, 2.1); light.position.set(-8, 15, 5); scene.add(light);
  const camera = new T.PerspectiveCamera(54, 1, .1, 160);
  const level = new T.Group(); scene.add(level);
  const backdrop = new T.Group(); scene.add(backdrop);
  const geo = new T.BoxGeometry(1, 1, 1);
  const spikeGeometry = new T.ConeGeometry(.4, .65, 4);
  const mats = {
    floor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x344b60 : 0xaf7858 }),
    edge: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x93f9da : 0xffdc9f, emissive: kind === 'orbit' ? 0x245d5a : 0x794521, emissiveIntensity: .65 }),
    danger: new T.MeshLambertMaterial({ color: 0xff687e, emissive: 0x7b143b, emissiveIntensity: .4 }),
    body: new T.MeshLambertMaterial({ color: 0xfff4de }),
    face: new T.MeshLambertMaterial({ color: 0x162b42 }),
    decor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x304967 : 0x97725d })
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
  let art: Art = new Map();
  let currentStage = 0;
  let mixer: T.AnimationMixer | undefined;
  const actions = new Map<string, T.AnimationAction>();
  let activeAction: T.AnimationAction | undefined;
  let previousTime = 0, previousX = 0;
  const celestial = new T.Group(); scene.add(celestial);
  const moon = new T.Mesh(kind === 'orbit' ? new T.SphereGeometry(2.2, 16, 10) : new T.CircleGeometry(3.5, 32), new T.MeshBasicMaterial({color: kind === 'orbit' ? 0x4a7692 : 0xffe6ae}));
  celestial.add(moon);
  const ring = new T.Mesh(new T.TorusGeometry(kind === 'orbit' ? 4 : 5, .035, 3, 32), new T.MeshBasicMaterial({color: kind === 'orbit' ? 0x527f90 : 0xc4927c}));
  ring.rotation.x = .4; ring.rotation.y = .3; if (kind === 'orbit') celestial.add(ring);
  if (kind === 'orbit') {
    const bands = new T.Mesh(new T.TorusGeometry(2.18, .11, 3, 24), new T.MeshBasicMaterial({color:0x83b4c2}));
    bands.rotation.x = 1.3; bands.rotation.y = .2; celestial.add(bands);
    const satellite = new T.Mesh(new T.SphereGeometry(.65, 8, 6), new T.MeshBasicMaterial({color:0xe9c18f}));
    satellite.position.set(-9, -2, 2); celestial.add(satellite);
  }
  const horizon = new T.Group(); scene.add(horizon);
  if (kind === 'amber') {
    const hillGeo = new T.CircleGeometry(1, 16);
    const hillMaterials = [0x93a69a, 0xb9a29b].map(color => new T.MeshBasicMaterial({color}));
    for (let row = 0; row < 2; row++) for (let i = -4; i < 9; i++) {
      const hill = new T.Mesh(hillGeo, hillMaterials[row]);
      hill.scale.set(7 + (i + 4) % 3, 3 + (i + 4) % 4, 3);
      hill.position.set(i * 12, -2.2, -21 - row * 16); horizon.add(hill);
    }
    const cloudGeo = new T.CircleGeometry(1, 12), cloudMat = new T.MeshBasicMaterial({color:0xffedcf});
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const cloud = new T.Mesh(cloudGeo, cloudMat); cloud.scale.set(1.8, .42 + j * .09, .5);
      cloud.position.set(i * 12 - 24 + j, 8 + i % 3 + j * .15, -25); horizon.add(cloud);
    }
    batchStatic(horizon, kind);
  }
  const shadow = new T.Mesh(new T.CircleGeometry(.42, 20), new T.MeshBasicMaterial({ color: 0x070f22, transparent: true, opacity: .4 })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  const particles = new T.BufferGeometry(); const points: number[] = [];
  for (let i = 0; i < 220; i++) points.push(Math.sin(i * 82.7) * 80, 4 + ((i * 17) % 35), -100 + ((i * 31) % 170));
  particles.setAttribute('position', new T.Float32BufferAttribute(points, 3)); const stars = new T.Points(particles, new T.PointsMaterial({ color: 0xc1d5e8, size: .085, sizeAttenuation:true })); if (kind === 'orbit') scene.add(stars);
  function load(index: number) {
    currentStage = index;
    previousTime = 0; previousX = 0; courier.rotation.y = 0;
    mixer?.stopAllAction(); activeAction = undefined;
    clearStatic(level); clearStatic(backdrop); backdrop.position.set(0,0,0);
    const data = stages[kind][index];
    for (const p of data.platforms) {
      const mid = (p.a + p.b) / 2, len = p.b - p.a;
      if (kind === 'orbit') {
        box(level, ...coord(mid, p.y - .38, p.z), p.w, .72, len, mats.floor);
        for (let a = p.a; a < p.b; a += 12) {
          const segment = Math.min(12, p.b - a);
          placeArt(level, art, 'platform_small', coord(a + segment / 2, p.y - .24, p.z), [p.w, 2.4, segment]);
        }
        // Structural ribs sit below the runway and never bridge a jump gap.
        for (let x = p.a + 1; x < p.b; x += 5) box(level, ...coord(x, p.y - .9, 0), p.w * .7, .5, .24, mats.decor);
      } else {
        if (!art.has('block-grass-low-long')) box(level, mid, p.y - .36, 0, len, .72, 3.4, mats.floor);
        placeGrass(level,art,mid,p.y,len);
        for (let a = p.a; a < p.b; a += 3) {
          const segment = Math.min(3, p.b - a);
          if (segment > 1 && Math.floor((a - p.a) / 3) % 3 === 1 && !data.hazards.some(h => Math.abs(h.x - a - segment / 2) < 2)) {
            placeArt(level, art, 'flowers', [a + segment / 2, p.y, -1.35], [.65, .65, .65]);
          }
        }
      }
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
    for (let i = 0; i < (kind === 'orbit' ? 10 : 6); i++) {
      if (kind === 'orbit') {
        const name = i % 3 ? 'meteor' : 'rock';
        if (!placeArt(level, art, name, coord(i * 8, -2 - i % 3, i % 2 ? -12 : 12), [2.7, 2.7, 2.7], i * .7))
          box(level, ...coord(i * 8, -4 - i % 3, i % 2 ? -10 : 10), 2, 2, 2, mats.decor);
        if (i % 4 === 0) {
          placeArt(level, art, 'platform_small', coord(i * 8, -1.5, i % 2 ? -16 : 16), [4, 8, 4]);
          box(level, ...coord(i * 8, .5, i % 2 ? -16 : 16), .15, 3.5, .15, mats.edge);
        }
      } else {
        const x = i * 9 - 14, y = -1.4 - i % 3 * .3, z = -7 - i % 3 * 2;
        box(backdrop, x, y - .8, z, 3.7, .9, 3.2, mats.decor);
        placeArt(backdrop, art, 'tree', [x, y - .35, z], [2.2, 2.2 + i % 3 * .25, 2.2], i);
        placeArt(backdrop, art, 'rocks', [x + 1.5, y - .3, z + .4], [1.5, 1.5, 1.5], i * .6);
      }
    }
    batchStatic(level, kind); batchStatic(backdrop, kind);
  }
  void loadArt(kind, canvas).then(loaded => {
    art = loaded;
    const player = art.get(kind === 'orbit' ? 'craft_speederA' : 'character-oodi');
    if (player) {
      courier.clear(); courier.scale.setScalar(1);
      // The rigid ship uses the same lightweight vertex-painted batch as
      // the station. Its slight banking moves the whole mesh, not a rig.
      if(kind==='orbit') batchStatic(player.scene,kind);
      // The ship faces -Z; Oodi faces +Z, rotated toward the side-scrolling +X.
      if (kind === 'orbit') player.scene.scale.set(.4, .48, .4); else player.scene.scale.setScalar(.9);
      player.scene.position.y = kind === 'orbit' ? .12 : 0;
      player.scene.rotation.y = kind === 'orbit' ? 0 : Math.PI / 2;
      courier.add(player.scene);
      if (kind === 'amber') {
        mixer = new T.AnimationMixer(player.scene);
        for (const clip of player.animations) actions.set(clip.name, mixer.clipAction(clip));
      }
    }
    load(currentStage);
    // Signal only after the objects have been adopted; read-only diagnostics.
    canvas.dataset.artAdopted = 'true';
  });
  // ResizeObserver supplies dimensions after layout. Reading clientWidth after HUD
  // mutations forced a synchronous layout on every animation frame.
  let width = canvas.clientWidth, height = canvas.clientHeight, resized = true, pixelRatio = 0;
  const resizeObserver = new ResizeObserver(([entry]) => {
    const { width: w, height: h } = entry.contentRect;
    if (w !== width || h !== height) { width = w; height = h; resized = true; }
  });
  resizeObserver.observe(canvas);
  function draw(s: State) {
    // Wide canvases use a modestly smaller render buffer; DOM text/controls
    // retain native resolution, and narrower canvases keep 450k.
    const maxPixels = width >= 1000 ? (kind === 'amber' ? 280000 : 350000) : 450000;
    const ratio = Math.min(devicePixelRatio, 1.6, Math.sqrt(maxPixels / Math.max(1, width * height)));
    if (resized || ratio !== pixelRatio) { resized = false; pixelRatio = ratio; renderer.setPixelRatio(ratio); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); }
    courier.position.set(...coord(s.x, s.y, s.z));
    const delta = Math.max(0, Math.min(.1, s.time - previousTime));
    const moving = s.x !== previousX;
    if (mixer) {
      const name = s.status === 'dead' ? 'die' : !s.grounded ? (s.vy > 0 ? 'jump' : 'fall') : moving ? 'walk' : 'idle';
      const action = actions.get(name);
      if (action && action !== activeAction) {
        activeAction?.fadeOut(.12); action.reset().fadeIn(.12).play(); activeAction = action; canvas.dataset.artAnimation = name;
      }
      mixer.update(delta);
      if (moving && s.grounded) courier.rotation.y = s.x < previousX ? Math.PI : 0;
    }
    previousTime = s.time; previousX = s.x;
    courier.rotation.z = kind === 'orbit' ? (s.grounded ? Math.sin(s.time * 12) * .025 : -.08) : 0;
    if (kind === 'amber') { horizon.position.x = s.x * .25; backdrop.position.x = s.x * .45; }
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
    if (kind === 'amber') moon.quaternion.copy(camera.quaternion);
    sky.position.copy(camera.position);
    stars.position.z = -s.x;
    renderer.render(scene, camera);
  }
  return { load, draw, renderer };
}
