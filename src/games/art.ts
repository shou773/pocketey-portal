import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kind } from './model';

// Only the selected files are requested. Physics never waits for art: every
// object has a procedural fallback, including failed textures or malformed GLBs.
export const artNames = {
  orbit: ['craft_speederA', 'platform_small', 'meteor', 'rock'],
  amber: ['character-oodi', 'block-grass-low-long', 'tree', 'rocks', 'flowers']
} as const;
export type Art = Map<string, GLTF>;
export async function loadArt(kind: Kind, canvas: HTMLCanvasElement): Promise<Art> {
  canvas.dataset.art = 'loading';
  const loader = new GLTFLoader();
  const art: Art = new Map();
  const materials = new Map<T.Material, T.MeshLambertMaterial>();
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
            const color = name === 'platform_small' ? new T.Color(m.name === 'metalRed' ? 0x426272 : m.name === 'metal' ? 0x708695 : 0x344b60) : m.color;
            materials.set(source, new T.MeshLambertMaterial({ color, map: kind === 'amber' ? null : m.map, vertexColors: kind === 'amber' || m.vertexColors, side: ['character-oodi', 'block-grass-low-long', 'rocks'].includes(name) ? T.FrontSide : m.side, transparent: m.transparent, opacity: m.opacity }));
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
export function batchStatic(group: T.Group) {
  group.updateMatrixWorld(true);
  const merged = new Map<string, {material:T.Material; geometries:T.BufferGeometry[]}>();
  const instances = new Map<string, {mesh:T.Mesh; matrices:T.Matrix4[]}>();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const material = object.material;
    const simple = material instanceof T.MeshLambertMaterial || material instanceof T.MeshBasicMaterial;
    if (simple && !material.map && !material.transparent && (!(material instanceof T.MeshLambertMaterial) || material.emissive.getHex() === 0)) {
      const style = material.type + ':' + material.side + ':' + material.fog;
      if (!batchMaterials.has(style)) batchMaterials.set(style, material instanceof T.MeshLambertMaterial
        ? new T.MeshLambertMaterial({vertexColors:true,side:material.side,fog:material.fog})
        : new T.MeshBasicMaterial({vertexColors:true,side:material.side,fog:material.fog}));
      const key = style, geometry = object.geometry.clone();
      const sourceColors = geometry.getAttribute('color');
      const colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length / 3; i++) {
        colors[i * 3] = material.color.r * (material.vertexColors && sourceColors ? sourceColors.getX(i) : 1);
        colors[i * 3 + 1] = material.color.g * (material.vertexColors && sourceColors ? sourceColors.getY(i) : 1);
        colors[i * 3 + 2] = material.color.b * (material.vertexColors && sourceColors ? sourceColors.getZ(i) : 1);
      }
      for (const name of Object.keys(geometry.attributes)) if (!['position','normal'].includes(name)) geometry.deleteAttribute(name);
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.applyMatrix4(object.matrixWorld);
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

export function createSky(kind: Kind) {
  const sky = new T.Group();
  const geometry = new T.SphereGeometry(120, 24, 16);
  const colors: number[] = [], positions = geometry.attributes.position;
  const top = new T.Color(kind === 'orbit' ? 0x080f29 : 0x405672);
  const horizon = new T.Color(kind === 'orbit' ? 0x22385b : 0xffd9ad);
  const bottom = new T.Color(kind === 'orbit' ? 0x090f22 : 0xd59377);
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
