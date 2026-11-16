"""Headless static Tripo GLB runner; standard-library only outside Blender."""
import argparse, hashlib, json, os, pathlib, struct, subprocess, sys, time, uuid
ROOT = pathlib.Path(__file__).resolve().parent
CACHE = ROOT / '.cache'
DEFAULT_BLENDER = os.environ.get('TRIPO_BLENDER_EXECUTABLE')
def digest(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def glb_check(path):
    with open(path,'rb') as f:
        magic,version,length=struct.unpack('<4sII',f.read(12))
        if magic!=b'glTF' or version!=2 or length!=path.stat().st_size: raise ValueError('Expected intact GLB 2.0')
        size,kind=struct.unpack('<II',f.read(8))
        if kind!=0x4e4f534a: raise ValueError('Missing GLB JSON chunk')
        doc=json.loads(f.read(size))
    reasons=[]
    if doc.get('skins') or any('skin' in n for n in doc.get('nodes',[])): reasons.append('skins')
    if doc.get('animations'): reasons.append('animation')
    if any(p.get('targets') for m in doc.get('meshes',[]) for p in m.get('primitives',[])): reasons.append('morph targets')
    if any(p.get('mode',4)!=4 for m in doc.get('meshes',[]) for p in m.get('primitives',[])): reasons.append('non-triangle primitives')
    if any(n.get('extensions',{}).get('EXT_mesh_gpu_instancing') for n in doc.get('nodes',[])): reasons.append('GPU instancing')
    if any(i.get('uri') and not i['uri'].startswith('data:') for i in doc.get('images',[])): reasons.append('external image URI (embed textures first)')
    supported={'KHR_materials_unlit','KHR_texture_transform','KHR_materials_emissive_strength','KHR_mesh_quantization'}
    unknown=set(doc.get('extensionsUsed',[]))-supported
    if unknown: reasons.append('unverified GLTF extensions: '+','.join(sorted(unknown)))
    if reasons: return {'status':'needs_attention','reasons':reasons,'input_preserved':True}
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['inspect','process','verify'])
    p.add_argument('--input',required=True,type=pathlib.Path)
    p.add_argument('--output-dir',type=pathlib.Path)
    p.add_argument('--plan',type=pathlib.Path)
    p.add_argument('--blend',action='store_true',help='Explicitly also save processed.blend')
    p.add_argument('--previews',action='store_true',help='Inspect only: render three orthographic images with component label coordinates')
    p.add_argument('--blender',type=pathlib.Path,default=DEFAULT_BLENDER)
    p.add_argument('--timeout',type=int,default=600)
    a=p.parse_args(); start=time.monotonic()
    if a.blender is None: p.error('Supply --blender ABSOLUTE_EXE or TRIPO_BLENDER_EXECUTABLE')
    source=a.input.resolve()
    if source.suffix.lower()!='.glb': raise ValueError('Input must be .glb')
    problem=glb_check(source)
    if problem: print(json.dumps(problem)); return 2
    sha=digest(source)
    if a.action!='inspect' and a.output_dir is None: p.error('--output-dir is required for process/verify')
    if a.previews and a.action!='inspect': p.error('--previews is only valid for inspect')
    out=a.output_dir.resolve() if a.output_dir else None
    if out and (out/'processed.glb').resolve()==source: raise ValueError('Output must not overwrite input')
    if a.action=='process' and out and any((out/n).exists() for n in ['processed.glb','validation.json','processed.blend']):
        raise ValueError('Use a new output directory; existing delivery files are preserved')
    job=CACHE/'runs'/uuid.uuid4().hex; job.mkdir(parents=True)
    req=dict(action=a.action,source=str(source),source_sha256=sha,output_dir=str(out) if out else None,plan=str(a.plan.resolve()) if a.plan else None,blend=a.blend,previews=a.previews,cache=str(CACHE),job=str(job))
    request=job/'request.json';request.write_text(json.dumps(req),encoding='utf8')
    log=job/'blender.log'
    cmd=[str(a.blender),'--background','--factory-startup','--python-exit-code','1','--python',str(ROOT/'worker.py'),'--',str(request)]
    with log.open('wb') as f:
        proc=subprocess.Popen(cmd,stdout=f,stderr=subprocess.STDOUT,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        try: code=proc.wait(timeout=a.timeout)
        except subprocess.TimeoutExpired:
            proc.kill();proc.wait();raise RuntimeError('Blender timed out; log: '+str(log))
    result_path=job/'result.json'
    if code!=0 or not result_path.exists():
        print(json.dumps(dict(status='error',exit_code=code,log=str(log),elapsed_seconds=round(time.monotonic()-start,3))))
        return code or 1
    result=json.loads(result_path.read_text(encoding='utf8'));result['elapsed_seconds']=round(time.monotonic()-start,3);result['log']=str(log)
    if a.action=='process' and result.get('status')=='ok':
        report_path=out/'validation.json';report=json.loads(report_path.read_text(encoding='utf8'));report['runtime_seconds']=result['elapsed_seconds'];report_path.write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(result,ensure_ascii=True,separators=(',',':')))
    return 0 if result.get('status')=='ok' else 2
if __name__=='__main__':
    try: sys.exit(main())
    except Exception as e:
        print(json.dumps({'status':'error','message':str(e)},ensure_ascii=True));sys.exit(1)
