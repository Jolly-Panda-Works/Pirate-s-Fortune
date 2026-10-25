# Blender (3.x) headless exporter: licensed Synty POLYGON Pirate Pack (FBX,
# extracted under game3d/) -> compact GLB files the web client loads.
#
#   blender -b -P tools/assets/export_synty.py -- game3d client/src/assets/models
#
# Writes characters.glb (skinned, shared rig, one mesh per character),
# props.glb (one root node per prop, named after its FBX) and ship.glb.
# All share the pack's single 1024² colour atlas. The raw pack stays out of
# git (see .gitignore); only these game-ready exports are committed.

import bpy
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:]
PACK = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])
MODELS = os.path.join(PACK, 'PolygonPirates', 'Models')
TEX = os.path.join(PACK, 'PolygonPirates', 'Textures')
os.makedirs(OUT, exist_ok=True)

PROPS = [
    # ship's cabin
    'SM_Prop_Barrel_01', 'SM_Prop_Barrel_02', 'SM_Prop_Barrel_04', 'SM_Prop_Barrel_Half_01',
    'SM_Prop_Crate_01', 'SM_Prop_Crate_02', 'SM_Prop_Crate_04', 'SM_Prop_Crate_Cannonballs_01',
    'SM_Prop_Cannon_01', 'SM_Prop_CannonBalls_01', 'SM_Prop_Lantern_01', 'SM_Prop_Lantern_02',
    'SM_Prop_ShipWheel_01', 'SM_Prop_Anchor_01', 'SM_Prop_Sack_01', 'SM_Prop_Sack_02',
    'SM_Prop_Rope_Hanging_01', 'SM_Prop_Chest_Treasure_01', 'SM_Prop_TreasurePile_01',
    'SM_Prop_TreasurePile_02', 'SM_Prop_Stack_01', 'SM_Prop_Window_01', 'SM_Flag_Pirate_01',
    'SM_Prop_Parrot_01', 'SM_Prop_Liferaft_01', 'SM_Prop_Door_01', 'SM_Prop_Pillar_01',
    'SM_Prop_WoodPlank_01',
    # tavern
    'SM_Prop_Table_01', 'SM_Prop_Table_02', 'SM_Prop_Table_03', 'SM_Prop_Stool_01',
    'SM_Prop_Stool_02', 'SM_Prop_Bench_01', 'SM_Item_Bottle_01', 'SM_Item_Bottle_02',
    'SM_Item_Bottle_03', 'SM_Item_Bottle_04', 'SM_Item_Cup_01', 'SM_Item_Chalice_01',
    'SM_Item_Plate_01', 'SM_Item_Candelabra_01', 'SM_Item_Candle_01', 'SM_Item_Bottle_Candle_01',
    'SM_Item_SkullCandle_01', 'SM_Prop_Campfire_01', 'SM_Prop_Pot_01', 'SM_Prop_Fishing_Crate_01',
    'SM_Prop_BottleTorch_01',
    # on the card table / effects / menu
    'SM_Item_Coins_01', 'SM_Item_Coins_02', 'SM_Item_Gem_01', 'SM_Item_Compass_01',
    'SM_Item_Map_01', 'SM_Item_Spyglass_01', 'SM_Item_Skull_01', 'SM_Env_PalmTree_01',
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def atlas_material(name, emissive):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.85
    bsdf.inputs['Specular'].default_value = 0.2
    img = bpy.data.images.load(os.path.join(TEX, 'PolygonPirates_01_A.png'), check_existing=True)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if emissive:
        em = bpy.data.images.load(os.path.join(TEX, 'PolygonPirates_01_Emmisive.png'), check_existing=True)
        etex = nt.nodes.new('ShaderNodeTexImage')
        etex.image = em
        nt.links.new(etex.outputs['Color'], bsdf.inputs['Emission'])
        bsdf.inputs['Emission Strength'].default_value = 1.0
    return mat


def assign(mat):
    for o in bpy.data.objects:
        if o.type == 'MESH':
            o.data.materials.clear()
            o.data.materials.append(mat)


def export(path, skins=False):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_skins=skins,
        export_animations=False,
        export_apply=not skins,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_colors=False,  # Synty vertex colours are mask data, not tint
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
    print('EXPORTED', path, os.path.getsize(path) // 1024, 'KB')


# --- characters -------------------------------------------------------------
reset()
bpy.ops.import_scene.fbx(filepath=os.path.join(MODELS, 'Characters.fbx'))
for o in list(bpy.data.objects):
    if o.type == 'MESH' and not o.name.startswith('Character_'):
        bpy.data.objects.remove(o, do_unlink=True)
# Export the true rest (T-)pose so the skin binds cleanly and runtime
# posing starts from it.
# The FBX also carries a stray 'Take 001' action that overrides the pose at
# export time, so drop all animation data first.
for arm in [o for o in bpy.data.objects if o.type == 'ARMATURE']:
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
bpy.context.view_layer.update()
assign(atlas_material('Pirates_Characters', emissive=False))
export(os.path.join(OUT, 'characters.glb'), skins=True)

# --- props: one root per FBX, real-world metres -----------------------------
reset()
mat = atlas_material('Pirates_Props', emissive=True)
for stem in PROPS:
    path = os.path.join(MODELS, stem + '.fbx')
    if not os.path.exists(path):
        print('MISSING', stem)
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for i, o in enumerate(new):
        o.name = f'{stem}_part{i}'
    root = bpy.data.objects.new(stem, None)
    bpy.context.scene.collection.objects.link(root)
    root.scale = (100, 100, 100)  # pack is authored in centimetres
    for o in new:
        if o.parent is None:
            o.parent = root
assign(mat)
export(os.path.join(OUT, 'props.glb'))

# --- menu galleon -------------------------------------------------------------
reset()
bpy.ops.import_scene.fbx(filepath=os.path.join(MODELS, 'SM_Veh_Veh_Boat_Large_01_Hull_Pirate.fbx'))
root = bpy.data.objects.new('Galleon', None)
bpy.context.scene.collection.objects.link(root)
for o in list(bpy.data.objects):
    if o.parent is None and o is not root:
        o.parent = root
assign(atlas_material('Pirates_Ship', emissive=False))
export(os.path.join(OUT, 'ship.glb'))
