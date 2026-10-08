"""Original Lunar Relay, Blender-authored Orbit scenery; no imported assets.
Run: blender -b -t 1 --python docs/games/evidence/orbit-depth/relay.blender.py
Blender Z-up exports as glTF Y-up. All parts opaque, three shared materials.
"""
import bpy, math, os
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def paint(name, color):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1);return m
hull=paint('relay hull',(0.021,0.059,0.105))
deck=paint('moonlit alloy',(0.24,0.37,0.43))
signal=paint('signal glass',(0.18,0.57,0.55))
def block(name,position,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position)
    obj=bpy.context.object;obj.name=name;obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(material)
    if bevel:
        modifier=obj.modifiers.new('manufactured chamfer','BEVEL');modifier.width=bevel;modifier.segments=1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj
block('dock chassis',(0,0,-3),(7,11,1.1),hull,.28)
block('landing apron',(0,0,-2.4),(7.4,11.4,.22),deck,.12)
block('relay tower',(1.8,1,1),(2.7,4,6.8),hull,.30)
block('observation crown',(1.8,1,4.3),(3.1,4.3,.55),deck,.20)
for z in [.3,1.5,2.7]:
    block('front inset glass',(1.8,-1.012,z),(1.9,.028,.23),signal,.02)
    block('side inset glass',(.438,1,z),(.028,2.8,.23),signal,.02)
block('service hangar',(-1.8,-2,-.8),(2.3,4,2.2),deck,.30)
block('hangar mouth',(-1.8,-4.012,-.8),(1.7,.026,1.35),hull,.10)
for x in [-2.7,2.7]:block('lower support',(x,0,-4.6),(.6,8,2.6),hull,.12)
block('antenna pedestal',(1.8,1,4.8),(.5,.5,.65),hull,.04)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=4,radius=1,location=(1.8,1,5.4))
dish=bpy.context.object;dish.name='directional receiver';dish.scale=(.8,.8,.14);dish.rotation_euler=(.5,.3,0);dish.data.materials.append(deck)
# Join by material before export: three source meshes, merged again at runtime.
for material in [hull,deck,signal]:
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==material]
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
out=os.path.join(os.getcwd(),'public/games/assets/orbit/lunar-relay.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('ORIGINAL_ORBIT_RELAY',os.path.getsize(out))
