import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
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
  await Promise.all(artNames[kind].map(async name => {
    try {
      const gltf = await loader.loadAsync(`/games/assets/kenney/${kind === 'orbit' ? 'space' : 'platformer'}/${name}.glb`);
      gltf.scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const convert = (source: T.Material) => {
          if (!materials.has(source)) {
            const m = source as T.MeshStandardMaterial;
            if (kind === 'amber' && !m.map) throw new Error('Required colormap missing');
            const color = name === 'platform_small' ? new T.Color(m.name === 'metalRed' ? 0x426272 : m.name === 'metal' ? 0x708695 : 0x344b60) : m.color;
            materials.set(source, new T.MeshLambertMaterial({ color, map: m.map, vertexColors: m.vertexColors, side: m.side, transparent: m.transparent, opacity: m.opacity }));
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

// Static decoration may contain nested GLTF transforms. Preserve those world
// matrices when instancing; geometry/material are shared across all placements.
export function batchStatic(group: T.Group) {
  group.updateMatrixWorld(true);
  const batches = new Map<string, { mesh: T.Mesh; matrices: T.Matrix4[] }>();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const key = object.geometry.uuid + (Array.isArray(object.material) ? object.material.map(m => m.uuid).join(',') : object.material.uuid);
    const batch = batches.get(key) ?? { mesh: object, matrices: [] as T.Matrix4[] };
    batch.matrices.push(object.matrixWorld.clone()); batches.set(key, batch);
  });
  group.clear();
  for (const {mesh, matrices} of batches.values()) {
    const instances = new T.InstancedMesh(mesh.geometry, mesh.material, matrices.length);
    matrices.forEach((matrix, i) => instances.setMatrixAt(i, matrix));
    instances.computeBoundingSphere(); group.add(instances);
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
