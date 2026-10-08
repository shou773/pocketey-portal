import * as THREE from 'three';
import { BLOCKS, CAR_HALF, FINISH, GATES, KNOTS, ROAD_HALF, WINDOW, roadX, windowOpen, type State } from './model';

/** Deliberately plain greybox. No purchased assets or reference-image art. */
export function createView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setClearColor(0xbecbd0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-9, 9, 18, -18, 0.1, 140);
  const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [];
  const material = (color: number) => { const m = new THREE.MeshLambertMaterial({ color }); materials.push(m); return m; };
  const asphalt = material(0x536169), edge = material(0xdfe8e8), grass = material(0x98aaa3);
  const yellow = material(0xf2c957), dark = material(0x273b49), red = material(0xd66350), white = material(0xffffff);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1); geometries.push(boxGeometry);
  function box(x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D = scene) {
    const mesh = new THREE.Mesh(boxGeometry, m); mesh.position.set(x, y, -z); mesh.scale.set(w, h, d); parent.add(mesh); return mesh;
  }
  function strip(from: number, to: number, half: number, offset: number, y: number, m: THREE.Material) {
    const a = roadX(from) + offset, b = roadX(to) + offset;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a-half,y,-from, a+half,y,-from, b+half,y,-to,
      a-half,y,-from, b+half,y,-to, b-half,y,-to,
    ], 3)); g.computeVertexNormals(); geometries.push(g); scene.add(new THREE.Mesh(g, m));
  }
  box(-4,-0.65,22,90,1,120,grass);
  for (let i = 1; i < KNOTS.length; i++) {
    const a = KNOTS[i - 1].z, b = KNOTS[i].z;
    strip(a,b,ROAD_HALF,0,0,asphalt);
    strip(a,b,.055,-ROAD_HALF,.012,edge); strip(a,b,.055,ROAD_HALF,.012,edge);
  }
  for (let z = -4; z < FINISH; z += 3) strip(z,z+.9,.04,0,.018,edge);
  const zones = GATES.map(gate => {
    const m = material(0x9d915c);
    strip(gate.z-WINDOW,gate.z,ROAD_HALF-.12,0,.025,m);
    strip(gate.z-.08,gate.z+.08,ROAD_HALF,0,.04,yellow);
    // Arrow lies on the road; its head points left/right in world space.
    const x = roadX(gate.z-2), z = gate.z-2, d = gate.direction;
    box(x,.065,z,1.8,.06,.17,white);
    const g = new THREE.BufferGeometry();
    const points = [x+d*1.65,.10,-z, x+d*.65,.10,-z-.65, x+d*.65,.10,-z+.65];
    if (d === -1) [points[3],points[6],points[5],points[8]] = [points[6],points[3],points[8],points[5]];
    g.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); g.computeVertexNormals(); geometries.push(g);
    scene.add(new THREE.Mesh(g,white)); return m;
  });
  BLOCKS.forEach(b => {
    box(b.x,.5,b.z,b.halfX*2,1,b.halfZ*2,red);
    box(b.x,1.02,b.z,b.halfX*2,.04,.14,white);
  });
  for (let i=0;i<10;i++) box(-ROAD_HALF+(i+.5)*ROAD_HALF/5,.04,FINISH,ROAD_HALF/5,.06,.65,i%2?dark:white);
  box(-ROAD_HALF,.9,FINISH,.14,1.8,.14,yellow); box(ROAD_HALF,.9,FINISH,.14,1.8,.14,yellow);
  const car = new THREE.Group(); scene.add(car);
  // The unrotated square base exactly matches the model's AABB.
  const footprint = box(0,.13,0,CAR_HALF*2,.18,CAR_HALF*2,dark);
  box(0,.35,0,.76,.34,.88,yellow,car); box(0,.61,-.07,.60,.24,.43,dark,car);
  box(-.27,.35,.45,.15,.10,.04,white,car); box(.27,.35,.45,.15,.10,.04,white,car);
  scene.add(new THREE.HemisphereLight(0xffffff,0x6a7b80,2.2));
  const sun = new THREE.DirectionalLight(0xffffff,2.1); sun.position.set(-10,24,8); scene.add(sun);
  let width=0,height=0;
  function draw(s: State) {
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    if(w!==width||h!==height) {
      width=w;height=h;renderer.setSize(w,h,false);
      const halfHeight=18; camera.left=-halfHeight*w/h;camera.right=halfHeight*w/h;
      camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    }
    car.position.set(s.x,0,-s.z); car.rotation.y=-s.heading*Math.PI/4;
    footprint.position.set(s.x,.13,-s.z);
    camera.position.set(s.x+4,20,-s.z+18);camera.lookAt(s.x,0,-s.z-6);
    zones.forEach((m,i)=>m.color.setHex(i===s.gate&&windowOpen(s)?s.queued===null?0xeac365:0x7dcab3:0x9d915c));
    renderer.render(scene,camera);
  }
  return { renderer, draw, dispose() { geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose(); } };
}
