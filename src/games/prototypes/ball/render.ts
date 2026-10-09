import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RADIUS, length, track, type State } from './model';

export function createView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x51788a);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  // One static low-resolution backdrop: no scene lights or cloud meshes.
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 256; skyCanvas.height = 512;
  const sky = skyCanvas.getContext('2d')!;
  const skyColor = sky.createLinearGradient(0, 0, 0, 512);
  // Keep a quiet blue band behind the unchanged white HUD, opening into daylight.
  skyColor.addColorStop(0, '#3b5e73'); skyColor.addColorStop(.08, '#3b5e73');
  skyColor.addColorStop(.26, '#8cc4df'); skyColor.addColorStop(.56, '#c7e2e7'); skyColor.addColorStop(1, '#f2ebd9');
  sky.fillStyle = skyColor; sky.fillRect(0, 0, 256, 512);
  // A few large/medium/small wind-shaped layers give each cloud a warm crown
  // and a cool underside. All depth is in this same once-painted texture.
  sky.filter = 'blur(1.8px)';
  for (const [x, y, w, h] of [[8, 113, 90, 30], [238, 208, 96, 38], [0, 345, 92, 28], [257, 392, 51, 17]]) {
    for (const [dx, dy, scale, fill] of [
      [0, 9, 1.08, 'rgba(132, 173, 198, .32)'],
      [0, 0, 1, 'rgba(239, 246, 244, .66)'],
      [-12, -9, .74, 'rgba(255, 250, 231, .68)'],
      [24, -4, .50, 'rgba(255, 251, 237, .52)'],
      [-24, 13, .76, 'rgba(190, 217, 225, .30)'],
    ] as const) {
      sky.save(); sky.translate(x + dx, y + dy); sky.scale(w * scale, h * scale);
      sky.fillStyle = fill; sky.beginPath(); sky.moveTo(-1, .12);
      sky.bezierCurveTo(-.85, -.28, -.6, -.18, -.43, -.35);
      sky.bezierCurveTo(-.22, -.86, .02, -.71, .22, -.34);
      sky.bezierCurveTo(.47, -.48, .61, -.05, 1, .09);
      sky.bezierCurveTo(.68, .4, .31, .52, -.07, .43);
      sky.bezierCurveTo(-.48, .56, -.75, .35, -1, .12);
      sky.fill(); sky.restore();
    }
  }
  sky.filter = 'none';
  sky.fillStyle = 'rgba(126, 162, 181, .20)'; sky.beginPath();
  sky.moveTo(0, 432); sky.lineTo(24, 414); sky.lineTo(47, 426); sky.lineTo(72, 407); sky.lineTo(105, 440); sky.lineTo(0, 449); sky.closePath(); sky.fill();
  sky.beginPath(); sky.moveTo(171, 461); sky.lineTo(206, 432); sky.lineTo(228, 449); sky.lineTo(256, 426); sky.lineTo(256, 468); sky.closePath(); sky.fill();
  // The painted backdrop is already in display sRGB. Sample it directly;
  // avoid per-pixel color conversions and transparent-canvas compositing.
  const skyTexture = new THREE.CanvasTexture(skyCanvas);
  skyTexture.generateMipmaps = false; skyTexture.minFilter = THREE.LinearFilter;
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: { skyMap: { value: skyTexture } }, depthTest: true, depthWrite: false,
    vertexShader: 'varying vec2 skyUv; void main() { skyUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
    fragmentShader: 'uniform sampler2D skyMap; varying vec2 skyUv; void main() { gl_FragColor = texture2D(skyMap, skyUv); }',
  });
  const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
  // Draw the far-depth backdrop after opaque geometry so covered samples fail
  // depth testing before texture sampling; transparent decals still draw last.
  skyMesh.frustumCulled = false; skyMesh.renderOrder = 100; scene.add(skyMesh);
  scene.fog = new THREE.Fog(0xc7e2e7, 36, 95);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
  scene.add(new THREE.HemisphereLight(0xe3f4ff, 0x314859, 2.0));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1); sun.position.set(-6, 14, 8); scene.add(sun);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.46, metalness: 0, side: THREE.DoubleSide });
  const sideMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  const gardenMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const distantMaterial = new THREE.MeshLambertMaterial({ color: 0xa6b6bb });
  const observatoryMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xb57950 });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x629593 });
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 20, 12), new THREE.MeshPhongMaterial({ color: 0x148b8f, specular: 0x99d9d5, shininess: 48 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(RADIUS - 0.004, 0.027, 6, 24), new THREE.MeshPhongMaterial({ color: 0xc6a363, specular: 0xf2dfb4, shininess: 40 }));
  ball.add(band); scene.add(ball);
  // A tiny radial decal gives soft contact without a shadow map or extra light.
  const shadowPixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5), i = (y * 32 + x) * 4;
    shadowPixels[i] = 20; shadowPixels[i + 1] = 53; shadowPixels[i + 2] = 58;
    shadowPixels[i + 3] = Math.round(Math.max(0, 1 - radius) ** 1.5 * 160);
  }
  const shadowMap = new THREE.DataTexture(shadowPixels, 32, 32); shadowMap.needsUpdate = true;
  shadowMap.magFilter = THREE.LinearFilter; shadowMap.minFilter = THREE.LinearFilter;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(RADIUS * 3.1, RADIUS * 3.1), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);
  const brakeControl = canvas.closest('#tilttrail')?.querySelector('[data-tt-input="brake"]');
  const brakeRing = new THREE.Mesh(new THREE.RingGeometry(RADIUS * 1.22, RADIUS * 1.34, 24), new THREE.MeshBasicMaterial({ color: 0xcb762d, transparent: true, opacity: .85, depthWrite: false }));
  brakeRing.rotation.x = -Math.PI / 2; brakeRing.visible = false; scene.add(brakeRing);
  const finishMaterial = new THREE.MeshPhongMaterial({ color: 0x66b9a3, specular: 0xf4dfb3, shininess: 55 });
  let course = new THREE.Group(); scene.add(course);
  let stage = -1, lastZ = 0, lastX = 0;
  let rockGeometry: THREE.BufferGeometry | null = null, courseIslands: THREE.InstancedMesh | null = null;
  let disposed = false, observatoryGeometry: THREE.BufferGeometry | null = null, courseArches: THREE.InstancedMesh | null = null;
  // Give the existing rock triangles distinct paint. Deindexing lets adjacent
  // faces own a color; rendered positions/normals and all six instances stay
  // identical. This is still one shared rock geometry/material/draw.
  function paintRock(geometry: THREE.BufferGeometry) {
    if (geometry.index) { const faces = geometry.toNonIndexed(); geometry.copy(faces); faces.dispose(); }
    const positions = geometry.getAttribute('position'); geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!, colors: number[] = [];
    const lower = new THREE.Color(0x58768d), upper = new THREE.Color(0xa6bcc5);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), face = new THREE.Vector3();
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
      const height = ((a.y + b.y + c.y) / 3 - bounds.min.y) / (bounds.max.y - bounds.min.y);
      face.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const color = lower.clone().lerp(upper, THREE.MathUtils.smoothstep(height, .15, .94));
      color.multiplyScalar(.93 + .18 * Math.max(0, face.y) - .08 * face.x + .035 * face.z);
      for (let vertex = 0; vertex < 3; vertex++) colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }
  // The small original Blender asset enhances background architecture. A
  // procedural arch remains usable if the asset cannot load; play never waits.
  const observatoryReady = new GLTFLoader().loadAsync('/games/tilttrail/models/observatory.glb').then(gltf => {
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
    const geometry = meshes[0]?.geometry.clone();
    meshes.forEach(o => {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose());
    });
    if (!geometry) return;
    if (disposed) { geometry.dispose(); return; }
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), colors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const front = Math.abs(normals.getZ(i)), top = Math.max(0, normals.getY(i));
      const color = new THREE.Color(0x8d9fab).lerp(new THREE.Color(0xded6ba), Math.min(1, front * .78 + top * .45));
      if (positions.getY(i) > 2.3) color.lerp(new THREE.Color(0xf0e5c9), .18);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    observatoryGeometry = geometry;
    if (courseArches) {
      courseArches.geometry.dispose(); courseArches.geometry = observatoryGeometry.clone(); courseArches.material = observatoryMaterial;
      courseArches.boundingBox = null; courseArches.boundingSphere = null;
    }
  }).catch(() => { /* The unchanged procedural silhouette is the asset fallback. */ });
  const rockReady = new GLTFLoader().loadAsync('/games/tilttrail/models/wind-rock.glb').then(gltf => {
    let geometry: THREE.BufferGeometry | null = null;
    gltf.scene.traverse(o => { if (o instanceof THREE.Mesh) {
      if (!geometry) geometry = o.geometry.clone(); o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    } });
    const rock = geometry as THREE.BufferGeometry | null;
    if (!rock) return;
    if (disposed) { rock.dispose(); return; }
    rockGeometry = paintRock(rock);
    if (courseIslands) { courseIslands.geometry.dispose(); courseIslands.geometry = rock.clone(); courseIslands.boundingBox = null; courseIslands.boundingSphere = null; }
    // Until the rounded rock loads, keep the public arch on the coarse crown.
    if (courseArches) {
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < courseArches.count; i++) { courseArches.getMatrixAt(i, matrix); matrix.elements[13] = -4.8; courseArches.setMatrixAt(i, matrix); }
      courseArches.instanceMatrix.needsUpdate = true; courseArches.boundingBox = null; courseArches.boundingSphere = null;
    }
  }).catch(() => {});
  const ready = Promise.all([observatoryReady, rockReady]);
  function ribbon(which: number, offset: number | null, stripWidth: number, material: THREE.Material) {
    const positions: number[] = [], indices: number[] = [];
    const sidePositions: number[] = [], sideIndices: number[] = [];
    const count = Math.ceil(length(which) * 3);
    for (let i = 0; i <= count; i++) {
      const z = i * length(which) / count, road = track(which, z);
      const center = offset === null ? road.x : road.x + offset * road.width / 2;
      const half = offset === null ? road.width / 2 : stripWidth / 2;
      const y = offset === null ? 0 : 0.012;
      positions.push(center - half, y, -z, center + half, y, -z);
      if (i < count) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    if (offset === null) {
      const top = new THREE.Color(0xf0e6d1), joint = new THREE.Color(0xe6dcc8), colors: number[] = [];
      for (let i = 0; i <= count; i++) {
        const z = i * length(which) / count;
        const seam = Math.min(z % 6, 6 - z % 6) < .18;
        const c = seam ? joint : top;
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    if (offset === null) course.add(new THREE.Mesh(geometry, material));
    if(offset===null){
      const wallCount=Math.ceil(length(which));
      for(let i=0;i<=wallCount;i++){const z=i*length(which)/wallCount,road=track(which,z);sidePositions.push(road.x-road.width/2,0,-z,road.x-road.width/2,-.68,-z,road.x+road.width/2,0,-z,road.x+road.width/2,-.68,-z);if(i<wallCount){const k=i*4;sideIndices.push(k,k+4,k+1,k+1,k+4,k+5,k+2,k+3,k+6,k+3,k+7,k+6);}}
      const end=wallCount*4;sideIndices.push(0,1,2,2,1,3,end,end+2,end+1,end+2,end+3,end+1);
      const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));side.setIndex(sideIndices);side.computeVertexNormals();
      const sideColors: number[] = [], upper = new THREE.Color(0xb8b3a2), lower = new THREE.Color(0x657b88);
      for (let i=0;i<=wallCount;i++) for (const c of [upper, lower, upper, lower]) sideColors.push(c.r,c.g,c.b);
      side.setAttribute('color',new THREE.Float32BufferAttribute(sideColors,3));course.add(new THREE.Mesh(side,sideMaterial));
    }
    return geometry;
  }
  function rebuild(which: number) {
    course.traverse(o => { if (o instanceof THREE.Mesh) { if(o instanceof THREE.InstancedMesh)o.dispose(); o.geometry.dispose(); } }); scene.remove(course); course = new THREE.Group(); scene.add(course);
    ribbon(which, null, 0, roadMaterial);
    const leftEdge = ribbon(which, -1, .1, edgeMaterial), rightEdge = ribbon(which, 1, .1, edgeMaterial);
    course.add(new THREE.Mesh(mergeGeometries([leftEdge, rightEdge])!, edgeMaterial)); leftEdge.dispose(); rightEdge.dispose();
    // Dashes mark the center. They are visual guidance, never hidden collision.
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.018, 0.7), stripeMaterial, Math.floor(length(which) / 2));
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < dashes.count; i++) { const z = i * 2 + 1; matrix.makeTranslation(track(which, z).x, 0.012, -z); dashes.setMatrixAt(i, matrix); }
    course.add(dashes);
    const end = length(which), road = track(which, end);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2, 0.11, 6, 24, Math.PI), finishMaterial); arch.position.set(road.x, 0, -end); course.add(arch);
    const line = new THREE.Mesh(new THREE.BoxGeometry(road.width, 0.025, 0.35), finishMaterial); line.position.set(road.x, 0.015, -end); course.add(line);
    // Rounded rock crowns remain 4.85 units below the road and outside its
    // open drop. The public observatory rests on each dome; scenery is never support.
    // The coarse public geometry is retained only as the loading fallback.
    function colored(geometry: THREE.BufferGeometry, color: number) {
      const value = new THREE.Color(color), colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = value.r; colors[i + 1] = value.g; colors[i + 2] = value.b; }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.deleteAttribute('uv'); return geometry.index ? geometry.toNonIndexed() : geometry;
    }
    const parts = [
      colored(new THREE.CylinderGeometry(4.1, 1.435, 4.8, 8).scale(1, 1, 3.5 / 4.1).translate(0, -2.45, 0), 0x648a8d),
      colored(new THREE.CylinderGeometry(4.1, 4.1, .1, 8).scale(1, 1, 3.5 / 4.1), 0x94bba3),
      ...[-1.6, 1.6].map(x => colored(new THREE.IcosahedronGeometry(1, 0).scale(.7, .65, .8).translate(x, .6, 1.2), 0x4c9384)),
    ];
    const fallback = paintRock(mergeGeometries(parts)!);
    const islands = new THREE.InstancedMesh(rockGeometry?.clone() || fallback.clone(), gardenMaterial, 6); fallback.dispose(); courseIslands = islands;
    parts.forEach(part => part.dispose());
    // Reuse one hollow, thick arch rather than drawing separate columns.
    const archShape = new THREE.Shape();
    archShape.moveTo(-1, 0); archShape.lineTo(-1, 1.6);
    for (let i = 0; i <= 8; i++) { const angle = Math.PI - i * Math.PI / 8; archShape.lineTo(Math.cos(angle), 1.6 + Math.sin(angle)); }
    archShape.lineTo(1, 0); archShape.lineTo(.67, 0); archShape.lineTo(.67, 1.6);
    for (let i = 0; i <= 8; i++) { const angle = i * Math.PI / 8; archShape.lineTo(Math.cos(angle) * .67, 1.6 + Math.sin(angle) * .67); }
    archShape.lineTo(-.67, 0); archShape.closePath();
    const arches = new THREE.InstancedMesh(observatoryGeometry?.clone() || new THREE.ExtrudeGeometry(archShape, { depth: .35, steps: 1, bevelEnabled: false, curveSegments: 1 }), observatoryGeometry ? observatoryMaterial : distantMaterial, 3);
    courseArches = arches;
    const temp = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      const z = i * 22 + 8, road = track(which, z), x = road.x + (i % 2 ? 1 : -1) * (13 + i % 3 * 2);
      temp.rotation.set(0, i * .45, 0); temp.position.set(x, -6.15, -z); temp.scale.set(1, 1, 1); temp.updateMatrix(); islands.setMatrixAt(i, temp.matrix);
      if (i % 2 === 1) {
        temp.position.set(x, rockGeometry ? -4.8 : -6.1, -z - .5); temp.rotation.set(0, -.35, 0); temp.scale.set(1.5, 1.5, 1.5); temp.updateMatrix(); arches.setMatrixAt((i - 1) / 2, temp.matrix);
      }
    }
    course.add(islands, arches);
    stage = which; lastZ = 0; lastX = 0; ball.rotation.set(0, 0, 0);
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    // One fixed desktop reduction: keep touch/mobile at the existing budget.
    // UI, geometry and camera remain at their existing dimensions.
    const wideDesktop = bounds.width >= 1000 && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const maxPixels = wideDesktop ? 204000 : 240000;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, Math.sqrt(maxPixels / Math.max(1, bounds.width * bounds.height))));
    renderer.setSize(bounds.width, bounds.height, false); camera.aspect = bounds.width / Math.max(1, bounds.height); camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function draw(s: State) {
    if (stage !== s.stage) rebuild(s.stage);
    if (s.z < lastZ) { ball.rotation.set(0, 0, 0); lastZ = s.z; lastX = s.x; }
    ball.rotation.x -= (s.z - lastZ) / RADIUS; ball.rotation.z -= (s.x - lastX) / RADIUS; lastZ = s.z; lastX = s.x;
    ball.position.set(s.x, s.y, -s.z); shadow.position.set(s.x, 0.025, -s.z); shadow.visible = s.phase !== 'falling' && s.phase !== 'failed';
    brakeRing.position.set(s.x, .035, -s.z); brakeRing.visible = s.phase === 'playing' && brakeControl?.getAttribute('aria-pressed') === 'true';
    const focus = track(s.stage, s.z + 9).x * 0.45 + s.x * 0.55;
    const height = camera.aspect < 0.7 ? 17 : camera.aspect < 1 ? 14 : 10;
    camera.position.set(focus, height, -s.z + 10); camera.lookAt(focus, 0, -s.z - 11);
    renderer.render(scene, camera);
  }
  function dispose() { disposed = true; observer.disconnect(); scene.traverse(o => { if (o instanceof THREE.Mesh) { if(o instanceof THREE.InstancedMesh)o.dispose();o.geometry.dispose(); } }); observatoryGeometry?.dispose(); rockGeometry?.dispose(); skyTexture.dispose(); skyMaterial.dispose(); [roadMaterial, sideMaterial, gardenMaterial, distantMaterial, observatoryMaterial, edgeMaterial, stripeMaterial, finishMaterial].forEach(m => m.dispose()); ball.traverse(o => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); }); (shadow.material as THREE.Material).dispose(); shadowMap.dispose(); (brakeRing.material as THREE.Material).dispose(); renderer.dispose(); }
  return { draw, dispose, renderer, ready };
}
