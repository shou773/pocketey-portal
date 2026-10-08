"""Original wind-carved rock and rooted observatory; Blender 4.3, no external assets."""
import bpy, bmesh, math, json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/games/tilttrail/models'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mesh_object(name, verts, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj

def rock(name):
    # Offset, lobed elliptical strata, with a domed crown and tapered hanging
    # underside. No flat platform, stacked cubes, repeated corner rounding.
    levels = [(-4.8, .13, .55, -.15), (-3.45, .53, .1, -.3),
              (-1.55, 1.0, -.18, -.1), (-.05, .82, -.12, .12),
              (.9, .40, .25, .1)]
    n = 14
    verts, faces = [], []
    for j, (y, radius, cx, cz) in enumerate(levels):
        for i in range(n):
            a = 2 * math.pi * i / n
            lobe = 1 + .10 * math.sin(3*a+.3) + .075*math.cos(2*a-.7)
            verts.append((cx + 4.0*radius*lobe*math.cos(a),
                y + .12*math.sin(2*a+j*.35)*radius,
                cz + 3.25*radius*lobe*math.sin(a)))
    for j in range(len(levels)-1):
        for i in range(n):
            a=j*n+i; b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    bottom=len(verts); verts.append((.62,-5.05,-.16))
    top=len(verts); verts.append((.25,1.3,.0))
    for i in range(n):
        faces.append((bottom,(i+1)%n,i))
        faces.append((top,4*n+i,4*n+(i+1)%n))
    return mesh_object(name,verts,faces)

def arch():
    # A single swept, leaning arch. Its left shoulder is heavier, its crown
    # is thin, and both flared roots enter the rock before voxel union.
    rings, sides = 14, 6
    verts, faces = [], []
    for i in range(rings):
        t=i/(rings-1); a=math.pi*(1-t)
        center=Vector((-.2+1.95*math.cos(a), -.24+3.35*math.sin(a)+.23*math.sin(2*a), .18+.3*math.cos(a)))
        tangent=Vector((-1.95*math.sin(a),3.35*math.cos(a)+.46*math.cos(2*a),-.3*math.sin(a))).normalized()
        normal=Vector((-tangent.y,tangent.x,0)).normalized()
        cross=tangent.cross(normal).normalized()
        radius=.23+.38*abs(2*t-1)**2+.055*(1-t)
        for k in range(sides):
            angle=2*math.pi*k/sides
            verts.append(tuple(center+radius*(math.cos(angle)*normal+.84*math.sin(angle)*cross)))
    for i in range(rings-1):
        for k in range(sides):
            a=i*sides+k; b=i*sides+(k+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((rings-1)*sides+k for k in range(sides)))
    return mesh_object('Rooted asymmetric observatory sweep',verts,faces)

def normals(obj):
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data); bm.free()
    for p in obj.data.polygons:p.use_smooth=True

def finish(obj, filename, target=None):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    normals(obj)
    if target:
        # One watertight union: rock and architecture share continuous faces.
        remesh=obj.modifiers.new('Continuous rooted stone','REMESH')
        remesh.mode='VOXEL'; remesh.voxel_size=.105; remesh.use_smooth_shade=True
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth=obj.modifiers.new('Wind-worn transitions','SMOOTH')
        smooth.factor=.55; smooth.iterations=4
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        obj.data.calc_loop_triangles()
        decimate=obj.modifiers.new('Silhouette budget','DECIMATE')
        decimate.ratio=target/len(obj.data.loop_triangles)
        bpy.ops.object.modifier_apply(modifier=decimate.name)
        normals(obj)
    colors=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    def palette(hex_color):
        # Author explicit sRGB swatches, store linear values for glTF/Three.
        values=[((hex_color>>shift)&255)/255 for shift in [16,8,0]]
        return Vector([v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values])
    def ramp(a,b,v):
        t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
    underside=palette(0x263e50); stone=palette(0x77828b); garden=palette(0x649a72)
    ceramic=palette(0xeee1bd); glaze=palette(0x41868b); footing=palette(0xad7952)
    centers=[]
    for i in range(65):
        t=i/64;a=math.pi*(1-t)
        centers.append((Vector((-.2+1.95*math.cos(a),-.24+3.35*math.sin(a)+.23*math.sin(2*a),.18+.3*math.cos(a))),t))
    for loop in obj.data.loops:
        vertex=obj.data.vertices[loop.vertex_index];p=vertex.co;x,y,z=p
        c=underside.lerp(stone,ramp(-3.8,-1.1,y))
        crown=ramp(-.3,.65,y)*ramp(.25,.7,vertex.normal.y)
        c=c.lerp(garden,crown)
        # Broad strata and restrained underside shading, not a noisy texture.
        c*=1+.055*math.sin(y*2.0+x*.32+z*.22)
        c*=.88+.12*ramp(-.55,.55,vertex.normal.y)
        if target:
            center,t=min(centers,key=lambda item:(p-item[0]).length_squared)
            # The convex garden ends at y=1.30. Keep the construction's color
            # seam above it so a root cannot paint a large adjoining rock face.
            architecture=y>1.31
            if architecture:
                # Large ceramic faces, a bronze foundation at both roots,
                # and a cool glazed inner reveal make this a built landmark.
                radial=Vector((center.x+.2,center.y+.24,0)).normalized()
                inner=ramp(.02,.19,-(p-center).dot(radial))
                c=ceramic.lerp(glaze,inner*.85)
                c=footing.lerp(c,ramp(1.85,2.25,y))
                c*=.92+.08*ramp(-.5,.5,vertex.normal.y)
        colors.data[loop.index].color=(*c,1)
    mat=bpy.data.materials.new('Garden crown, eroded strata and ceramic landmark vertex palette')
    mat.use_nodes=True; shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.83
    color=mat.node_tree.nodes.new('ShaderNodeVertexColor'); color.layer_name='Color'
    mat.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(mat)
    obj.data.calc_loop_triangles()
    # Report actual connected topology and final triangle count before export.
    bm=bmesh.new();bm.from_mesh(obj.data)
    nonmanifold=sum(not e.is_manifold for e in bm.edges)
    remaining=set(bm.verts); components=0
    while remaining:
        components+=1; frontier=[remaining.pop()]
        while frontier:
            v=frontier.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other in remaining:remaining.remove(other);frontier.append(other)
    bm.free()
    report={'name':obj.name,'triangles':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices),
        'nonManifoldEdges':nonmanifold,'connectedComponents':components,
        'bounds':[[min(v.co[j] for v in obj.data.vertices),max(v.co[j] for v in obj.data.vertices)] for j in range(3)]}
    bpy.ops.export_scene.gltf(filepath=str(OUT/filename),export_format='GLB',use_selection=True,
        export_yup=False,export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
    report['bytes']=(OUT/filename).stat().st_size
    obj.hide_set(True)
    return report

reports=[]
reports.append(finish(rock('Wind-carved hanging rock'),'wind-rock.glb'))
base=rock('Rooted observatory rock'); sweep=arch()
bpy.ops.object.select_all(action='DESELECT');base.select_set(True);sweep.select_set(True)
bpy.context.view_layer.objects.active=base;bpy.ops.object.join()
reports.append(finish(base,'rooted-observatory.glb',320))
(Path(__file__).parent/'model-report.json').write_text(json.dumps(reports,indent=2)+'\n')
print(json.dumps(reports,indent=2))
