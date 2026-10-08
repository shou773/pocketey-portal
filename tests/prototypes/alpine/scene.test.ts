import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAlpineScene } from '../../../src/games/prototypes/alpine/scene';
import { BLOCKS, CAR_HALF, ROAD_HALF, GATES, createState, roadX } from '../../../src/games/prototypes/alpine/model';

test('the complete car stays within the original collision footprint at all three headings',()=>{
  const view=createAlpineScene(),state=createState();
  try {
    for(const heading of [-1,0,1] as const) {
      state.heading=heading;view.update(state,390/724);
      const bounds=new THREE.Box3().setFromObject(view.car);
      for(const axis of ['x','z'] as const) {
        assert.ok(bounds.min[axis]>=-CAR_HALF,`${heading}: minimum ${axis}`);
        assert.ok(bounds.max[axis]<=CAR_HALF,`${heading}: maximum ${axis}`);
      }
    }
  } finally {view.dispose();}
});

test('barrier mesh bounds match the existing obstacle rectangles without widening them',()=>{
  const view=createAlpineScene();
  try {
    view.update(createState(),390/724);
    view.barriers.forEach((barrier,i)=>{
      const bounds=new THREE.Box3().setFromObject(barrier),b=BLOCKS[i];
      assert.ok(Math.abs(bounds.min.x-(b.x-b.halfX))<1e-6);
      assert.ok(Math.abs(bounds.max.x-(b.x+b.halfX))<1e-6);
      assert.ok(Math.abs(bounds.min.z-(-b.z-b.halfZ))<1e-6);
      assert.ok(Math.abs(bounds.max.z-(-b.z+b.halfZ))<1e-6);
    });
  } finally {view.dispose();}
});

test('instanced scenery remains outside the road and the whole scene is below 20k triangles',()=>{
  const view=createAlpineScene();
  try {
    view.update(createState(),390/724);
    let triangleCount=0,variants=0;
    view.scene.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      const g=object.geometry,positions=g.getAttribute('position');
      const count=object instanceof THREE.InstancedMesh?object.count:1;
      triangleCount+=(g.index?.count??positions.count)/3*count;
      if(!(object instanceof THREE.InstancedMesh))return;
      variants++;
      for(let i=0;i<object.count;i++) {
        const matrix=new THREE.Matrix4();object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);
        for(let v=0;v<positions.count;v++) {
          const p=new THREE.Vector3().fromBufferAttribute(positions,v).applyMatrix4(matrix);
          assert.ok(Math.abs(p.x-roadX(-p.z))>ROAD_HALF,`${object.name} ${i} overlaps road`);
        }
      }
    });
    assert.equal(variants,6);assert.ok(triangleCount<20000,`${triangleCount} triangles`);
  } finally {view.dispose();}
});

test('fixed camera keeps the car near 70% and each imminent turn line visible in portrait',()=>{
  const view=createAlpineScene(),state=createState();
  try {
    for(const gate of GATES) {
      state.z=gate.z-1;state.x=roadX(state.z);view.update(state,390/724);
      const car=new THREE.Vector3(state.x,.22,-state.z).project(view.camera);
      assert.ok((1-car.y)/2>.65&&(1-car.y)/2<.75);
      const turn=new THREE.Vector3(roadX(gate.z),0,-gate.z).project(view.camera);
      assert.ok(Math.abs(turn.x)<1&&Math.abs(turn.y)<1);
    }
  } finally {view.dispose();}
});
