"""Blender worker. Internal request/result protocol; use runner.py."""
import bpy, bmesh, json, math, hashlib, pathlib, sys, gzip, itertools, collections
from mathutils import Vector
from mathutils.kdtree import KDTree
R=json.loads(pathlib.Path(sys.argv[sys.argv.index('--')+1]).read_text(encoding='utf8'))
CACHE=pathlib.Path(R['cache']); SRC=CACHE/'sources'/R['source_sha256']; SRC.mkdir(parents=True,exist_ok=True)
JOB=pathlib.Path(R['job']); TOL=2e-6
SCHEME='loose-location-stable-v1'
def write(path,data):
    path.write_text(json.dumps(data,ensure_ascii=True,indent=2),encoding='utf8')
def result(data): write(JOB/'result.json',data)
def meshes(): return [o for o in bpy.context.scene.objects if o.type=='MESH']
def select(obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    if obs:bpy.context.view_layer.objects.active=obs[0]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def material(m):
    return m.name if m else None

def snapshot(o,normals=False):
    me=o.data;me.calc_loop_triangles();mat=o.matrix_world;normalmat=mat.to_3x3().inverted().transposed()
    uv=me.uv_layers.active
    tris=[]
    for t in me.loop_triangles:
        pts=[list(mat@me.vertices[me.loops[i].vertex_index].co) for i in t.loops]
        row={'p':pts,'m':material(me.materials[t.material_index]) if me.materials else None}
        row['uv']=[list(uv.data[i].uv) for i in t.loops] if uv else None
        row['uv_layers']={layer.name:[list(layer.data[i].uv) for i in t.loops] for layer in me.uv_layers}
        row['colors']={attr.name:[list(attr.data[i if attr.domain=='CORNER' else me.loops[i].vertex_index].color) for i in t.loops] for attr in me.color_attributes if attr.domain in {'CORNER','POINT'}}
        if normals:
            row['n']=[]
            for i in t.loops:
                n=normalmat@me.corner_normals[i].vector
                assert all(math.isfinite(x) for x in n) and n.length>.5,'Invalid corner normal'
                n.normalize();row['n'].append(list(n))
        tris.append(row)
    return tris

def triangle_area(t):
    a,b,c=map(Vector,t['p']);return (b-a).cross(c-a).length/2

def compare(expected,actual,allow_cleanup=False,normals=False):
    tree=KDTree(len(expected))
    for i,t in enumerate(expected):tree.insert(sum((Vector(p) for p in t['p']),Vector())/3,i)
    tree.balance();used=set();worst=0.;mindot=1.;corners=0
    for t in actual:
        center=sum((Vector(p) for p in t['p']),Vector())/3
        found=None
        for _,idx,_ in tree.find_range(center,TOL*2):
            if idx in used:continue
            e=expected[idx]
            for order in itertools.permutations(range(3)):
                err=max((Vector(t['p'][j])-Vector(e['p'][order[j]])).length for j in range(3))
                if err>TOL:continue
                if t['m']!=e['m']:continue
                if bool(t['uv'])!=bool(e['uv']):continue
                if t['uv'] and max(abs(t['uv'][j][a]-e['uv'][order[j]][a]) for j in range(3) for a in range(2))>2e-6:continue
                # Additional UV maps/colors must survive cleanup; export verification compares active UV plus exported color data separately.
                if allow_cleanup:
                    if set(t['uv_layers'])!=set(e['uv_layers']) or set(t['colors'])!=set(e['colors']):continue
                    if any(max(abs(t['uv_layers'][k][j][a]-e['uv_layers'][k][order[j]][a]) for j in range(3) for a in range(2))>2e-6 for k in e['uv_layers']):continue
                    if any(max(abs(t['colors'][k][j][a]-e['colors'][k][order[j]][a]) for j in range(3) for a in range(4))>2e-5 for k in e['colors']):continue
                if normals:
                    eu=list(e['uv_layers'].values());tu=list(t['uv_layers'].values())
                    if len(eu)!=len(tu):continue
                    if any(max(abs(tu[k][j][a]-eu[k][order[j]][a]) for j in range(3) for a in range(2))>2e-6 for k in range(len(eu))):continue
                    ec=list(e['colors'].values());tc=list(t['colors'].values())
                    if len(ec)!=len(tc):continue
                    if any(max(abs(tc[k][j][a]-ec[k][order[j]][a]) for j in range(3) for a in range(4))>2e-5 for k in range(len(ec))):continue
                    dots=[Vector(t['n'][j]).dot(Vector(e['n'][order[j]])) for j in range(3)]
                    if min(dots)<=.999:continue
                    mindot=min(mindot,min(dots));corners+=3
                found=idx;worst=max(worst,err);break
            if found is not None:break
        assert found is not None,'Triangle changed, duplicated, moved, lost material/UV, or normal dot <= .999'
        used.add(found)
    removed=[t for i,t in enumerate(expected) if i not in used]
    duplicate_removed=0
    if allow_cleanup:
        actualtree=KDTree(len(actual))
        for i,t in enumerate(actual):actualtree.insert(sum((Vector(p) for p in t['p']),Vector())/3,i)
        actualtree.balance()
        for t in removed:
            p=list(map(Vector,t['p']))
            if triangle_area(t)<1e-12 or min((p[a]-p[b]).length for a,b in [(0,1),(1,2),(2,0)])<=TOL:continue
            duplicate=False
            for _,idx,_ in actualtree.find_range(sum(p,Vector())/3,TOL*2):
                other=actual[idx]
                if t['m']!=other['m']:continue
                if any(max((p[j]-Vector(other['p'][order[j]])).length for j in range(3))<=TOL and (not t['uv'] or max(abs(t['uv'][j][a]-other['uv'][order[j]][a]) for j in range(3) for a in range(2))<=2e-6) for order in itertools.permutations(range(3))):duplicate=True;break
            assert duplicate,('Nondegenerate source triangle lost',triangle_area(t),t['p'])
            duplicate_removed+=1
    else: assert not removed,'Triangle coverage mismatch'
    return dict(source_triangles=len(expected),output_triangles=len(actual),cleanup_removed_triangles=len(removed),duplicate_triangles_removed=duplicate_removed,max_world_vertex_error=worst,normal_corners_checked=corners,min_normal_dot=mindot)

def component_hash(o):
    # Exact local coordinates, world matrix and per-corner attributes; IDs meaningful only with exact source + version.
    data={'matrix':[list(r) for r in o.matrix_world],'triangles':snapshot(o)}
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def load_source():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    manifest_path=SRC/'components.json'; blend=SRC/'raw.blend'
    if manifest_path.exists() and blend.exists():
        manifest=json.loads(manifest_path.read_text())
        if manifest['blender']==bpy.app.version_string and manifest['id_scheme']==SCHEME and manifest.get('raw_blend_sha256')==sha(blend):
            bpy.ops.wm.open_mainfile(filepath=str(blend));return sorted(meshes(),key=lambda o:o.name),manifest
    bpy.ops.import_scene.gltf(filepath=R['source'])
    assert meshes(),'No mesh objects'
    for o in meshes():
        assert not o.data.shape_keys and not o.modifiers and not o.animation_data,'Unsupported deforming mesh'
        assert abs(o.matrix_world.to_3x3().determinant())>1e-12,'Singular transform'
    # Independent instances must not share editable mesh datablocks during loose separation.
    for o in meshes():
        if o.data.users>1:o.data=o.data.copy()
    bpy.context.preferences.filepaths.save_version=0
    initial=sum(len(o.data.polygons) for o in meshes())
    select(meshes());bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
    obs=sorted(meshes(),key=lambda o:tuple(o.location))
    for i,o in enumerate(obs):o.name=f'Component_{i:06d}'
    entries=[]
    for i,o in enumerate(obs):
        pts=[o.matrix_world@v.co for v in o.data.vertices]
        entries.append(dict(id=i,label=f'Loose_{i+1:03d}',geometry_sha256=component_hash(o),triangles=len(snapshot(o)),bounds=[[min(p[a] for p in pts) for a in range(3)],[max(p[a] for p in pts) for a in range(3)]]))
    manifest=dict(source=R['source'],source_sha256=R['source_sha256'],blender=bpy.app.version_string,id_scheme=SCHEME,original_faces=initial,components=entries)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend));manifest['raw_blend_sha256']=sha(blend);write(manifest_path,manifest);return obs,manifest

