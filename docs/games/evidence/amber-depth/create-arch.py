"""Original Amber landmark. Rebuild with Blender 4.3.2 --background --python.
One mesh/material; low-poly chamfered cross sections and vertex-painted strata.
No external models, textures, or reference images are used in this file.
"""
import bpy
import math
from pathlib import Path

root = Path(__file__).resolve().parents[4]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
outer = [(-4.5, 0), (-4.5, 3.8)]
inner = [(-2.65, 0), (-2.65, 3.8)]
for i in range(1, 9):
    angle = math.pi - i * math.pi / 8
    rough = [0, .1, -.08, .06, -.1, .07, -.05, 0][i - 1]
    outer.append((math.cos(angle) * 4.5, 3.8 + math.sin(angle) * 3.5 + rough))
    inner.append((math.cos(angle) * 2.65, 3.8 + math.sin(angle) * 1.8))
outer.append((4.5, 0))
inner.append((2.65, 0))
count = len(outer)
vertices = []
for depth, bevel in [(-.9, .14), (-.72, 0), (.72, 0), (.9, .14)]:
    for outline, sign in [(outer, -1), (inner, 1)]:
        for x, y in outline:
            # Blender Z is up, exported GLB Y is up.
            vertices.append((x + math.copysign(1, x) * bevel * sign, -depth, y + (bevel * sign if y > 3.8 else 0)))
faces = []
for i in range(count - 1):
    j = i + 1
    faces.append((i, j, count + j, count + i))
    base = 6 * count
    faces.append((base + count + i, base + count + j, base + j, base + i))
    for layer in range(3):
        a = layer * count * 2
        b = a + count * 2
        faces.append((a + i, b + i, b + j, a + j))
        faces.append((a + count + j, b + count + j, b + count + i, a + count + i))
for i in [0, count - 1]:
    for layer in range(3):
        a = layer * count * 2
        b = a + count * 2
        faces.append((a + i, a + count + i, b + count + i, b + i))
mesh = bpy.data.meshes.new('Amber sandstone arch')
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new('Amber sandstone arch', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
# Recalculate consistent outward normals before export.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
colors = mesh.color_attributes.new(name='Color', type='BYTE_COLOR', domain='CORNER')
palette = [0xB78E9D, 0xCAA6B0, 0xB18A9A]
def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
for polygon in mesh.polygons:
    y = sum(mesh.vertices[index].co.z for index in polygon.vertices) / len(polygon.vertices)
    hex_color = palette[int(y / 1.05) % len(palette)]
    rgb = [linear((hex_color >> shift & 255) / 255) for shift in [16, 8, 0]]
    for loop in polygon.loop_indices:
        colors.data[loop].color = (*rgb, 1)
material = bpy.data.materials.new('Vertex-painted sandstone')
material.use_nodes = True
vertex_color = material.node_tree.nodes.new('ShaderNodeVertexColor')
vertex_color.layer_name = 'Color'
bsdf = material.node_tree.nodes.get('Principled BSDF')
material.node_tree.links.new(vertex_color.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 1
mesh.materials.append(material)
mesh.calc_loop_triangles()
print(f'AMBER_ARCH: {len(mesh.loop_triangles)} triangles, {len(mesh.vertices)} vertices, 1 mesh, 1 material')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(root / 'docs/games/evidence/amber-depth/stone-arch.blend'))
bpy.ops.export_scene.gltf(filepath=str(root / 'public/games/assets/amber/stone-arch.glb'), export_format='GLB', use_selection=True, export_yup=True)
