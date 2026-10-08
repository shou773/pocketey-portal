import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {orbitCraft,orbitPlatform,orbitShutter} from '../../src/games/orbit-art';
import {stages} from '../../src/games/model';

const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('Orbit capsule retains the published visual envelope in one opaque batch',()=>{
  const craft=orbitCraft(),bounds=new T.Box3().setFromObject(craft);
  near(bounds.min.x,-.4);near(bounds.max.x,.4);
  near(bounds.min.y,.12);near(bounds.max.y,.504);
  near(bounds.min.z,-.42);near(bounds.max.z,.42);
  assert.equal(craft.children.length,1);
});

test('Orbit shutter decoration stays inside every original collider and the face is closed',()=>{
  for(const hazard of stages.orbit.flatMap(stage=>stage.hazards)) {
    const group=new T.Group();orbitShutter(group,hazard);group.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(group);
    near(bounds.min.x,hazard.z-hazard.w/2);near(bounds.max.x,hazard.z+hazard.w/2);
    near(bounds.min.y,hazard.y);near(bounds.max.y,hazard.y+hazard.h);
    near(bounds.min.z,-hazard.x-hazard.d/2);near(bounds.max.z,-hazard.x+hazard.d/2);
    for(const horizontal of [-.45,0,.45])for(const height of [.04,.2,.5,.8,.96]) {
      const ray=new T.Raycaster(new T.Vector3(hazard.z+horizontal*hazard.w,hazard.y+height*hazard.h,-hazard.x+hazard.d),new T.Vector3(0,0,-1));
      assert.ok(ray.intersectObject(group,true).length,'A shutter face must never suggest an opening');
    }
    const frontAt=(x:number,y:number)=>new T.Raycaster(new T.Vector3(hazard.z+x,hazard.y+y,-hazard.x+hazard.d),new T.Vector3(0,0,-1)).intersectObject(group,true)[0].point.z;
    const center=frontAt(0,hazard.h/2);
    near(center,-hazard.x+hazard.d/2-.19);
    for(const side of [-1,1])for(const y of [.22,hazard.h-.22]) {
      const cap=frontAt(side*(hazard.w/2-.18),y);
      near(cap,-hazard.x+hazard.d/2);
      assert.ok(cap-center>.18,'Chunky corner caps must project in front of the recessed solid panel');
    }
  }
});

test('Orbit platform panels and skirts end at the original gap boundaries',()=>{
  for(const stage of stages.orbit) {
    const group=new T.Group();
    for(const platform of stage.platforms) {
      const piece=new T.Group();orbitPlatform(piece,platform);
      const bounds=new T.Box3().setFromObject(piece);
      near(bounds.min.z,-platform.b);near(bounds.max.z,-platform.a);
      near(bounds.min.x,platform.z-platform.w/2);near(bounds.max.x,platform.z+platform.w/2);
      near(bounds.min.y,platform.y-.86);near(bounds.max.y,platform.y+.031);
      piece.updateMatrixWorld(true);
      const top=new T.Raycaster(new T.Vector3(platform.z,3,-platform.a-1),new T.Vector3(0,-1,0)).intersectObject(piece,true)[0];
      near(top.point.y,platform.y-.01);
      const wall=new T.Raycaster(new T.Vector3(platform.z,platform.y-.43,-platform.a+1),new T.Vector3(0,0,-1)).intersectObject(piece,true)[0];
      near(wall.point.z,-platform.a);
      group.add(piece);
    }
    group.updateMatrixWorld(true);
    for(let i=0;i<stage.platforms.length-1;i++) {
      const a=stage.platforms[i].b,b=stage.platforms[i+1].a;
      for(const x of [a+.01,(a+b)/2,b-.01])for(const z of [-3.45,0,3.45]) {
        const ray=new T.Raycaster(new T.Vector3(z,3,-x),new T.Vector3(0,-1,0));
        assert.equal(ray.intersectObject(group,true).length,0,'Decoration must not bridge a playable gap');
      }
    }
  }
});