def get_plan(manifest):
    path=pathlib.Path(R['plan']) if R['plan'] else SRC/'successful-plan.json'
    if not path.exists() and not R['plan']:
        path=pathlib.Path(__file__).parent/'plans'/(R['source_sha256']+'.json')
    if not path.exists():return None
    p=json.loads(path.read_text(encoding='utf8'))
    assert isinstance(p,dict),'Plan must be an object; see references/plan-format.md'
    assert p.get('source_sha256')==R['source_sha256'],'Plan source hash mismatch'
    assert p.get('id_scheme')==SCHEME,'Plan ID scheme mismatch'
    assert p.get('blender')==bpy.app.version_string,'Plan Blender version mismatch: inspect with chosen Blender and review hashes'
    assert p.get('component_hashes')==[c['geometry_sha256'] for c in manifest['components']],'Plan geometry hash mismatch'
    groups=p['groups'];assert groups and p.get('semantic_reviewed') is True,'Visual semantic review required'
    names=[g['name'] for g in groups];assert len(names)==len(set(names)) and all(isinstance(n,str) and 0<len(n)<64 for n in names),'Names must be unique and shorter than 64 characters'
    ids=[i for g in groups for i in g['ids']]
    assert all(type(i)==int for i in ids) and sorted(ids)==list(range(len(manifest['components']))),'Every fragment must appear exactly once'
    assert all(g['ids'] for g in groups),'Empty group'
    return p

