"""Original low-poly celestial frame. Run with Blender 4.3 in background mode."""
import bpy
import bmesh
import math
from pathlib import Path

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
pieces = []

def tint(obj, rgb):
    colors = obj.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    for item in colors.data:
        item.color = (*rgb, 1)
    pieces.append(obj)

def box(name, location, scale, rgb):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    tint(obj, rgb)

# Y is height here; export without automatic Y-up conversion. All pieces
# share vertex colors, one joined mesh and one material, with no texture.
cream = (.47, .60, .53)
bronze = (.55, .30, .11)
teal = (.14, .32, .30)
for x in [-.79, .79]:
    box('Ceramic footing', (x, .09, 0), (.58, .18, .58), cream)
    box('Bronze plinth', (x, .21, 0), (.40, .08, .40), bronze)
    box('Ceramic upright', (x, .86, 0), (.25, 1.25, .29), cream)
    box('Teal collar', (x, 1.40, 0), (.33, .11, .36), teal)

# A solid semicircular frame with clean faceted front and back surfaces.
verts = []
segments = 8
for z in [-.145, .145]:
    for radius in [.915, .665]:
        for i in range(segments + 1):
            angle = math.pi * i / segments
            verts.append((radius * math.cos(angle), 1.46 + radius * math.sin(angle), z))
faces = []
n = segments + 1
for i in range(segments):
    faces += [(i, i+1, n+i+1, n+i), (2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1),
              (i, 2*n+i, 2*n+i+1, i+1), (n+i, n+i+1, 3*n+i+1, 3*n+i)]
faces += [(0, n, 3*n, 2*n), (segments, 2*n+segments, 3*n+segments, n+segments)]
mesh = bpy.data.meshes.new('Original celestial arch')
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new('Celestial arch', mesh)
bpy.context.collection.objects.link(obj)
tint(obj, cream)

# A simple astronomical oculus and tiny four-point sighting mark make the
# silhouette meaningful, without borrowing a branded character or motif.
bpy.ops.mesh.primitive_torus_add(major_segments=8, minor_segments=3,
    location=(0, 2.39, 0), major_radius=.19, minor_radius=.035)
tint(bpy.context.object, bronze)
box('Vertical sight', (0, 2.39, 0), (.035, .21, .035), bronze)
box('Horizontal sight', (0, 2.39, 0), (.21, .035, .035), bronze)

bpy.ops.object.select_all(action='DESELECT')
for obj in pieces:
    obj.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
bpy.ops.object.join()
obj = bpy.context.object
obj.name = 'TiltTrail_Observatory_Frame'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
normal_mesh = bmesh.new()
normal_mesh.from_mesh(obj.data)
bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
normal_mesh.to_mesh(obj.data)
normal_mesh.free()
material = bpy.data.materials.new('Original ceramic with bronze vertex accents')
material.use_nodes = True
nodes = material.node_tree.nodes
shader = nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .8
color = nodes.new('ShaderNodeVertexColor')
color.layer_name = 'Color'
material.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])
obj.data.materials.clear()
obj.data.materials.append(material)

root = Path(__file__).resolve().parents[3]
out = root / 'public/games/tilttrail/models/observatory.glb'
out.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
    export_yup=False, export_materials='EXPORT',
    export_animations=False, export_cameras=False, export_lights=False)
print('TiltTrail original observatory:', out)
