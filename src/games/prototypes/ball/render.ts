import * as THREE from 'three';
import { RADIUS, length, track, type State } from './model';

export function createView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x102b3d);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x102b3d, 43, 95);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
  scene.add(new THREE.HemisphereLight(0xc9fff3, 0x142938, 2.3));
  const sun = new THREE.DirectionalLight(0xffecd0, 2.7); sun.position.set(-6, 14, 8); scene.add(sun);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x37697b, roughness: 0.72, metalness: 0.12, side: THREE.DoubleSide });
  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x244354, roughness: 0.88, metalness: 0.15 });
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x314b5b, roughness: 0.95, flatShading: true });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xffb767 });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x83b5bb });
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 24, 16), new THREE.MeshStandardMaterial({ color: 0x88fbd2, roughness: 0.28, metalness: 0.16 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(RADIUS + 0.006, 0.018, 6, 32), new THREE.MeshStandardMaterial({ color: 0x0a6978, roughness: 0.5 }));
  ball.add(band); scene.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(RADIUS * 1.05, 24), new THREE.MeshBasicMaterial({ color: 0x092939, transparent: true, opacity: 0.6, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);
  const finishMaterial = new THREE.MeshStandardMaterial({ color: 0x8ff8cf, emissive: 0x246858, roughness: 0.4 });
  let course = new THREE.Group(); scene.add(course);
  let stage = -1, lastZ = 0, lastX = 0;
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
    course.add(new THREE.Mesh(geometry, material));
    if(offset===null){
      const wallCount=Math.ceil(length(which));
      for(let i=0;i<=wallCount;i++){const z=i*length(which)/wallCount,road=track(which,z);sidePositions.push(road.x-road.width/2,0,-z,road.x-road.width/2,-.42,-z,road.x+road.width/2,0,-z,road.x+road.width/2,-.42,-z);if(i<wallCount){const k=i*4;sideIndices.push(k,k+4,k+1,k+1,k+4,k+5,k+2,k+3,k+6,k+3,k+7,k+6);}}
      const end=wallCount*4;sideIndices.push(0,1,2,2,1,3,end,end+2,end+1,end+2,end+3,end+1);
      const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));side.setIndex(sideIndices);side.computeVertexNormals();course.add(new THREE.Mesh(side,sideMaterial));
    }
  }
  function rebuild(which: number) {
    course.traverse(o => { if (o instanceof THREE.Mesh) { if(o instanceof THREE.InstancedMesh)o.dispose(); o.geometry.dispose(); } }); scene.remove(course); course = new THREE.Group(); scene.add(course);
    ribbon(which, null, 0, roadMaterial); ribbon(which, -1, 0.1, edgeMaterial); ribbon(which, 1, 0.1, edgeMaterial);
    // Dashes mark the center. They are visual guidance, never hidden collision.
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.018, 0.7), stripeMaterial, Math.floor(length(which) / 2));
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < dashes.count; i++) { const z = i * 2 + 1; matrix.makeTranslation(track(which, z).x, 0.012, -z); dashes.setMatrixAt(i, matrix); }
    course.add(dashes);
    const end = length(which), road = track(which, end);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2, 0.11, 8, 40, Math.PI), finishMaterial); arch.position.set(road.x, 0, -end); course.add(arch);
    const line = new THREE.Mesh(new THREE.BoxGeometry(road.width, 0.025, 0.35), finishMaterial); line.position.set(road.x, 0.015, -end); course.add(line);
    // Six layered island clusters sit well outside/below the playable ribbon.
    const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), rockMaterial, 24);
    const temp = new THREE.Object3D();
    for (let i = 0; i < 24; i++) { const group=Math.floor(i/4),part=i%4,z=group*22+8,road=track(which,z);temp.position.set(road.x+(group%2?1:-1)*(11+group%3*2)+(part%2?1:-1)*1.8, -6-part*1.3, -z+(part-1.5)*2);temp.scale.set(3.8-part*.6,2.5+part*.5,3.6-part*.3);temp.rotation.set(i*.3,i*.7,.2);temp.updateMatrix();rocks.setMatrixAt(i,temp.matrix); } course.add(rocks);
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
    const focus = track(s.stage, s.z + 9).x * 0.45 + s.x * 0.55;
    const height = camera.aspect < 0.7 ? 17 : camera.aspect < 1 ? 14 : 10;
    camera.position.set(focus, height, -s.z + 10); camera.lookAt(focus, 0, -s.z - 11);
    renderer.render(scene, camera);
  }
  function dispose() { observer.disconnect(); scene.traverse(o => { if (o instanceof THREE.Mesh) { if(o instanceof THREE.InstancedMesh)o.dispose();o.geometry.dispose(); } }); [roadMaterial, sideMaterial, rockMaterial, edgeMaterial, stripeMaterial, finishMaterial].forEach(m => m.dispose()); ball.traverse(o => { if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose(); }); (shadow.material as THREE.Material).dispose(); renderer.dispose(); }
  return { draw, dispose, renderer };
}
