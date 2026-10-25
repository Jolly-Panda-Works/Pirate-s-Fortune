# Blender: print objects, armature bones and materials of an FBX.
import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=argv[0])
for o in bpy.data.objects:
    extra = ''
    if o.type == 'MESH':
        extra = f" verts={len(o.data.vertices)} mats={[m.name for m in o.data.materials]} dims={tuple(round(d,2) for d in o.dimensions)}"
    print(f"OBJ {o.type} {o.name} parent={o.parent.name if o.parent else None}{extra}")
for a in bpy.data.armatures:
    print('ARMATURE', a.name, 'bones:', [b.name for b in a.bones])
for m in bpy.data.materials:
    tex = [n.image.name for n in (m.node_tree.nodes if m.node_tree else []) if n.type == 'TEX_IMAGE' and n.image]
    print('MAT', m.name, tex)
