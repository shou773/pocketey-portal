"""Original Pocketey solid industrial shutter, unit collision envelope.
Blender X width/Y depth/Z height -> glTF X/Y height/Z depth.
No imported assets, textures, lights or holes; opaque palette materials.
"""
import bpy,os,json,math
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,rgb):
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);return m
structure=mat('dark structural steel',(.035,.060,.080))
edge=mat('cool machined edge',(.13,.20,.23))
door=mat('warm safety armor',(.58,.125,.052))
warning=mat('small amber warning',(.95,.58,.16))
def block(name,loc,size,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('small hard chamfer','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# Full, uninterrupted cuboid blocker fills the existing collision volume.
# Face ornament is shallow relief; dark seams are painted/solid-backed, not gaps.
block('solid full-envelope blocker',(0,.14,.5),(1,.72,1),structure)
block('stepped exterior shell',(0,-.07,.5),(.98,.74,.98),edge,.035)
block('continuous recessed door face',(0,-.41,.48),(.78,.15,.79),door,.035)
# Industrial side rails and sloped crown frame the closed door.
for side in [-1,1]:
 block('side armored rail',(side*.448,-.385,.50),(.10,.20,.89),structure,.025)
 block('machined rail inset',(side*.442,-.489,.50),(.028,.018,.57),edge,.008)
 block('heavy foot',(side*.385,-.35,.065),(.23,.30,.13),structure,.025)
block('crown cap',(0,-.38,.935),(.88,.23,.12),edge,.025)
block('crown warning strip',(0,-.499,.935),(.48,.002,.024),warning)
block('bottom sill',(0,-.39,.075),(.82,.22,.10),edge,.018)
# One shallow center seam remains backed by a continuous solid door.
block('closed center joint',(0,-.487,.48),(.018,.008,.64),structure)
# Two broad angled armor ribs, with just two short warning bars.
for side in [-1,1]:
 rib=block('diagonal armor rib',(side*.215,-.492,.46),(.08,.010,.40),edge,.01);rib.rotation_euler.y=side*.38
 mark=block('warning slash',(side*.16,-.499,.64),(.028,.002,.15),warning);mark.rotation_euler.y=-.38
# Keep every relief part inside the collider bounds, including front +Z.
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.select_set(False)
# Four opaque source meshes, folded into the existing static draw at runtime.
for m in [structure,edge,door,warning]:
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
out='public/games/assets/orbit/armored-shutter.glb'
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('docs/release/orbit-shutter/armored-shutter.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out),export_format='GLB',export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('SHUTTER',json.dumps({'triangles':tri,'bytes':os.path.getsize(out),'materials':4,'envelope':'width1, height1, depth1; solid backing'}))
