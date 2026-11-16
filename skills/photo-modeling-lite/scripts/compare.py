"""Compare same-frame images; no registration, quality score or automatic acceptance."""
import argparse,json,math,pathlib
from PIL import Image,ImageOps,ImageDraw
p=argparse.ArgumentParser();p.add_argument('reference',type=pathlib.Path);p.add_argument('render',type=pathlib.Path);p.add_argument('--out',required=True,type=pathlib.Path);p.add_argument('--points',type=pathlib.Path,help='Optional JSON list: {id, reference:[u,v], render:[u,v]}, normalized original-frame coordinates');a=p.parse_args()
r=ImageOps.exif_transpose(Image.open(a.reference)).convert('RGB');s=ImageOps.exif_transpose(Image.open(a.render)).convert('RGB')
if abs((r.width/r.height)/(s.width/s.height)-1)>.005:p.error('Aspect ratios differ; align camera/crop before comparison. No forced stretching.')
if a.out.exists():p.error('Output directory already exists; use a new revision path.')
points=json.loads(a.points.read_text(encoding='utf8')) if a.points else []
if not isinstance(points,list):p.error('points must be a list')
seen=set();errors=[]
for item in points:
 if not item.get('id') or item['id'] in seen:p.error('Point IDs must be nonempty and unique')
 seen.add(item['id'])
 for key in ['reference','render']:
  v=item.get(key)
  if not isinstance(v,list) or len(v)!=2 or any(not isinstance(x,(int,float)) or not math.isfinite(x) or not 0<=x<=1 for x in v):p.error('Points must be finite normalized [u,v] coordinates')
 dx=(item['render'][0]-item['reference'][0])*r.width;dy=(item['render'][1]-item['reference'][1])*r.height
 errors.append({'id':item['id'],'dx_reference_px':dx,'dy_reference_px':dy,'distance_reference_px':math.hypot(dx,dy)})
a.out.mkdir(parents=True)
size=r.size;r.thumbnail((1024,1536));s=s.resize(r.size,Image.Resampling.LANCZOS)
from PIL import ImageChops
Image.blend(r,s,.5).save(a.out/'overlay.png');ImageChops.difference(r,s).save(a.out/'difference.png')
canvas=Image.new('RGB',(r.width*2,r.height+32),'white');canvas.paste(r,(0,32));canvas.paste(s,(r.width,32));d=ImageDraw.Draw(canvas);d.text((12,8),'Reference',fill='black');d.text((r.width+12,8),'Render',fill='black')
for item in points:
 for offset,key,color in [(0,'reference','red'),(r.width,'render','blue')]:
  u,v=item[key];x=offset+u*r.width;y=32+v*r.height;d.ellipse((x-3,y-3,x+3,y+3),outline=color,width=2);d.text((x+5,y),item['id'],fill=color)
canvas.save(a.out/'side-by-side.png')
(a.out/'comparison.json').write_text(json.dumps({'reference':str(a.reference.resolve()),'render':str(a.render.resolve()),'reference_size':size,'points':errors,'note':'No automatic alignment; point values supplied by caller. Metrics are displacement, not reconstruction accuracy. Visual review required.'},indent=2),encoding='utf8')
print(a.out/'side-by-side.png')
