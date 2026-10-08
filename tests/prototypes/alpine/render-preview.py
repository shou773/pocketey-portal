# Auxiliary Blender view of exported meshes. NOT the browser/Three.js render.
import bpy, json, math
from mathutils import Matrix, Vector
from pathlib import Path
shots=json.loads(Path('/tmp/alpine-art-scenes.json').read_text())
out=Path('docs/prototypes/alpine/evidence/art-pass')
out.mkdir(parents=True,exist_ok=True)
conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def matrix(values): return conversion @ Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
for shot in shots:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16
    scene.cycles.use_denoising=False
    scene.render.resolution_x=780; scene.render.resolution_y=1448; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes.get('Background')
    background.inputs[0].default_value=(.53,.61,.73,1); background.inputs[1].default_value=.65
    for index,m in enumerate(shot['meshes']):
        # The translucent contact circle is represented by alpha in Blender as well.
        mesh=bpy.data.meshes.new(m['name'] or str(index))
        coords=[m['positions'][i:i+3] for i in range(0,len(m['positions']),3)]
        faces=[m['indices'][i:i+3] for i in range(0,len(m['indices']),3)]
        mesh.from_pydata(coords,[],faces); mesh.update()
        mat=bpy.data.materials.new('material');mat.use_nodes=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
        output=nodes.new('ShaderNodeOutputMaterial')
        shader=nodes.new('ShaderNodeEmission' if m['basic'] else 'ShaderNodeBsdfDiffuse')
        shader.inputs['Color'].default_value=(*m['color'],1)
        if m['colors']:
            attr=mesh.color_attributes.new(name='tint',type='FLOAT_COLOR',domain='POINT')
            for i in range(len(coords)):attr.data[i].color=(*m['colors'][i*3:i*3+3],1)
            vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='tint';links.new(vertex.outputs['Color'],shader.inputs['Color'])
        if m['opacity']<1:
            transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader')
            mix.inputs[0].default_value=m['opacity'];links.new(transparent.outputs[0],mix.inputs[1]);links.new(shader.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs[0])
        else:links.new(shader.outputs[0],output.inputs[0])
        mesh.materials.append(mat)
        for transform in m['matrices']:
            obj=bpy.data.objects.new(m['name'] or 'mesh',mesh);scene.collection.objects.link(obj);obj.matrix_world=matrix(transform)
    data=bpy.data.cameras.new('game-camera');camera=bpy.data.objects.new('game-camera',data);scene.collection.objects.link(camera)
    camera.matrix_world=matrix(shot['camera']);data.sensor_fit='VERTICAL';data.sensor_height=32
    data.lens=32/(2*math.tan(math.radians(shot['fov'])/2));data.clip_end=230;scene.camera=camera
    light=bpy.data.lights.new('warm-sun','SUN');light.energy=2.15;light.color=(1,.75,.48);light.angle=math.radians(8)
    sun=bpy.data.objects.new('warm-sun',light);scene.collection.objects.link(sun)
    direction=Vector((-18,12,-28));sun.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(shot['name']+'-blender-preview.png'))
    bpy.ops.render.render(write_still=True)
    print('AUXILIARY_PREVIEW_SAVED',shot['name'],flush=True)
