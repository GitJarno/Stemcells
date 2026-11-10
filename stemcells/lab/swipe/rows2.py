# Lab rig: marker rows for an experiment's trace file ({posted, events, shots}).
import json, base64, io, sys
from PIL import Image
d = json.load(open(sys.argv[1])); lo = float(sys.argv[2]); hi = float(sys.argv[3])
t0 = d['posted'][1]
def kind(p):
    a, b, c = p
    if a > 170 and b < 110 and c < 110: return 'R'
    if b > 170 and a < 110 and c < 110: return 'G'
    if c > 170 and a < 110 and b < 110: return 'B'
    return '.'
print('lift at', [round(d['posted'][k] - t0) for k, e in enumerate(d['events']) if e[3] == 4], 'pictures', len(d['shots']))
last = None
for e in sorted(d['shots'], key=lambda e: e['ts']):
    ms = e['ts'] / 1000 - t0
    if ms < lo or ms > hi: continue
    img = Image.open(io.BytesIO(base64.b64decode(e['args']['snapshot']))).convert('RGB')
    scale = img.width / 1100; y = int((44 + 6) * scale)
    row = ''.join(kind(img.getpixel((x, y))) for x in range(int(273 * scale) - 2, img.width, 5))
    if row != last or '--all' in sys.argv: print(f"{ms:7.1f} {row}")
    last = row