def clean(o):
    select([o]);me=o.data
    if me.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
    deg=[f for f in bm.faces if f.calc_area()<1e-12];removed=len(deg)
    if deg:bmesh.ops.delete(bm,geom=deg,context='FACES_ONLY')
    isolated=[v for v in bm.verts if not v.link_faces]
    if isolated:bmesh.ops.delete(bm,geom=isolated,context='VERTS')
    bm.normal_update();seen=set();opened=closed=0
    for f in bm.faces:
        if f in seen:continue
        island=[];todo=[f];seen.add(f)
        while todo:
            face=todo.pop();island.append(face)
            for e in face.edges:
                for other in e.link_faces:
                    if other not in seen:seen.add(other);todo.append(other)
        original={face:face.normal.copy() for face in island};isclosed=all(e.is_manifold for face in island for e in face.edges)
        bmesh.ops.recalc_face_normals(bm,faces=island);bm.normal_update()
        if not isclosed:
            opened+=1
            if sum(face.calc_area()*face.normal.dot(original[face]) for face in island)<0:bmesh.ops.reverse_faces(bm,faces=island)
        else:closed+=1
    bm.normal_update()
    for f in bm.faces:f.smooth=True
    for e in bm.edges:e.smooth=e.is_manifold and e.calc_face_angle(0.)<math.radians(35)
    bm.to_mesh(me);bm.free();me.update()
    mod=o.modifiers.new('Baked_Weighted_Normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=50;mod.mode='FACE_AREA_WITH_ANGLE';mod.thresh=.01
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return dict(removed_zero_area_faces=removed,open_islands=opened,closed_islands=closed)

def exported_materials(path):
    import struct
    with open(path,'rb') as f:
        f.read(12);n,_=struct.unpack('<II',f.read(8));doc=json.loads(f.read(n))
    # Names and the complete material definition; resolve image indices to embedded image bytes.
    return doc

def validate_materials(source,output):
    a=exported_materials(source);b=exported_materials(output)
    # Conservative acceptance: compare material definitions after resolving image/sampler references.
    def resolved(doc,path):
        import struct
        raw=pathlib.Path(path).read_bytes();jsn=struct.unpack_from('<I',raw,12)[0];offset=20+jsn+8
        def image(idx):
            im=doc['images'][idx]
            if 'bufferView' in im:
                v=doc['bufferViews'][im['bufferView']];start=offset+v.get('byteOffset',0);return hashlib.sha256(raw[start:start+v['byteLength']]).hexdigest()
            return im.get('uri')
        def texture_refs(x):
            if isinstance(x,list):return [texture_refs(v) for v in x]
            if not isinstance(x,dict):return x
            out={}
            for k,v in x.items():
                if k in {'name','extras'}:continue
                if k.endswith('Texture') and isinstance(v,dict) and 'index' in v:
                    tex=doc['textures'][v['index']];sam=doc.get('samplers',[])
                    out[k]={key:texture_refs(val) for key,val in v.items() if key!='index'}
                    out[k]['image_sha256']=image(tex['source']);out[k]['sampler']=sam[tex['sampler']] if 'sampler' in tex else {}
                else:out[k]=texture_refs(v)
            return out
        return {m.get('name',f'material_{i}'):texture_refs(m) for i,m in enumerate(doc.get('materials',[]))}
    aa=resolved(a,source);bb=resolved(b,output)
    # glTF exporters elide default values. Normalize core glTF defaults before comparing.
    def defaults(m):
        m=dict(m);p=dict(m.get('pbrMetallicRoughness',{}));p.setdefault('baseColorFactor',[1,1,1,1]);p.setdefault('metallicFactor',1);p.setdefault('roughnessFactor',1);m['pbrMetallicRoughness']=p
        m.setdefault('alphaMode','OPAQUE');m.setdefault('doubleSided',False);m.setdefault('emissiveFactor',[0,0,0])
        return m
    assert set(aa)==set(bb),'Material count/names changed'
    def equal(a,b):
        if isinstance(a,(int,float)) and isinstance(b,(int,float)):return abs(a-b)<=1e-6
        if isinstance(a,dict) and isinstance(b,dict):return set(a)==set(b) and all(equal(a[k],b[k]) for k in a)
        if isinstance(a,list) and isinstance(b,list):return len(a)==len(b) and all(equal(x,y) for x,y in zip(a,b))
        return a==b
    for k in aa:assert equal(defaults(aa[k]),defaults(bb[k])),'Material/texture mapping changed: '+k
    return dict(materials=len(aa),material_definitions_preserved=True,embedded_texture_mapping_preserved=True)

def verify_export(path,expected):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));obs=meshes()
    assert len(obs)==len(expected) and {o.name for o in obs}==set(expected),'Prop count/name mismatch'
    rows=[]
    for o in obs:
        actual=snapshot(o,True)
        assert all(triangle_area(t)>0 for t in actual),'Degenerate triangle after export'
        r=compare(expected[o.name],actual,normals=True);r['name']=o.name;rows.append(r)
    return rows

