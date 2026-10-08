# Reduce the existing original rock only; no asset/model search or new design.
from pathlib import Path
import bpy,json
root=Path(__file__).resolve().parents[3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'docs/release/tilttrail-ceramic/evidence/wind-rock-preview-140.glb'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=o
mod=o.modifiers.new('Preserve draw budget','DECIMATE');mod.ratio=.915
bpy.ops.object.modifier_apply(modifier=mod.name)
for p in o.data.polygons:p.use_smooth=True
tris=sum(len(p.vertices)-2 for p in o.data.polygons)
assert tris<=128, tris
bpy.ops.export_scene.gltf(filepath=str(root/'public/games/tilttrail/models/wind-rock.glb'),export_format='GLB',export_materials='EXPORT',export_normals=True)
import bmesh
m=bmesh.new();m.from_mesh(o.data)
report={'triangles':tris,'vertices':len(m.verts),'nonManifoldEdges':sum(not e.is_manifold for e in m.edges),'bytes':(root/'public/games/tilttrail/models/wind-rock.glb').stat().st_size}
(root/'docs/release/tilttrail-ceramic/evidence/rock-budget.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
