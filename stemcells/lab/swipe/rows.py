# Lab rig: prints the marker row of each picture around one swipe.  rows.py result trace index [from_ms to_ms]
import json, base64, io, sys
from PIL import Image
r = json.load(open(sys.argv[1])); g = r['geometry']; i = int(sys.argv[3])
t = json.load(open(f"{sys.argv[2]}.{i}.json"))
lo = float(sys.argv[4]) if len(sys.argv) > 4 else -30; hi = float(sys.argv[5]) if len(sys.argv) > 5 else 400
shots = sorted([e for e in t if e.get('name') == 'Screenshot'], key=lambda e: e['ts'])
sw = r['results'][i]; t0 = sw['posted'][1]
lift = [sw['posted'][k] for k, e in enumerate(sw['events']) if e[3] == 4]
print('pictures', len(shots), 'lift at', [round(l - t0) for l in lift], 'wheel delivery', [round(x[1]-x[0]) for x in sw['probe']['wheels']][:30])
def kind(p):
    a, b, c = p
    if a > 170 and b < 110 and c < 110: return 'R'
    if b > 170 and a < 110 and c < 110: return 'G'
    if c > 170 and a < 110 and b < 110: return 'B'
    return '.'
for e in shots:
    ms = e['ts'] / 1000
    if ms < t0 + lo or ms > t0 + hi: continue
    img = Image.open(io.BytesIO(base64.b64decode(e['args']['snapshot']))).convert('RGB')
    scale = img.width / g['innerWidth']; y = int((g['top'] + 6) * scale)
    print(f"{ms - t0:7.1f} " + ''.join(kind(img.getpixel((x, y))) for x in range(int(g['left'] * scale) - 2, img.width, 5)))
