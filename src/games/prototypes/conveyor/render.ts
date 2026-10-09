import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE, type Cell, type State, type Stage } from './model';

/** Self-made toy geometry from the approved written specification; no reference-image access. */
export function createView(canvas: HTMLCanvasElement, stage: Stage = STAGE) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 40);
  camera.position.set(-.85, 17, 7); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xfff7df, 0x91b7a6, 1.65));
  const sun = new THREE.DirectionalLight(0xffedd5, 2.2); sun.position.set(-5, 9, -3); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, .55); fill.position.set(4, 3, 6); scene.add(fill);
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .76, metalness: 0 });
  const materials = {
    tile: material(0xf1dfc1), tray: material(0x88a999), trim: material(0x729787), rail: material(0x5f9a8a),
    belt: material(0x3f4545), groove: material(0x454b48), brass: material(0xddbd73),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }), selected: new THREE.MeshBasicMaterial({ color: 0xffc83e, toneMapped: false }),
    inlet: material(0x94cbbb), outlet: material(0xed825e), mouth: new THREE.MeshBasicMaterial({ color: 0x20362f, toneMapped: false }),
    paper: material(0xcc9a5e), tape: material(0xf5dfb3), lamp: material(0xe9f4d7),
    desk: material(0xf5ead5), wall: material(0xd7e7db), pipe: material(0xb3d0bd),
  };
  const owned = new Set<THREE.BufferGeometry>();
  const boxCache = new Map<string, THREE.BufferGeometry>();
  function rounded(w: number, h: number, d: number, r = .05, detail = 1) {
    const key = [w,h,d,r,detail].join(',');
    if (!boxCache.has(key)) { const g = new RoundedBoxGeometry(w,h,d,detail,Math.min(r, w/2, h/2, d/2)); boxCache.set(key,g); owned.add(g); }
    return boxCache.get(key)!;
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, x=0, y=0, z=0) {
    const m = new THREE.Mesh(geometry,mat); m.position.set(x,y,z); parent.add(m); return m;
  }
  function box(parent: THREE.Object3D, mat: THREE.Material, x:number,y:number,z:number,w:number,h:number,d:number,r=.05,detail=1) {
    return mesh(parent,rounded(w,h,d,r,detail),mat,x,y,z);
  }
  function position(cell: Cell, y:number) { return new THREE.Vector3((cell.x-1.5)*1.08,y,(cell.z-1)*1.08); }
  function own<T extends THREE.BufferGeometry>(g:T):T { owned.add(g); return g; }
  // Gentle contact shadows, generated analytically once. No shadow maps or post effects.
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width=64; shadowCanvas.height=64;
  const ctx = shadowCanvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,32,5,32,32,32); gradient.addColorStop(0,'rgba(39,68,50,.25)'); gradient.addColorStop(.55,'rgba(39,68,50,.12)'); gradient.addColorStop(1,'rgba(39,68,50,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial=new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false});
  const plane=own(new THREE.PlaneGeometry(1,1)); plane.rotateX(-Math.PI/2);
  function shadow(parent:THREE.Object3D,x:number,y:number,z:number,w:number,d:number) { const m=mesh(parent,plane,shadowMaterial,x,y,z);m.scale.set(w,1,d);return m; }
  box(scene,materials.desk,0,-.34,0,30,.1,25,.02);
  box(scene,materials.wall,0,.18,-2.35,8,1.1,.18,.12);
  // One broad pipe silhouette on the far wall keeps the workbench uncluttered.
  const pipePath=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.6,.28,-2.2),new THREE.Vector3(-1.7,.28,-2.2),new THREE.Vector3(-1.45,.52,-2.2),new THREE.Vector3(-1.45,1,-2.2)]);
  mesh(scene,own(new THREE.TubeGeometry(pipePath,18,.11,8,false)),materials.pipe);
  shadow(scene,.10,-.278,.12,5.8,4.5);
  box(scene,materials.trim,0,-.15,0,4.53,.25,3.48,.16,2);
  box(scene,materials.tray,0,-.035,0,4.51,.15,3.46,.13,2);
  // Instanced tile tops keep all twelve cream cells separate without twelve draw calls.
  const tileGeometry=rounded(1.015,.12,1.015,.065,1);
  const tileTops=new THREE.InstancedMesh(tileGeometry,materials.tile,stage.width*stage.height);
  const transform=new THREE.Matrix4();
  for(let z=0;z<stage.height;z++)for(let x=0;x<stage.width;x++)tileTops.setMatrixAt(z*stage.width+x,transform.makeTranslation(...position({x,z},.085).toArray()));
  scene.add(tileTops);
  function extrude(shape:THREE.Shape,height:number,bevel=.01) {
    const g=own(new THREE.ExtrudeGeometry(shape,{depth:height-2*bevel,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:4,steps:1}));
    g.rotateX(-Math.PI/2);g.translate(0,bevel,0);return g;
  }
  function arcBand(inner:number,outer:number,height:number,bevel=.008) {
    const shape=new THREE.Shape(),segments=12;
    for(let i=0;i<=segments;i++){const a=-Math.PI/2+i/segments*Math.PI/2,x=-.54+outer*Math.cos(a),z=.54+outer*Math.sin(a);if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z);}
    for(let i=segments;i>=0;i--){const a=-Math.PI/2+i/segments*Math.PI/2;shape.lineTo(-.54+inner*Math.cos(a),-(.54+inner*Math.sin(a)));}shape.closePath();
    return extrude(shape,height,bevel);
  }
  const bendBelt=arcBand(.27,.81,.044,.005),innerRail=arcBand(.17,.27,.16,.012),outerRail=arcBand(.81,.91,.16,.012);
  const arrowShape=new THREE.Shape();arrowShape.moveTo(-.23,-.075);arrowShape.lineTo(.015,-.075);arrowShape.lineTo(.015,-.18);arrowShape.lineTo(.29,0);arrowShape.lineTo(.015,.18);arrowShape.lineTo(.015,.075);arrowShape.lineTo(-.23,.075);arrowShape.closePath();
  const arrow=own(new THREE.ShapeGeometry(arrowShape));arrow.rotateX(-Math.PI/2);
  const grooveGeometry=own(new THREE.BoxGeometry(.018,.006,.47));
  const tailGeometry=own(new THREE.BoxGeometry(.04,.01,.30));
  const capGeometry=rounded(.065,.08,.11,.022);
  // Merge each tile's repeated parts by material; the resulting two blueprints are shared.
  function tileBlueprint(kind:'straight'|'bend') {
    const draft=new THREE.Group();
    if(kind==='straight'){
      box(draft,materials.belt,0,.197,0,1.075,.05,.54,.022);
      for(const z of [-.32,.32]){
        box(draft,materials.rail,0,.223,z,.98,.16,.10,.04,2);
        if(z>0)for(const x of [-.47,.47])mesh(draft,capGeometry,materials.brass,x,.235,z);
      }
      for(const x of [-.40,-.26,-.12,.02,.16,.30,.44])mesh(draft,grooveGeometry,materials.groove,x,.226,0);
      mesh(draft,arrow,materials.white,.025,.234,0);
    }else{
      mesh(draft,bendBelt,materials.belt,0,.176,0);
      mesh(draft,innerRail,materials.rail,0,.145,0);mesh(draft,outerRail,materials.rail,0,.145,0);
      mesh(draft,capGeometry,materials.brass,-.50,.235,-.32);
      const cap=mesh(draft,capGeometry,materials.brass,.32,.235,.50);cap.rotation.y=-Math.PI/2;
      for(let i=1;i<=6;i++){
        const a=-Math.PI/2+i/7*Math.PI/2;
        const groove=mesh(draft,grooveGeometry,materials.groove,-.54+.54*Math.cos(a),.226,.54+.54*Math.sin(a));
        groove.rotation.y=-(a+Math.PI/2);
      }
      const mark=mesh(draft,arrow,materials.white,-.06,.236,.225);mark.rotation.y=-Math.PI/2;mark.scale.setScalar(.88);
    }
    // The tail stays at the actual inlet, west before rotation.
    mesh(draft,tailGeometry,materials.white,-.46,.235,0);
    const parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
    draft.updateMatrixWorld(true);
    for(const child of draft.children){const m=child as THREE.Mesh;const g=m.geometry.clone().applyMatrix4(m.matrixWorld);const list=parts.get(m.material as THREE.Material)??[];list.push(g);parts.set(m.material as THREE.Material,list);}
    const result: {geometry:THREE.BufferGeometry;material:THREE.Material}[]=[];
    for(const [mat,gs] of parts){const geometry=own(mergeGeometries(gs.map(g=>g.index?g.toNonIndexed():g))!);gs.forEach(g=>g.dispose());result.push({geometry,material:mat});}
    return result;
  }
  const blueprints={straight:tileBlueprint('straight'),bend:tileBlueprint('bend')};
  const tileViews=new Map<string,THREE.Group>();
  for(const tile of stage.tiles){
    const group=new THREE.Group();group.position.copy(position(tile,0));scene.add(group);
    shadow(group,0,.147,0,1.10,1.07);
    blueprints[tile.kind].forEach(part=>mesh(group,part.geometry,part.material));tileViews.set(tile.id,group);
  }
  // Raise the single selection frame above the rails; keep ports and path arrows unobscured.
  const selection=new THREE.Group();scene.add(selection);
  for(const sign of [-1,1]){
    box(selection,materials.selected,sign*.507,.335,0,.042,.025,1.055,.012);
    box(selection,materials.selected,0,.335,sign*.507,1.055,.025,.042,.012);
  }
  const shellShape=new THREE.Shape();
  shellShape.moveTo(-.43,.145);shellShape.lineTo(-.43,.58);shellShape.quadraticCurveTo(-.43,.81,-.20,.81);shellShape.lineTo(.20,.81);shellShape.quadraticCurveTo(.43,.81,.43,.58);shellShape.lineTo(.43,.145);
  shellShape.lineTo(.29,.145);shellShape.lineTo(.29,.50);shellShape.quadraticCurveTo(.29,.655,.135,.655);shellShape.lineTo(-.135,.655);shellShape.quadraticCurveTo(-.29,.655,-.29,.50);shellShape.lineTo(-.29,.145);shellShape.closePath();
  function stationShell(depth:number) {
    const geometry=own(new THREE.ExtrudeGeometry(shellShape,{depth,bevelEnabled:true,bevelThickness:.03,bevelSize:.025,bevelSegments:2,curveSegments:5,steps:1}));
    geometry.translate(0,0,-depth/2);geometry.rotateY(Math.PI/2);return geometry;
  }
  const shell=stationShell(.36), shallowShell=stationShell(.16);
  const innerWall=own(new THREE.PlaneGeometry(.54,.415));
  const lampGeometry=own(new THREE.SphereGeometry(.06,10,6));
  function station(cell:Cell,isExit:boolean,direction:number){
    const group=new THREE.Group();group.position.copy(position(cell,0));group.rotation.y=-(direction-(isExit?3:1))*Math.PI/2;scene.add(group);
    const side=isExit?1:-1,paint=isExit?materials.outlet:materials.inlet;
    shadow(group,side*.16,.148,.02,1.1,1.12);
    box(group,paint,0,.184,0,.97,.075,.80,.05,2);
    box(group,materials.belt,-side*.08,.222,0,.80,.026,.53,.018);
    // A north-facing intake points away from the fixed camera. A shallower
    // hood leaves its receiving tray and delivered parcel visible from above.
    const away=direction===0;
    mesh(group,away?shallowShell:shell,paint,side*(away?.31:.24),0,0);
    // The cavity is behind the parcel's endpoint, never a solid block through its path.
    box(group,paint,side*.425,.405,0,.016,.44,.565,.03);
    // Paint the exterior; only the inward-facing surface is dark. The rear
    // must never look like a second usable opening when the station rotates.
    const interior=mesh(group,innerWall,materials.mouth,side*.415,.405,0);
    interior.rotation.y=-side*Math.PI/2;
    box(group,materials.brass,side*.035,.695,0,.055,.055,.27,.017);
    const lamp=mesh(group,lampGeometry,materials.lamp,side*(away?.31:.24),.855,-.10);lamp.scale.set(1,.65,1);
    return lamp;
  }
  station(stage.source,false,stage.source.output);const exitLamp=station(stage.exit,true,stage.exit.input);
  const parcel=new THREE.Group();scene.add(parcel);
  box(parcel,materials.paper,0,0,0,.35,.32,.35,.035,2);
  mesh(parcel,own(new THREE.BoxGeometry(.062,.009,.30)),materials.tape,0,.163,0);
  mesh(parcel,own(new THREE.BoxGeometry(.30,.009,.062)),materials.tape,0,.166,0);
  const sideTape=own(new THREE.BoxGeometry(.062,.265,.006));
  for(const sign of [-1,1])mesh(parcel,sideTape,materials.tape,0,0,sign*.176);
  const crossTape=own(new THREE.BoxGeometry(.006,.265,.062));
  for(const sign of [-1,1])mesh(parcel,crossTape,materials.tape,sign*.176,0,0);
  const parcelShadow=shadow(scene,0,.229,0,.62,.60);
  let width=1,height=1;
  function resize(){
    const rect=canvas.getBoundingClientRect(),nextWidth=Math.max(1,rect.width),nextHeight=Math.max(1,rect.height);
    if(width===nextWidth&&height===nextHeight)return;width=nextWidth;height=nextHeight;renderer.setSize(width,height,false);
    const aspect=width/height,halfHeight=Math.max(2.4,2.78/aspect);
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function project(cell:Cell,y=.24){const p=position(cell,y).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  function draw(state:State,boxPosition:Cell){
    for(const tile of state.tiles)tileViews.get(tile.id)!.rotation.y=-tile.rotation*Math.PI/2;
    const selected=state.tiles.find(tile=>tile.id===state.selected);selection.visible=!!selected;if(selected)selection.position.copy(position(selected,0));
    // Bottom of the parcel is .245; the highest receiving belt is .235.
    parcel.position.copy(position(boxPosition,.405));parcelShadow.position.copy(position(boxPosition,.237));
    exitLamp.material=state.phase==='success'?materials.white:materials.lamp;
    renderer.render(scene,camera);
  }
  function dispose(){owned.forEach(g=>g.dispose());Object.values(materials).forEach(m=>m.dispose());shadowMaterial.dispose();shadowTexture.dispose();renderer.dispose();}
  resize();return{renderer,draw,project,resize,dispose};
}

