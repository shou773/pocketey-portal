"""Original Pulse interceptor and manta boss. Blender 4.3, no external assets.
Run: blender -b --python scripts/blender/pulse_vehicles.py -- /absolute/repo/root
Coordinates below use the existing Three game axes (x, height, longitudinal z).
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector

root = Path(sys.argv[sys.argv.index('--') + 1])
out = root / 'public/games/assets/pulse'
out.mkdir(parents=True, exist_ok=True)
source = root / 'art/pulse'
source.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
material = bpy.data.materials.new('Pulse vertex paint')
material.use_nodes = True
node = material.node_tree.nodes.new('ShaderNodeVertexColor')
node.layer_name = 'Paint'
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .65
material.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])

def linear(hexcolor):
    c = tuple(int(hexcolor[i:i+2], 16)/255 for i in (0,2,4))
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)

class Vehicle:
    def __init__(self, name):
        self.name, self.verts, self.faces, self.colors = name, [], [], []

    def surface(self, rings, color):
        # Closed elliptical sections, coherent cross-section loft, no stacked boxes.
        offset = len(self.verts); n = len(rings[0])
        self.verts.extend((x, -z, h) for ring in rings for x,h,z in ring)
        faces = []
        for j in range(len(rings)-1):
            for k in range(n):
                faces.append((offset+j*n+k, offset+j*n+(k+1)%n, offset+(j+1)*n+(k+1)%n, offset+(j+1)*n+k))
        faces.extend([tuple(offset+k for k in reversed(range(n))), tuple(offset+(len(rings)-1)*n+k for k in range(n))])
        self.faces.extend(faces); self.colors.extend([linear(color)]*len(faces))

    def fuselage(self, sections, color, x=0, segments=16):
        # z, half-width, half-height, centre-height; smoothly tapered custom stations.
        self.surface([[(x+rx*math.cos(2*math.pi*k/segments), h+ry*math.sin(2*math.pi*k/segments), z)
                       for k in range(segments)] for z,rx,ry,h in sections], color)

    def wing(self, side, sections, color, segments=8):
        # x, leading edge z, trailing edge z, half-thickness, height.
        self.surface([[(side*x, h+t*math.sin(2*math.pi*k/segments), (lead+trail)/2+(trail-lead)/2*math.cos(2*math.pi*k/segments))
                       for k in range(segments)] for x,lead,trail,t,h in sections], color)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name+' continuous lofts')
        mesh.from_pydata(self.verts, [], self.faces); mesh.update()
        obj = bpy.data.objects.new(self.name, mesh); bpy.context.collection.objects.link(obj)
        mesh.materials.append(material)
        attr = mesh.color_attributes.new(name='Paint', type='FLOAT_COLOR', domain='CORNER')
        for face, color in zip(mesh.polygons, self.colors):
            face.use_smooth = True
            for i in face.loop_indices: attr.data[i].color = color
        # Recalculate outward normals on all closed shells, then triangulate once.
        bpy.context.view_layer.objects.active = obj; obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
        modifier=obj.modifiers.new('Final triangulation', 'TRIANGULATE')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)
        return obj

hero = Vehicle('interceptor')
hero.fuselage([(-.77,.018,.018,.07),(-.68,.065,.045,.075),(-.48,.115,.072,.085),(-.25,.15,.095,.095),(.02,.16,.11,.10),(.24,.145,.10,.10),(.43,.105,.068,.085),(.52,.04,.035,.06)], 'd9e4df')
wing = [(.075,-.38,.47,.065,.078),(.19,-.31,.48,.055,.073),(.30,-.19,.46,.042,.065),(.43,-.04,.42,.030,.057),(.55,.075,.35,.022,.05),(.62,.16,.27,.012,.045)]
for side in [-1,1]:
    hero.wing(side, wing, '3e83a0')
    # Engines emerge from the wing roots; nose-to-nozzle rounded shells.
    hero.fuselage([(-.12,.035,.03,.09),(-.04,.082,.065,.095),(.13,.10,.085,.10),(.32,.095,.078,.10),(.48,.08,.07,.10),(.57,.067,.058,.10)], 'c4d5d4', x=side*.235, segments=12)
    hero.fuselage([(.569,.065,.056,.10),(.601,.065,.056,.10)], '173644', x=side*.235, segments=12)
    hero.fuselage([(.602,.043,.036,.10),(.608,.043,.036,.10)], '78dfe8', x=side*.235, segments=12)
    # Low swept tail fairings grow out of aft shell, not upright box fins.
    hero.wing(side, [(.055,.28,.54,.05,.10),(.16,.38,.55,.025,.13),(.235,.47,.55,.01,.135)], '3e83a0')
hero.fuselage([(-.39,.014,.018,.18),(-.30,.063,.057,.205),(-.16,.088,.085,.225),(-.01,.083,.076,.23),(.13,.05,.038,.205),(.20,.008,.009,.175)], '142c41', segments=16)
hero_obj = hero.finish()

boss = Vehicle('manta_boss')
boss.fuselage([(-.65,.10,.06,.11),(-.50,.30,.13,.16),(-.25,.43,.20,.20),(.04,.46,.23,.23),(.30,.405,.20,.22),(.53,.29,.13,.18),(.69,.14,.055,.115),(.74,.045,.03,.10)], 'bca18a', segments=20)
boss_wing=[(.20,-.57,.70,.14,.14),(.43,-.58,.67,.12,.13),(.68,-.52,.57,.10,.12),(.90,-.38,.47,.07,.105),(1.08,-.20,.37,.042,.095),(1.13,-.06,.24,.018,.09)]
for side in [-1,1]:
    boss.wing(side,boss_wing,'a17d66')
    # Rounded gun fairing is buried in the shoulder and carries an integral barrel.
    boss.fuselage([(-.33,.025,.025,.20),(-.18,.13,.115,.235),(.08,.145,.125,.25),(.38,.12,.095,.245),(.58,.08,.075,.235),(.79,.061,.057,.235),(.87,.061,.057,.235)],'cfb69a',x=side*.63,segments=12)
    boss.fuselage([(.871,.045,.042,.235),(.876,.045,.042,.235)],'352c38',x=side*.63,segments=12)
    boss.fuselage([(-.48,.067,.06,.18),(-.51,.067,.06,.18)],'352c38',x=side*.78,segments=12)
boss.fuselage([(-.40,.022,.02,.39),(-.28,.17,.065,.405),(-.08,.22,.10,.43),(.14,.20,.087,.43),(.34,.10,.035,.39),(.39,.015,.015,.35)],'333947',segments=16)
boss_obj=boss.finish()

# Two joined meshes, one vertex-color material, no textures or modifiers at runtime.
bpy.context.scene.world.color=(.07,.09,.12)
for obj in [hero_obj,boss_obj]: obj.select_set(True)
bpy.context.view_layer.objects.active=hero_obj
bpy.ops.wm.save_as_mainfile(filepath=str(source/'pulse-vehicles.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(out/'pulse-vehicles.glb'),export_format='GLB',use_selection=True,export_normals=True,export_materials='EXPORT')
metrics=[]
for obj in [hero_obj,boss_obj]:
    mesh=obj.data
    metrics.append({'name':obj.name,'triangles':len(mesh.polygons),'vertices':len(mesh.vertices),'materials':len(mesh.materials),'boundsBlender':[list(min(v.co[i] for v in mesh.vertices) for i in range(3)),list(max(v.co[i] for v in mesh.vertices) for i in range(3))]})
(out/'models.json').write_text(json.dumps({'author':'Original project-authored Blender geometry; no third-party art','Blender':bpy.app.version_string,'models':metrics,'bytes':(out/'pulse-vehicles.glb').stat().st_size},indent=2)+'\n')
print('PULSE_MODEL_METRICS',metrics)