def previews(obs):
    from bpy_extras.object_utils import world_to_camera_view
    pts=[o.matrix_world@v.co for o in obs for v in o.data.vertices];lo=Vector([min(p[a] for p in pts) for a in range(3)]);hi=Vector([max(p[a] for p in pts) for a in range(3)]);center=(lo+hi)/2
    scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=False
    scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    cam=bpy.data.objects.new('InspectCamera',bpy.data.cameras.new('InspectCamera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=max((hi-lo).length*1.1,.1)
    labels={}
    for name,offset in [('front',(0,-2,0)),('side',(2,0,0)),('top',(0,0,2))]:
        cam.location=center+Vector(offset)*(max((hi-lo).length,1));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();scene.render.filepath=str(SRC/(name+'.png'));bpy.ops.render.render(write_still=True)
        labels[name]=[]
        for i,o in enumerate(obs):
            co=sum((o.matrix_world@Vector(p) for p in o.bound_box),Vector())/8;p=world_to_camera_view(scene,cam,co)
            labels[name].append(dict(id=i,x=round(p.x*1200,1),y=round((1-p.y)*1000,1)))
    write(SRC/'preview-labels.json',labels)

def main():
    if R['action']=='verify':
        out=pathlib.Path(R['output_dir']);report=json.loads((out/'validation.json').read_text())
        assert report['source_sha256']==R['source_sha256'],'Wrong source'
        assert sha(out/'processed.glb')==report['output_sha256'],'Output hash changed'
        reference=CACHE/'verified'/report['output_sha256']/'expected.json.gz'
        with gzip.open(reference,'rt',encoding='utf8') as f:expected=json.load(f)
        rows=verify_export(out/'processed.glb',expected);mats=validate_materials(R['source'],str(out/'processed.glb'))
        result(dict(status='ok',action='verify',props=len(rows),triangles=sum(r['output_triangles'] for r in rows),normal_corners_checked=sum(r['normal_corners_checked'] for r in rows),min_normal_dot=min(r['min_normal_dot'] for r in rows),validation=str(out/'validation.json'),**mats));return
    obs,manifest=load_source()
    if R['action']=='inspect':
        if R['previews']:previews(obs)
        template=dict(source_sha256=R['source_sha256'],id_scheme=SCHEME,blender=bpy.app.version_string,component_hashes=[c['geometry_sha256'] for c in manifest['components']],semantic_reviewed=False,groups=[])
        write(SRC/'plan-template.json',template)
        result(dict(status='ok',action='inspect',source_sha256=R['source_sha256'],components=len(obs),original_faces=manifest['original_faces'],manifest=str(SRC/'components.json'),plan_template=str(SRC/'plan-template.json'),cached_plan=str(SRC/'successful-plan.json') if (SRC/'successful-plan.json').exists() else (str(pathlib.Path(__file__).parent/'plans'/(R['source_sha256']+'.json')) if (pathlib.Path(__file__).parent/'plans'/(R['source_sha256']+'.json')).exists() else None),previews=str(SRC) if R['previews'] else None));return
    plan=get_plan(manifest)
    if plan is None:
        result(dict(status='needs_attention',reason='New source: inspect, visually review complete props, then provide an explicit plan covering all fragments exactly once',manifest=str(SRC/'components.json')));return
    # Capture raw source triangles before any weld, per semantic prop. Per-fragment weld matches legacy split cleanup.
    raw={g['name']:[t for i in g['ids'] for t in snapshot(obs[i])] for g in plan['groups']}
    for o in obs:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.to_mesh(o.data);bm.free();o.data.update()
    expected={};coverage=[];parts=[];cleanstats=[]
    for g in plan['groups']:
        objects=[obs[i] for i in g['ids']];select(objects)
        if len(objects)>1:bpy.ops.object.join()
        o=bpy.context.view_layer.objects.active;o.name=g['name'];assert o.name==g['name'],'Blender name collision'
        cs=clean(o);expected[o.name]=snapshot(o,True)
        row=compare(raw[o.name],expected[o.name],allow_cleanup=True);row['name']=o.name;row['source_fragments']=len(g['ids']);coverage.append(row);cs['name']=o.name;cleanstats.append(cs);parts.append(o)
    out=pathlib.Path(R['output_dir']);out.mkdir(parents=True,exist_ok=True)
    # Stage export in private job; publish only after verification passes.
    glb=JOB/'processed.glb';select(parts)
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_normals=True,export_apply=True,export_animations=False,export_yup=True,export_texcoords=True,export_materials='EXPORT',export_all_vertex_colors=True)
    if R['blend']:bpy.ops.wm.save_as_mainfile(filepath=str(JOB/'processed.blend'))
    exportrows=verify_export(glb,expected);matreport=validate_materials(R['source'],str(glb));digest=sha(glb)
    report=dict(status='ok',passed=True,source=R['source'],source_sha256=R['source_sha256'],output_sha256=digest,blender=bpy.app.version_string,id_scheme=SCHEME,props=len(parts),raw_components=len(obs),source_triangles=sum(len(t) for t in raw.values()),triangles=sum(r['output_triangles'] for r in exportrows),normal_corners_checked=sum(r['normal_corners_checked'] for r in exportrows),min_normal_dot=min(r['min_normal_dot'] for r in exportrows),world_tolerance=TOL,max_world_vertex_error=max(r['max_world_vertex_error'] for r in coverage+exportrows),uv_status='verified per triangle' if any(t['uv'] for ts in expected.values() for t in ts) else 'absent in source',coverage=coverage,cleanup=cleanstats,**matreport)
    ref=CACHE/'verified'/digest;ref.mkdir(parents=True,exist_ok=True)
    with gzip.open(ref/'expected.json.gz','wt',encoding='utf8') as f:json.dump(expected,f,separators=(',',':'))
    write(ref/'report.json',report);write(SRC/'successful-plan.json',plan)
    import shutil
    shutil.copy2(glb,out/'processed.glb')
    if R['blend']:shutil.copy2(JOB/'processed.blend',out/'processed.blend')
    write(out/'validation.json',report)
    result(dict(status='ok',action='process',output_dir=str(out),glb=str(out/'processed.glb'),validation=str(out/'validation.json'),props=report['props'],triangles=report['triangles'],normal_corners_checked=report['normal_corners_checked'],min_normal_dot=report['min_normal_dot'],max_world_vertex_error=report['max_world_vertex_error']))
try:
    main()
except AssertionError as e:
    result(dict(status='needs_attention',reason=str(e),input_preserved=True))
