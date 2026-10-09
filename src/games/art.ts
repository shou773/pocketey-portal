import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from './model';

// Only the selected files are requested. Physics never waits for art: every
// object has a procedural fallback, including failed textures or malformed GLBs.
export const artNames = {
  orbit: ['meteor', 'rock'],
  amber: ['character-oodi', 'block-grass-low-long', 'tree', 'rocks', 'flowers']
} as const;
export type Art = Map<string, GLTF>;
export async function loadArt(kind: Kind, canvas: HTMLCanvasElement): Promise<Art> {
  canvas.dataset.art = 'loading';
  const loader = new GLTFLoader();
  const art: Art = new Map();
  const materials = new Map<T.Material, T.Material>();
  const baked = new Set<T.BufferGeometry>();
  let palette: ImageData | undefined;
  function bakePalette(mesh: T.Mesh, map: T.Texture) {
    if (baked.has(mesh.geometry)) return;
    const image = map.image as HTMLImageElement | ImageBitmap;
    if (!palette) {
      const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
      const context = surface.getContext('2d', {willReadFrequently:true});
      if (!context) throw new Error('Palette unavailable');
      context.drawImage(image, 0, 0); palette = context.getImageData(0, 0, image.width, image.height);
    }
    // This pack uses a flat color atlas: all triangle UVs lie in solid swatches.
    // Bake the same sRGB samples to linear vertex colors once, including the
    // texture UV transform. Skin/bone attributes and authored positions stay intact.
    const uv = mesh.geometry.getAttribute('uv'), colors = new Float32Array(uv.count * 3);
    map.updateMatrix(); const sample = new T.Vector2(), color = new T.Color();
    for (let i = 0; i < uv.count; i++) {
      sample.set(uv.getX(i), uv.getY(i)); map.transformUv(sample);
      const x = Math.min(palette.width - 1, Math.max(0, Math.floor(sample.x * palette.width)));
      const y = Math.min(palette.height - 1, Math.max(0, Math.floor(sample.y * palette.height)));
      const offset = (y * palette.width + x) * 4;
      color.setRGB(palette.data[offset] / 255, palette.data[offset + 1] / 255, palette.data[offset + 2] / 255, T.SRGBColorSpace);
      color.toArray(colors, i * 3);
    }
    mesh.geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); baked.add(mesh.geometry);
  }
  await Promise.all(artNames[kind].map(async name => {
    try {
      const gltf = await loader.loadAsync(`/games/assets/kenney/${kind === 'orbit' ? 'space' : 'platformer'}/${name}.glb`);
      gltf.scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const sourceMap = (object.material as T.MeshStandardMaterial).map;
        if (kind === 'amber' && sourceMap) bakePalette(object, sourceMap);
        const convert = (source: T.Material) => {
          if (!materials.has(source)) {
            const m = source as T.MeshStandardMaterial;
            if (kind === 'amber' && !m.map) throw new Error('Required colormap missing');
            const color = m.color;
            let result: T.MeshLambertMaterial | T.ShaderMaterial = new T.MeshLambertMaterial({ color, map: kind === 'amber' ? null : m.map, vertexColors: kind === 'amber' || m.vertexColors, side: ['character-oodi', 'block-grass-low-long', 'rocks'].includes(name) ? T.FrontSide : m.side, transparent: m.transparent, opacity: m.opacity });
            // This exported rig binds every vertex to one bone in channel X.
            // Validate that fact before omitting the three zero-weight fetches;
            // a future blended rig keeps Three's normal skinning path.
            const weights = object.geometry.getAttribute('skinWeight');
            if (object instanceof T.SkinnedMesh && weights && Array.from({length:weights.count},(_,i)=>i).every(i=>weights.getX(i)===1&&weights.getY(i)===0&&weights.getZ(i)===0&&weights.getW(i)===0)) {
              const skeleton=object.skeleton, count=skeleton.bones.length;
              // Small rigs fit comfortably within WebGL2's guaranteed vertex
              // uniform budget. Read their matrices directly instead of four
              // texture fetches per vertex. Three updates this shared array
              // before rendering; its normal skinning/bind transforms remain.
              if(count<=32) skeleton.computeBoneTexture();
              const matrices=count<=32?skeleton.boneMatrices?.subarray(0,count*16):undefined;
              result.onBeforeCompile = shader => {
                if(matrices) {
                  shader.uniforms.artBones={value:matrices};
                  shader.vertexShader=shader.vertexShader.replace('#include <skinning_pars_vertex>', `#ifdef USE_SKINNING\nuniform mat4 bindMatrix; uniform mat4 bindMatrixInverse; uniform mat4 artBones[${count}];\nmat4 getBoneMatrix(const in float i) { return artBones[int(i)]; }\n#endif`);
                }
                shader.vertexShader = shader.vertexShader.replace('#include <skinbase_vertex>', '#ifdef USE_SKINNING\nmat4 boneMatX = getBoneMatrix(skinIndex.x);\nmat4 boneMatY = mat4(0.0);\nmat4 boneMatZ = mat4(0.0);\nmat4 boneMatW = mat4(0.0);\n#endif');
              };
              result.customProgramCacheKey = ()=>'single-bone-uniforms-v2-'+count;
              if(kind==='amber' && matrices) {
                result=new T.ShaderMaterial({vertexColors:true,side:T.FrontSide,
                  uniforms:{artBones:{value:matrices},artSky:{value:new T.Color(0xffefd6)},artGround:{value:new T.Color(0x80738b)},artSun:{value:new T.Color(0xffe3b6)},paintFog:{value:new T.Color(0xe9b391)},tint:{value:color}},
                  // Animate the original skinned normals/positions, then use
                  // Gouraud Lambert lighting and vertex fog like the static
                  // batches. The authored rig is flat-faced and single-bone;
                  // no texture fetch or fragment lighting is needed.
                  vertexShader:`#include <common>
                  uniform mat4 bindMatrix; uniform mat4 bindMatrixInverse; uniform mat4 artBones[${count}];
                  uniform vec3 artSky,artGround,artSun,paintFog,tint; varying vec3 litColor;
                  mat4 getBoneMatrix(float i) { return artBones[int(i)]; }
                  vec3 outputColor(vec3 c) { return mix(pow(max(c,vec3(0.0)),vec3(0.41666))*1.055-vec3(0.055), c*12.92,vec3(lessThanEqual(c,vec3(0.0031308)))); }
                  void main() {
                    vec3 objectNormal=normal;
                    mat4 boneMatX=getBoneMatrix(skinIndex.x),boneMatY=mat4(0.0),boneMatZ=mat4(0.0),boneMatW=mat4(0.0);
                    #include <skinnormal_vertex>
                    #include <begin_vertex>
                    #include <skinning_vertex>
                    vec3 n=normalize(mat3(modelMatrix)*objectNormal);
                    float hemi=n.y*.5+.5; float sun=max(0.0,dot(n,normalize(vec3(-8.0,15.0,5.0))));
                    vec3 irradiance=(2.2*mix(artGround,artSky,hemi)+2.1*artSun*sun)/PI;
                    vec4 viewPosition=modelViewMatrix*vec4(transformed,1.0);
                    litColor=outputColor(mix(color.rgb*tint*irradiance,paintFog,smoothstep(30.0,105.0,-viewPosition.z)));
                    gl_Position=projectionMatrix*viewPosition;
                  }`,
                  fragmentShader:'varying vec3 litColor; void main() { gl_FragColor=vec4(litColor,1.0); }'
                });
              }
            }
            materials.set(source, result);
          }
          return materials.get(source)!;
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      });
      // Space Kit includes an authored scene offset (2,0,1.5). Normalize
      // a wrapper, rather than bones/nodes, so animation tracks stay intact.
      gltf.scene.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(gltf.scene), center = bounds.getCenter(new T.Vector3());
      const normalized = new T.Group();
      gltf.scene.position.add(new T.Vector3(-center.x, -bounds.min.y, -center.z));
      normalized.add(gltf.scene); gltf.scene = normalized;
      art.set(name, gltf);
    } catch { /* Keep this object's readable procedural fallback. */ }
  }));
  canvas.dataset.art = art.size === artNames[kind].length ? 'ready' : art.size ? 'partial' : 'fallback';
  canvas.dataset.artLoaded = [...art.keys()].sort().join(',');
  return art;
}

