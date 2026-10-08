// Auxiliary mesh preview only. This does not replace the real browser smoke test.
// Run with: node --import tsx tests/prototypes/alpine/export-scene.mjs
import * as THREE from 'three';
import {writeFileSync} from 'node:fs';
import {createAlpineScene} from '../../../src/games/prototypes/alpine/scene.ts';
import {createState,roadX,GATES} from '../../../src/games/prototypes/alpine/model.ts';
const view=createAlpineScene(),shots=[];
try {
  for(const [name,z] of [['01-start',0],['02-before-turn',9.4],['03-near-finish',47]]) {
    const state=createState();state.phase='playing';state.z=z;state.x=roadX(z);
    state.gate=GATES.filter(g=>g.z<=z).length;state.queued=z===9.4?-1:null;
    view.update(state,390/724);
    const meshes=[];
    view.scene.traverse(object=>{
      if(!object.isMesh)return;
      const g=object.geometry,attrs=g.attributes,material=object.material;
      const indices=g.index?Array.from(g.index.array):Array.from({length:attrs.position.count},(_,i)=>i);
      const matrices=[];
      if(object.isInstancedMesh)for(let i=0;i<object.count;i++){
        const matrix=new THREE.Matrix4();object.getMatrixAt(i,matrix);
        matrices.push(object.matrixWorld.clone().multiply(matrix).toArray());
      } else matrices.push(object.matrixWorld.toArray());
      meshes.push({name:object.name,positions:Array.from(attrs.position.array),
        colors:attrs.color?Array.from(attrs.color.array):null,indices,matrices,
        color:material.color.toArray(),basic:material.isMeshBasicMaterial===true,opacity:material.opacity});
    });
    shots.push({name,state,camera:view.camera.matrixWorld.toArray(),fov:view.camera.fov,meshes});
  }
  writeFileSync('/tmp/alpine-art-scenes.json',JSON.stringify(shots));
  console.log('Exported Three.js geometry and cameras for auxiliary Blender previews; no browser or WebGL validation.');
} finally {view.dispose();}
