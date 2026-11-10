# Lab rig: reads a run's result and its trace, and says how the strip on screen followed the
# fingers: the delay from a finger move to the strip showing it, the frames missed while it moved,
# and how far it went past where it was sent.
#
#   python3 -I analyze.py result.json trace.json [--latch 8] [--frames dir]
import base64
import io
import json
import statistics
import sys

from PIL import Image

result = json.load(open(sys.argv[1]))
import glob

trace = []
for name in sorted(glob.glob(sys.argv[2] + ".*.json")):
    trace += json.load(open(name))
latch = float(sys.argv[sys.argv.index("--latch") + 1]) if "--latch" in sys.argv else 0.0
frames_dir = sys.argv[sys.argv.index("--frames") + 1] if "--frames" in sys.argv else None
geometry = result["geometry"]

shots = sorted(
    (e for e in trace if e.get("name") == "Screenshot" and "snapshot" in e.get("args", {})),
    key=lambda e: e["ts"],
)


def kind(pixel):
    r, g, b = pixel[:3]
    if r > 170 and g < 110 and b < 110:
        return 0
    if g > 170 and r < 110 and b < 110:
        return 1
    if b > 170 and r < 110 and g < 110:
        return 2
    return None


def runs_of(image):
    scale = image.width / geometry["innerWidth"]
    y = int((geometry["top"] + 6) * scale)
    left = geometry["left"] * scale
    right = (geometry["left"] + geometry["width"]) * scale
    row = [kind(image.getpixel((x, y))) for x in range(image.width)]
    runs = []
    start = None
    for x in range(int(left), min(image.width, int(right) + 1)):
        colour = row[x]
        if start is not None and colour != start[0]:
            runs.append((start[0], start[1], x))
            start = None
        if colour is not None and start is None:
            start = (colour, x)
    if start is not None:
        runs.append((start[0], start[1], min(image.width, int(right) + 1)))
    return [run for run in runs if run[2] - run[1] >= 3], left, right


def position(image, near):
    """Where the strip is (in tabs, by the tabs' own numbers), near `near`."""
    runs, left, right = runs_of(image)
    if not runs:
        return None
    colour, x0, x1 = max(runs, key=lambda run: run[2] - run[1])
    width = right - left
    best = None
    for index in range(int(near) - 3, int(near) + 4):
        if index % 3 != colour:
            continue
        at_left = x0 <= left + 6
        at_right = x1 >= right - 6
        if at_left and not at_right:
            at = index + 1 - (x1 - left) / width
        elif at_left and at_right:
            at = index
        else:
            at = index - (x0 - left) / width
        if best is None or abs(at - near) < abs(best - near):
            best = at
    return best


series = []  # (ms, position or None)
near = None
for shot in shots:
    image = Image.open(io.BytesIO(base64.b64decode(shot["args"]["snapshot"]))).convert("RGB")
    series.append((shot["ts"] / 1000.0, image))

if frames_dir:
    import os

    os.makedirs(frames_dir, exist_ok=True)
    for i, (ms, image) in enumerate(series):
        image.save(f"{frames_dir}/{i:05d}.jpg")
    json.dump([ms for ms, _ in series], open(f"{frames_dir}/times.json", "w"))

gaps_all = [b[0] - a[0] for a, b in zip(series, series[1:])]
nominal = statistics.median([g for g in gaps_all if g < 40]) if gaps_all else 16.7
width = geometry["width"]

lags, onsets, overshoots, settles, missed_runs, worst_gaps, moved_frames = [], [], [], [], 0, [], 0
per = []
for swipe in result["results"]:
    events, posted = swipe["events"], swipe["posted"]
    if not posted:
        continue
    fingers = [(posted[i], abs(e[1])) for i, e in enumerate(events) if e[3] in (1, 2)]
    if not fingers:
        continue
    lift = max(posted[i] for i, e in enumerate(events) if e[3] == 4)
    t0, t_end = fingers[0][0], posted[-1] + 1500
    travel, total = [], 0.0
    for t, dx in fingers:
        total += dx
        travel.append((t, total))

    def when(px):
        """When the fingers had moved `px`."""
        previous = (travel[0][0] - 8.3, 0.0)
        for t, moved in travel:
            if moved >= px:
                span = moved - previous[1]
                return t if span <= 0 else previous[0] + (t - previous[0]) * (px - previous[1]) / span
            previous = (t, moved)
        return None

    start = float(swipe["from"])
    target = float(swipe["from"] + swipe["expected"])
    near = start
    track = []
    for ms, image in series:
        if ms < t0 - 100 or ms > t_end:
            continue
        at = position(image, near)
        if at is None:
            continue
        near = at
        track.append((ms, at))
    if len(track) < 3:
        continue
    direction = 1 if any(e[1] > 0 for e in events if e[3] in (1, 2)) else -1
    swipe_lags = []
    onset = None
    for ms, at in track:
        shown = (at - start) * direction * width
        if ms < t0 or ms > lift + 2 * nominal:
            continue
        if onset is None and shown >= 2:
            due = when(latch + 2)
            if due is not None:
                onset = ms - due
        if shown > 2 and shown + latch < total - 1:
            due = when(shown + latch)
            if due is not None:
                swipe_lags.append(ms - due)
    # Frames missed while the strip moved: the gaps between pictures from the first move to rest.
    moving = [(ms, at) for ms, at in track if ms >= t0]
    last_move = t0
    for (a_ms, a), (b_ms, b) in zip(moving, moving[1:]):
        if abs(b - a) > 0.0005:
            last_move = b_ms
    in_motion = [(ms, at) for ms, at in moving if ms <= last_move]
    gaps = [b[0] - a[0] for a, b in zip(in_motion, in_motion[1:])]
    runs = sum(1 for g in gaps if g > 2.5 * nominal)
    past = max(((at - target) * (1 if target >= start else -1) * width for ms, at in track if ms > lift), default=0.0)
    if swipe["expected"] == 0:
        past = max((abs(at - target) * width for ms, at in track if ms > lift + 2 * nominal), default=0.0)
    lags += swipe_lags
    if onset is not None:
        onsets.append(onset)
    overshoots.append(past)
    settles.append(last_move - lift)
    missed_runs += runs
    moved_frames += len(gaps)
    worst_gaps.append(max(gaps, default=0.0))
    per.append({"label": swipe["label"], "from": swipe["from"], "to": swipe["to"], "onset": onset, "lag_med": statistics.median(swipe_lags) if swipe_lags else None, "lag_max": max(swipe_lags, default=None), "worst_gap": max(gaps, default=0.0), "runs": runs, "past_px": past, "settle_ms": last_move - lift})


def pct(values, q):
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(q * (len(ordered) - 1))))]


def fmt(value):
    return "-" if value is None else f"{value:.1f}"


summary = {
    "swipes": len(per),
    "frame_ms": nominal,
    "lag_median": pct(lags, 0.5),
    "lag_p95": pct(lags, 0.95),
    "lag_max": max(lags, default=None),
    "onset_median": pct(onsets, 0.5),
    "onset_p95": pct(onsets, 0.95),
    "missed_runs": missed_runs,
    "frames_in_motion": moved_frames,
    "worst_gap_median": pct(worst_gaps, 0.5),
    "worst_gap_max": max(worst_gaps, default=None),
    "past_px_max": max(overshoots, default=None),
    "settle_median": pct(settles, 0.5),
}
print(json.dumps(summary))
if "--per" in sys.argv:
    for row in per:
        print(json.dumps(row))
if "--out" in sys.argv:
    json.dump({"summary": summary, "per": per}, open(sys.argv[sys.argv.index("--out") + 1], "w"))