// Opaque, untextured static meshes share one vertex-color draw
// and shading type. Keep emissive warnings separate. This preserves transforms,
// flat normals and palette colors. Emissive warning edges remain instanced.
const batchMaterials = new Map<string, T.Material>();
export function clearStatic(group: T.Group) {
  for (const object of group.children) {
    if (object instanceof T.InstancedMesh) object.dispose();
    else if (object instanceof T.Mesh && object.userData.staticMerged) object.geometry.dispose();
  }
  group.clear();
}
export function batchStatic(group: T.Group, kind: Kind) {
  group.updateMatrixWorld(true);
  const merged = new Map<string, {material:T.Material; geometries:T.BufferGeometry[]}>();
  const instances = new Map<string, {mesh:T.Mesh; matrices:T.Matrix4[]}>();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const material = object.material;
    const simple = material instanceof T.MeshLambertMaterial || material instanceof T.MeshBasicMaterial;
    if (simple && !material.map && !material.transparent && (!(material instanceof T.MeshLambertMaterial) || material.emissive.getHex() === 0)) {
      const style = kind + ':' + material.type + ':' + material.side + ':' + material.fog;
      if (!batchMaterials.has(style)) {
        const twoSided = material.side === T.DoubleSide;
        // Low-poly static surfaces have flat face colors. Compute fog/output
        // transfer at their vertices, then interpolate, instead of repeating
        // smoothstep and sRGB pow for every background/ground pixel. The same
        // world lighting, fog limits and palette are retained; fog gradients
        // use vertex interpolation, so verify them in gameplay captures.
        const painted = new T.ShaderMaterial({vertexColors:true,side:material.side,
          uniforms:{paintFog:{value:new T.Color(kind==='orbit'?0x152541:0xe9b391)}},
          vertexShader:`uniform vec3 paintFog; varying vec3 frontColor; ${twoSided?'attribute vec3 colorBack; varying vec3 backColor;':''}
          vec3 outputColor(vec3 c) { return mix(pow(max(c,vec3(0.0)),vec3(0.41666))*1.055-vec3(0.055), c*12.92,vec3(lessThanEqual(c,vec3(0.0031308)))); }
          void main() { vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
          float fogAmount=${material.fog?`smoothstep(${kind==='orbit'?'48.0':'30.0'},105.0,-viewPosition.z)`:'0.0'};
          frontColor=outputColor(mix(color.rgb,paintFog,fogAmount));
          ${twoSided?'backColor=outputColor(mix(colorBack,paintFog,fogAmount));':''}
          gl_Position=projectionMatrix*viewPosition; }`,
          fragmentShader:`varying vec3 frontColor; ${twoSided?'varying vec3 backColor;':''} void main() { gl_FragColor=vec4(${twoSided?'gl_FrontFacing?frontColor:backColor':'frontColor'},1.0); }`
        });
        batchMaterials.set(style,painted);
      }
      const key = style, geometry = object.geometry.clone();
      const sourceColors = geometry.getAttribute('color');
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length / 3; i++) {
        colors[i * 3] = material.color.r * (material.vertexColors && sourceColors ? sourceColors.getX(i) : 1);
        colors[i * 3 + 1] = material.color.g * (material.vertexColors && sourceColors ? sourceColors.getY(i) : 1);
        colors[i * 3 + 2] = material.color.b * (material.vertexColors && sourceColors ? sourceColors.getZ(i) : 1);
      }
      for (const name of Object.keys(geometry.attributes)) if (!['position','normal'].includes(name)) geometry.deleteAttribute(name);
      geometry.applyMatrix4(object.matrixWorld);
      // r186 Lambert evaluates diffuse lighting per fragment. These meshes
      // never deform and our hemisphere/directional lights are fixed in world
      // space, so compute the same Lambert irradiance once on their normals.
      // The batch shader applies the original fog limits and sRGB output at
      // vertices, retaining inexpensive interpolated flat-face colors.
      const backColors = new Float32Array(colors.length), normals = geometry.getAttribute('normal');
      const sky = new T.Color(kind==='orbit'?0xe9f5ff:0xffefd6), ground = new T.Color(kind==='orbit'?0x384b70:0x80738b), sun = new T.Color(kind==='orbit'?0xffe4c5:0xffe3b6);
      const direction = new T.Vector3(-8,15,5).normalize();
      for (let i=0;i<colors.length/3;i++) {
        const r=colors[i*3],g=colors[i*3+1],b=colors[i*3+2];
        for (const back of [false,true]) {
          const sign=back?-1:1,nx=normals.getX(i)*sign,ny=normals.getY(i)*sign,nz=normals.getZ(i)*sign;
          const weight=ny*.5+.5,dot=Math.max(0,nx*direction.x+ny*direction.y+nz*direction.z), target=back?backColors:colors;
          const lit=material instanceof T.MeshLambertMaterial;
          target[i*3]=r*(lit?(2.2*(ground.r+(sky.r-ground.r)*weight)+2.1*sun.r*dot)/Math.PI:1);
          target[i*3+1]=g*(lit?(2.2*(ground.g+(sky.g-ground.g)*weight)+2.1*sun.g*dot)/Math.PI:1);
          target[i*3+2]=b*(lit?(2.2*(ground.b+(sky.b-ground.b)*weight)+2.1*sun.b*dot)/Math.PI:1);
        }
      }
      geometry.setAttribute('color',new T.BufferAttribute(colors,3));
      if (material.side===T.DoubleSide) geometry.setAttribute('colorBack',new T.BufferAttribute(backColors,3));
      const batch = merged.get(key) ?? {material:batchMaterials.get(style)!,geometries:[] as T.BufferGeometry[]};
      batch.geometries.push(geometry); merged.set(key,batch);
    } else {
      const key = object.geometry.uuid + (Array.isArray(material) ? material.map(m=>m.uuid).join(',') : material.uuid);
      const batch = instances.get(key) ?? {mesh:object,matrices:[] as T.Matrix4[]};
      batch.matrices.push(object.matrixWorld.clone()); instances.set(key,batch);
    }
  });
  group.clear();
  for (const {material,geometries} of merged.values()) {
    const geometry = mergeGeometries(geometries); geometries.forEach(g=>g.dispose());
    if (!geometry) throw new Error('Static geometry could not be merged');
    geometry.computeBoundingSphere(); const mesh = new T.Mesh(geometry,material);mesh.userData.staticMerged=true;group.add(mesh);
  }
  for (const {mesh,matrices} of instances.values()) {
    const batch = new T.InstancedMesh(mesh.geometry,mesh.material,matrices.length);
    matrices.forEach((matrix,i)=>batch.setMatrixAt(i,matrix));batch.computeBoundingSphere();group.add(batch);
  }
}

