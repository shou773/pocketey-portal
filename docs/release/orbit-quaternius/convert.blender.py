import bpy,math,json,os,sys
from mathutils import Vector
# Open original Challenger.blend; pass private extraction root after --.
root=sys.argv[sys.argv.index('--')+1]
obj=bpy.data.objects['Challenger']
for m in obj.data.materials:
 for n in m.node_tree.nodes:
  if n.type=='TEX_IMAGE':
   n.image=bpy.data.images.load(root+'/extracted/Ultimate Spaceships - May 2021/Challenger/Textures/Challenger_Green.png',check_existing=True)
   n.image.scale(512,512)
   n.image.filepath_raw=root+'/served/challenger512.png'
   n.image.save()
   n.image=bpy.data.images.load(root+'/served/challenger512.png',check_existing=False)
# Authored nose is -Y: turn 180 degrees to face glTF -Z. Keep UVs/normals.
obj.rotation_euler.z=math.pi
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
bounds=[obj.matrix_world@Vector(c) for c in obj.bound_box]
center=(Vector(tuple(min(v[i] for v in bounds) for i in range(3)))+Vector(tuple(max(v[i] for v in bounds) for i in range(3))))/2
for v in obj.data.vertices: v.co-=center
obj.location=(0,0,0)
obj.scale=(.8/obj.dimensions.x,.84/obj.dimensions.y,.8/obj.dimensions.x)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
os.makedirs(root+'/served',exist_ok=True)
bpy.ops.export_scene.gltf(filepath=root+'/served/challenger.glb',export_format='GLB',use_selection=True,export_materials='EXPORT')
print('CONVERT',json.dumps({'dimensions_blender':list(obj.dimensions),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons),'materials':len(obj.data.materials),'changes':'center; normalize width .80 and length .84; no decimation or repaint; original green texture'}))
