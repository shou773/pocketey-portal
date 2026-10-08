import * as T from 'three';
import { stages, type Kind, type State } from './model';
import { loadArt, batchStatic, clearStatic, placeArt, createSky, type Art } from './art';
import {paintOrbit, orbitPlanet, orbitEngine, orbitStation, loadOrbitRelay, loadOrbitShutter, placeOrbitShutter} from './orbit-art';
import { createAmberCanyon, loadAmberLandmark, placeAmberPlants, placeSandstone } from './amber-scenery';
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
    floor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x263f53 : 0xaf7858 }),
    edge: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x93f9da : 0xffdc9f, emissive: kind === 'orbit' ? 0x245d5a : 0x794521, emissiveIntensity: .65 }),
    danger: new T.MeshLambertMaterial({ color: kind==='orbit'?0xe76f50:0xff687e, emissive: kind==='orbit'?0:0x7b143b, emissiveIntensity: .4 }),
    body: new T.MeshLambertMaterial({ color: 0xfff4de }),
    face: new T.MeshLambertMaterial({ color: 0x162b42 }),
    decor: new T.MeshLambertMaterial({ color: kind === 'orbit' ? 0x304967 : 0x97725d })
  };
  const orbitWarning=new T.MeshLambertMaterial({color:0xffc980});
  const orbitPanel=new T.MeshLambertMaterial({color:0x693747});
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
  if(kind==='amber')celestial.add(moon);
  const ring = new T.Mesh(new T.TorusGeometry(kind === 'orbit' ? 4 : 5, .035, 3, 32), new T.MeshBasicMaterial({color: kind === 'orbit' ? 0x527f90 : 0xc4927c}));
  ring.rotation.x = .4; ring.rotation.y = .3;
  if (kind === 'orbit') {
    celestial.add(orbitPlanet());
  }
  const horizon = new T.Group(); scene.add(horizon);
  if (kind === 'amber') {
    createAmberCanyon(horizon);
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
    const temporaryGeometry: T.BufferGeometry[] = [];
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
        temporaryGeometry.push(placeSandstone(level, mid, p.y, len));
        placeAmberPlants(level, p.a, p.b, p.y, data.hazards.map(h => h.x));
      }
      box(level, ...coord(p.b - .1, p.y + .025, p.z), kind === 'orbit' ? p.w : .18, .05, kind === 'orbit' ? .18 : 3.4, mats.edge);
      box(level, ...coord(p.a + .1, p.y + .025, p.z), kind === 'orbit' ? p.w : .18, .05, kind === 'orbit' ? .18 : 3.4, mats.edge);
      if (kind === 'orbit') for (const z of [-3.45, 3.45]) box(level, ...coord(mid, p.y + .025, z), .07, .05, len, mats.edge);
      // Small surface dashes communicate depth and forward speed.
      for (let x = p.a + 2; x < p.b - 1; x += 3) box(level, ...coord(x, p.y + .03, 0), kind === 'orbit' ? .07 : .35, .03, kind === 'orbit' ? .4 : .07, mats.edge);
    }
    for (const h of data.hazards) {
      if (kind === 'orbit') {
        if (placeOrbitShutter(level,h.x,h.y,h.z,h.w,h.h,h.d)) continue;
        box(level, ...coord(h.x, h.y + (h.h-.09) / 2, h.z), h.w-.28, h.h-.09, h.d, mats.danger);
        // Warm equipment frames remain inside the existing collision envelope.
        for(const side of [-1,1]) box(level,...coord(h.x,h.y+h.h/2,h.z+side*(h.w/2-.07)),.14,h.h,h.d,orbitWarning);
        box(level,...coord(h.x,h.y+h.h-.045,h.z),h.w,.09,h.d,orbitWarning);
        box(level,...coord(h.x-h.d/2-.006,h.y+h.h*.48,h.z),h.w*.72,h.h*.43,.012,orbitPanel);
        for(const side of [-1,1]) {
          const stripe=box(level,...coord(h.x-h.d/2-.018,h.y+h.h*.48,h.z+side*h.w*.17),.10,h.h*.32,.012,orbitWarning);
          stripe.rotation.z=-.45;
        }
      } else {
        for (let z = -1.2; z <= 1.2; z += .6) { const spike = new T.Mesh(spikeGeometry, mats.danger); spike.position.set(h.x, h.y + h.h / 2, z); level.add(spike); }
      }
    }
    for (const z of [-2.8, 2.8]) box(level, ...coord(data.length + 1, 1.5, z), .15, 3, .15, mats.edge);
    box(level, ...coord(data.length + 1, 3, 0), kind === 'orbit' ? 5.75 : .15, .15, kind === 'orbit' ? .15 : 5.75, mats.edge);
    if(kind==='orbit')for(const [x,z,side] of [[-14,-28,-1],[17,-57,1],[-18,-103,-1]])orbitStation(level,x,z,side,box);
    for (let i = 0; i < (kind === 'orbit' ? 5 : 6); i++) {
      if (kind === 'orbit') {
        const name = i % 3 ? 'meteor' : 'rock';
        if (!placeArt(level, art, name, coord(i * 8, -2 - i % 3, i % 2 ? -12 : 12), [2.7, 2.7, 2.7], i * .7))
          box(level, ...coord(i * 8, -4 - i % 3, i % 2 ? -10 : 10), 2, 2, 2, mats.decor);
      }
    }
    // Amber scenery stays in the distant canyon: near decorative islands
    // can align with jump gaps and falsely suggest a landing surface.
    batchStatic(level, kind); batchStatic(backdrop, kind);
    temporaryGeometry.forEach(geometry => geometry.dispose());
  }
  void Promise.all([loadArt(kind, canvas), kind === 'amber' ? loadAmberLandmark() : Promise.resolve(undefined), kind === 'orbit' ? loadOrbitRelay() : Promise.resolve(false), kind === 'orbit' ? loadOrbitShutter() : Promise.resolve(false)]).then(([loaded, landmark, relayReady, shutterReady]) => {
    if (kind === 'amber' && landmark) {
      clearStatic(horizon); horizon.position.set(0, 0, 0);
      createAmberCanyon(horizon, landmark); batchStatic(horizon, kind);
      canvas.dataset.amberLandmark = 'blender';
    } else if (kind === 'amber') canvas.dataset.amberLandmark = 'procedural';
    art = loaded;
    if(kind==='orbit')canvas.dataset.orbitRelay=relayReady?'ready':'fallback';
    if(kind==='orbit')canvas.dataset.orbitShutter=shutterReady?'ready':'fallback';
    if(kind==='orbit')paintOrbit(art);
    const player = art.get(kind === 'orbit' ? 'craft_speederA' : 'character-oodi');
    if (player) {
      courier.clear(); courier.scale.setScalar(1);
      // The rigid ship uses the same lightweight vertex-painted batch as
      // the station. Its slight banking moves the whole mesh, not a rig.
      // The ship faces -Z; Oodi faces +Z, rotated toward the side-scrolling +X.
      if (kind === 'orbit') player.scene.scale.set(.4, .48, .4); else player.scene.scale.setScalar(.9);
      player.scene.position.y = kind === 'orbit' ? .12 : 0;
      player.scene.rotation.y = kind === 'orbit' ? 0 : Math.PI / 2;
      if(kind==='orbit') {
        // Batch in local space even if asynchronous art arrives after play starts.
        const ship=new T.Group();ship.add(player.scene);orbitEngine(ship);batchStatic(ship,kind);courier.add(ship);
      } else courier.add(player.scene);
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
      celestial.position.set(8, 10.5, -s.x - 76);
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