export function placeArt(parent: T.Group, art: Art, name: string, position: [number, number, number], scale: [number, number, number], rotation = 0) {
  const source = art.get(name); if (!source) return false;
  const object = source.scene.clone(true); object.position.set(...position); object.scale.set(...scale); object.rotation.y = rotation; parent.add(object); return true;
}

export function placeGrass(parent:T.Group, art:Art, mid:number, top:number, length:number) {
  const source=art.get('block-grass-low-long'); if(!source)return;
  const object=source.scene.clone(true);
  let xScale=1;
  // This inspected asset is a single centered mesh with identity node
  // transforms. Stretch its central span while retaining the end bevels;
  // one authored block per collision platform avoids repeated internal caps.
  object.traverse(child=>{
    if(!(child instanceof T.Mesh))return;
    const geometry=child.geometry.clone();geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!,width=bounds.max.x-bounds.min.x,center=(bounds.max.x+bounds.min.x)/2;
    const positions=geometry.getAttribute('position');
    if(length>=width) for(let i=0;i<positions.count;i++) {
        const x=positions.getX(i)-center;
        positions.setX(i,x+Math.sign(x)*(length-width)/2);
      }
    else xScale=length/width;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();child.geometry=geometry;
  });
  object.position.set(mid,top-.75,0);object.scale.set(xScale,1.5,3.4/1.082125);parent.add(object);
}

export function createSky(kind: Kind) {
  const sky = new T.Group();
  const geometry = new T.SphereGeometry(120, 24, 16);
  const colors: number[] = [], positions = geometry.attributes.position;
  const top = new T.Color(kind === 'orbit' ? 0x080f29 : 0xd89d94);
  const horizon = new T.Color(kind === 'orbit' ? 0x22385b : 0xffd9ad);
  const bottom = new T.Color(kind === 'orbit' ? 0x090f22 : 0xe3ad91);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i) / 120;
    const color = y >= 0 ? horizon.clone().lerp(top, Math.min(1, y * (kind === 'orbit' ? 2.4 : 6.5))) : horizon.clone().lerp(bottom, Math.min(1, -y * 3));
    color.convertLinearToSRGB(); colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  sky.add(new T.Mesh(geometry, new T.ShaderMaterial({
    side:T.BackSide, vertexColors:true, depthWrite:false,
    // Colors are converted once on the CPU; sky pixels need no lighting,
    // texture fetches or per-fragment color-space conversion.
    vertexShader:'varying vec3 skyColor; void main() { skyColor = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader:'varying vec3 skyColor; void main() { gl_FragColor = vec4(skyColor, 1.0); }'
  })));
  return sky;
}
