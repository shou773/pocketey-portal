import * as THREE from 'three';
import { courseAt, FINISH, ROAD_HALF, WINDOW, roadX, windowOpen, type State } from './model';
import { Parts, triangles, noise, makeCar, treeGeometry, rockGeometry, UP, type Point } from './meshes';

// Original art from the written brief; no reference-image bytes or external assets.
function roadStrip(from: number, to: number, half: number, offset: number, y: number, course: number) {
  const a = roadX(from, course) + offset, b = roadX(to, course) + offset;
  return triangles([[a-half,y,-from], [a+half,y,-from], [b+half,y,-to],
    [a-half,y,-from], [b+half,y,-to], [b-half,y,-to]]);
}
export function createAlpineScene(course = 0) {
  const { gates: GATES, knots: KNOTS, blocks: BLOCKS } = courseAt(course);
  const strip = (from: number, to: number, half: number, offset: number, y: number) => roadStrip(from, to, half, offset, y, course);
  const xAt = (z: number) => roadX(z, course);
  const scene=new THREE.Scene();
  // A tiny procedural sky texture keeps the upper view open without extra meshes.
  const skyPixels=new Uint8Array(128*4),skyTop=new THREE.Color(0xaed7ef);
  for(let y=0;y<128;y++) {
    // The fixed camera's horizon occupies the upper fifth of the viewport.
    const blend=THREE.MathUtils.clamp((y/127-.8)/.2,0,1);
    const color=new THREE.Color(0xf5d8cb).lerp(skyTop,blend).convertLinearToSRGB();
    skyPixels.set([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),255],y*4);
  }
  const sky=new THREE.DataTexture(skyPixels,1,128);
  sky.colorSpace=THREE.SRGBColorSpace;sky.magFilter=THREE.LinearFilter;
  sky.minFilter=THREE.LinearFilter;sky.needsUpdate=true;scene.background=sky;
  scene.fog=new THREE.Fog(0xc2d8df,60,175);
  // Fixed world direction. Perspective makes the small bounded car readable;
  // the camera never turns in response to steering.
  const camera=new THREE.PerspectiveCamera(42,1,.1,230);
  const materials:THREE.Material[]=[];
  const material=(hex:number) => {const m=new THREE.MeshLambertMaterial({color:hex,flatShading:true});materials.push(m);return m;};
  const asphalt=material(0x515b64), stone=material(0xe6d9bb), cliff=material(0x9b9588);
  const grass=material(0x809347), dark=material(0x252c30), ivory=material(0xffedcb);
  const yellow=material(0xffc629), orange=material(0xf57532), wood=material(0x796449);
  const world=new Parts();
  for(let i=1;i<KNOTS.length;i++) {
    const from=KNOTS[i-1].z,to=KNOTS[i].z;
    world.add(strip(from,to,ROAD_HALF,0,0),asphalt);
    for(const side of [-1,1]) world.add(strip(from,to,.065,side*(ROAD_HALF-.035),.014),stone);
  }
  // Faceted rock foundation and green shoulders lie below the unchanged road.
  for(let z=-8;z<58;z+=2) for(const side of [-1,1]) {
    const to=Math.min(58,z+2),a=xAt(z),b=xAt(to),e=side*ROAD_HALF;
    const depth=1.1+.6*noise(z+side*61);
    const points:Point[]=[[a+e,-.02,-z],[b+e,-.02,-to],[b+e,-depth,-to],
      [a+e,-.02,-z],[b+e,-depth,-to],[a+e,-depth,-z]];
    if(side===1) points.reverse();world.add(triangles(points),cliff);
    const near=side*(ROAD_HALF+.02),far=side*7.5;
    const shoulder:Point[]=[[a+near,-.1,-z],[a+far,-1.9,-z],[b+far,-1.9,-to],
      [a+near,-.1,-z],[b+far,-1.9,-to],[b+near,-.1,-to]];
    if(side===-1) shoulder.reverse();world.add(triangles(shoulder),grass);
    const skirt:Point[]=[[a+far,-1.9,-z],[a+side*13,-7,-z],[b+side*13,-7,-to],
      [a+far,-1.9,-z],[b+side*13,-7,-to],[b+far,-1.9,-to]];
    if(side===-1)skirt.reverse();world.add(triangles(skirt),cliff);
  }
  for(let z=-5;z<FINISH;z+=3) world.add(strip(z,z+.8,.028,0,.017),stone);
  const zones=GATES.map(gate=>{
    const m=material(0xf0c987);m.transparent=true;m.opacity=.11;m.depthWrite=false;
    scene.add(new THREE.Mesh(strip(gate.z-WINDOW,gate.z,ROAD_HALF-.14,0,.024),m));
    world.add(strip(gate.z-.07,gate.z+.07,ROAD_HALF-.05,0,.033),yellow);
    const x=xAt(gate.z-2),z=-(gate.z-2),d=gate.direction;
    world.box(ivory,[x,.041,z],[1.28,.018,.14]);
    const points:Point[]=[[x+d*1.1,.053,z],[x+d*.45,.053,z-.43],[x+d*.45,.053,z+.43]];
    if(d===-1)points.reverse();world.add(triangles(points),ivory);return m;
  });
  const barriers:THREE.Group[]=[];
  for(const [index,b] of BLOCKS.entries()) {
    const group=new THREE.Group();group.name=`barrier-${index}`;scene.add(group);barriers.push(group);
    group.position.set(b.x,0,-b.z);const p=new Parts();
    for(const side of [-1,1]) {
      p.box(dark,[side*(b.halfX-.12),.35,0],[.14,.7,.13]);
      p.box(dark,[side*(b.halfX-.12),.055,0],[.24,.11,b.halfZ*2]);
      p.box(dark,[side*.66,.84,0],[.19,.09,.16]);
      p.add(new THREE.CylinderGeometry(.063,.071,.095,8),yellow,[side*.66,.931,0]);
    }
    for(const depth of [-1,1]) for(const [row,y] of [.42,.71].entries()) {
      for(let i=0;i<6;i++) p.box((i+row)%2?ivory:orange,
        [-b.halfX+(i+.5)*b.halfX/3,y,depth*(b.halfZ-.065)],[b.halfX/3,.19,.13]);
    }
    p.finish(group);
  }
  // Finish posts sit outside the playable road and the checker flag is overhead.
  for(const side of [-1,1]) world.box(wood,[side*(ROAD_HALF+.14),1.45,-FINISH],[.16,2.9,.16]);
  for(let x=0;x<16;x++) for(let y=0;y<2;y++) {
    world.box((x+y)%2?dark:ivory,[-ROAD_HALF+(x+.5)*(ROAD_HALF*2/16),2.48+y*.23,-FINISH],
      [ROAD_HALF*2/16,.23,.025]);
  }
  for(let i=0;i<16;i++)world.add(strip(FINISH-.15,FINISH+.15,ROAD_HALF/16,
    -ROAD_HALF+(i+.5)*ROAD_HALF/8,.036),i%2?dark:ivory);
  world.finish(scene);

  const vertexMaterial=new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true});materials.push(vertexMaterial);
  const placements: {x:number;z:number;scale:number;rotation:number}[][]=Array.from({length:6},()=>[]);
  for(let i=0;i<42;i++) {
    const z=-6+i*1.5,side=i%2?1:-1,offset=6+noise(i*11)*1.2;
    const group=i%7===0?3+i%3:i%3;
    placements[group].push({x:xAt(z)+side*offset,z,scale:.75+noise(i*17)*.48,rotation:noise(i*23)*Math.PI*2});
  }
  for(let i=0;i<18;i++) {
    const z=-5+i*3.3,side=i%2?1:-1;
    placements[3+i%3].push({x:xAt(z)+side*(5.1+noise(i)*1.1),z,scale:.45+noise(i*19)*.48,rotation:noise(i*7)*6});
  }
  const matrix=new THREE.Matrix4();
  for(let variant=0;variant<6;variant++) {
    const geometry=variant<3?treeGeometry(variant):rockGeometry(variant-3);
    const instances=new THREE.InstancedMesh(geometry,vertexMaterial,placements[variant].length);
    instances.name=variant<3?`fir-variant-${variant}`:`rock-variant-${variant-3}`;
    placements[variant].forEach((p,i)=>{
      const y=-.1-(Math.abs(p.x-xAt(p.z))-(ROAD_HALF+.02))*1.8/(7.5-ROAD_HALF-.02);
      matrix.compose(new THREE.Vector3(p.x,y,-p.z),new THREE.Quaternion().setFromAxisAngle(UP,p.rotation),new THREE.Vector3(p.scale,p.scale,p.scale));
      instances.setMatrixAt(i,matrix);
    });
    instances.computeBoundingSphere();scene.add(instances);
  }
  const vista=new THREE.Group();vista.name='distant-landscape';scene.add(vista);
  const lake=new THREE.Mesh(new THREE.PlaneGeometry(270,230),material(0x5e8d94));
  lake.rotation.x=-Math.PI/2;lake.position.set(0,-7.5,-60);vista.add(lake);
  const mountainColors=[0xc4d9e7,0x9cbacb,0x789eaf];
  const ridge=[2,0,6,2,8,1,5,0,7,2,6,1,3];
  for(let layer=0;layer<3;layer++) {
    const points:Point[]=[],z=-150+layer*30;
    // Broad, low silhouettes: distant peaks stay pale and below the open sky.
    const height=(i:number)=>1-layer*2+ridge[(i+layer*3)%ridge.length]*.8;
    for(let i=0;i<12;i++) {
      const x=-160+i*(320/12),next=x+320/12;
      points.push([x,-15,z],[x,height(i),z],[next,height(i+1),z],
        [x,-15,z],[next,height(i+1),z],[next,-15,z]);
    }
    const m=new THREE.MeshBasicMaterial({color:mountainColors[layer],side:THREE.DoubleSide,fog:false});
    materials.push(m);vista.add(new THREE.Mesh(triangles(points),m));
  }
  const shadowMaterial=new THREE.MeshBasicMaterial({color:0x172d32,transparent:true,opacity:.17,depthWrite:false});materials.push(shadowMaterial);
  const carShadow=new THREE.Mesh(new THREE.CircleGeometry(1,16),shadowMaterial);
  carShadow.rotation.x=-Math.PI/2;carShadow.scale.set(.32,.45,1);scene.add(carShadow);
  const car=makeCar(material);scene.add(car);
  scene.add(new THREE.HemisphereLight(0xdeefff,0x788576,2));
  const sun=new THREE.DirectionalLight(0xffdfbb,1.85);sun.position.set(18,28,12);scene.add(sun);

  function update(state:State,aspect:number) {
    car.position.set(state.x,0,-state.z);car.rotation.y=-state.heading*Math.PI/4;
    carShadow.position.set(state.x+.02,.018,-state.z+.04);
    camera.aspect=aspect;camera.updateProjectionMatrix();
    camera.position.set(state.x+2,6,-state.z+13);
    camera.lookAt(state.x-20/13,0,-state.z-10);camera.updateMatrixWorld();
    vista.position.set(state.x*.6,0,-state.z);
    zones.forEach((m,i)=>{
      const active=i===state.gate&&windowOpen(state);
      m.color.setHex(active?state.queued===null?0xffcf6a:0x9bd7b4:0xf0c987);
      m.opacity=active?.19:.11;
    });
    scene.updateMatrixWorld(true);
  }
  function dispose() {
    const geometries=new Set<THREE.BufferGeometry>();
    scene.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());sky.dispose();
  }
  return {scene,camera,car,barriers,update,dispose};
}
