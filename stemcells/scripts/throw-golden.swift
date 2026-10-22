// The golden flights a thrown Cell is tested against
// (apps/web/src/stemcells/windows/throw.golden.json), from the Swift original
// itself: the original app's MochiWorld.swift, MochiToss.swift, CritterToss.swift
// and CritterBonk.swift (as of its commit cfb41d642), compiled as they are
// and driven as CritterTossView.tick drives a thrown Cell, at 120 Hz and 60
// Hz. Only the drawing is left out (MochiWorld's `pose` and `face`,
// MochiToss's `pose`); the few MochiRig names its physics reads are below.
//
// From an empty directory, with UI and CORE the original app's UI and core source folders:
//
//   sed '409,442d' "$UI/MochiWorld.swift" > MochiWorld.swift
//   sed -e '92,97d' -e 's/    private var to: CGPoint/    var to: CGPoint/' \
//     "$UI/MochiToss.swift" > MochiToss.swift
//   cp "$CORE/CritterToss.swift" "$CORE/CritterBonk.swift" .
//   cp <this file> main.swift
//   swiftc -O MochiWorld.swift MochiToss.swift CritterToss.swift CritterBonk.swift main.swift -o golden
//   ./golden   # writes golden.json: copy it over throw.golden.json, then vp fmt it
import Foundation
import CoreGraphics

let box = CGSize(width: 26, height: 28)
let bounds = CGRect(x: 20, y: 40, width: 760, height: 460)
let extent = CGSize(width: 24, height: 7)
let lifetime = 0.85
let dazed = 1.15
/// A Cell wears its look, so it flies in its own world (`MochiToss`), which
/// squashes it itself: the view draws no landing squash for it, and its
/// dizzy beat and its way home wait on none (CritterTossView.swift:240,
/// 265-266, 281).
let wardrobe = true
let landing = 0.22  // CritterFlight.landing

struct Scenario { let name: String; let start: CGPoint; let v: CGVector; let grip: CGVector }
let scenarios = [
    Scenario(name: "flick-wall", start: CGPoint(x: 600, y: 300), v: CGVector(dx: 1000, dy: -250), grip: .zero),
    Scenario(name: "lob", start: CGPoint(x: 150, y: 420), v: CGVector(dx: 380, dy: -720), grip: .zero),
    Scenario(name: "ceiling", start: CGPoint(x: 400, y: 400), v: CGVector(dx: 60, dy: -1100), grip: .zero),
    Scenario(name: "plop", start: CGPoint(x: 300, y: 440), v: CGVector(dx: 40, dy: -60), grip: .zero),
    Scenario(name: "roll", start: CGPoint(x: 200, y: 400), v: CGVector(dx: 500, dy: -400), grip: CGVector(dx: 8, dy: -9)),
    Scenario(name: "fling-capped", start: CGPoint(x: 400, y: 300), v: CGVector(dx: -2400, dy: -1800), grip: CGVector(dx: -5, dy: 6)),
    Scenario(name: "drop", start: CGPoint(x: 500, y: 200), v: .zero, grip: .zero),
    Scenario(name: "corner", start: CGPoint(x: 700, y: 120), v: CGVector(dx: 900, dy: -900), grip: .zero),
]

func r(_ x: Double) -> Double { (x * 1e9).rounded() / 1e9 }
func surface(_ s: CritterTossImpact.Surface) -> String {
    switch s { case .left: "left"; case .right: "right"; case .ceiling: "ceiling"; case .floor: "floor" }
}
func tier(_ t: CritterBonk.Tier) -> String { switch t { case .tap: "tap"; case .bonk: "bonk"; case .wham: "wham" } }

func run(_ s: Scenario, hz: Double, checkpoints: Bool) -> [String: Any] {
    var motion = MochiToss(position: s.start, velocity: s.v, bodySize: box, gripOffset: s.grip)
    var flight = CritterBonk.Flight(extent: extent, lifetime: lifetime)
    var now = 0.0, tick = 0
    var points: [[Double]] = [], impacts: [[String: Any]] = [], hits: [[String: Any]] = [], words: [[String: Any]] = []
    var dazedStarted: Double?
    var landingStarted: Double?
    var landedAt: Double?, restAt: Double?, homeAt: Double?
    let dt = 1 / hz
    while now < 12 {
        tick += 1
        now = Double(tick) * dt
        motion.step(seconds: dt, bounds: bounds)
        if motion.floorContact != nil, !wardrobe { landingStarted = now }
        if let started = landingStarted, now - started >= landing { landingStarted = nil }
        flight.expire(at: now)
        for i in motion.impacts {
            impacts.append(["t": r(now), "surface": surface(i.surface), "speed": r(Double(i.speed)),
                            "x": r(Double(i.point.x)), "y": r(Double(i.point.y))])
        }
        if !motion.impacts.isEmpty {
            let body = CGRect(x: motion.position.x - box.width / 2, y: motion.position.y - box.height / 2,
                              width: box.width, height: box.height)
            let before = flight.words.count
            if let hit = flight.hit(motion.impacts, body: body, in: bounds, heading: motion.velocity, at: now) {
                hits.append(["t": r(now), "tier": tier(hit.tier), "surface": surface(hit.surface)])
            }
            if let w = flight.words.last, w.started == now {
                // The word placed by the body at the world frame of the hit, as well as at the tick.
                let hardest = motion.impacts.max(by: { $0.speed < $1.speed })!
                let atFrame = CGRect(x: motion.to.x - box.width / 2, y: motion.to.y - box.height / 2,
                                     width: box.width, height: box.height)
                let f = CritterBonk.centre(for: hardest, extent: extent, body: atFrame, in: bounds, heading: motion.velocity)
                words.append(["t": r(now), "tier": tier(w.tier), "surface": surface(w.surface),
                               "x": r(Double(w.centre.x)), "y": r(Double(w.centre.y)),
                               "fx": r(Double(f.x)), "fy": r(Double(f.y)), "replaced": flight.words.count == before])
            }
        }
        if motion.hasLanded, landedAt == nil { landedAt = now }
        if motion.isResting, restAt == nil { restAt = now }
        if motion.hasLanded, !motion.isHeld, dazedStarted == nil, flight.dizzy, landingStarted == nil {
            dazedStarted = now
        }
        if checkpoints, tick % 6 == 0 || motion.isResting {
            let v = motion.velocity
            points.append([r(now), r(Double(motion.position.x)), r(Double(motion.position.y)), r(Double(v.dx)), r(Double(v.dy)),
                           motion.touchingFloor ? 1 : 0, motion.hasLanded ? 1 : 0])
        }
        let atRest = motion.isResting && !motion.isHeld
        if atRest || (dazedStarted != nil && motion.hasLanded && !motion.isHeld) {
            let dazing = dazedStarted.map { now - $0 < dazed } ?? false
            if landingStarted == nil, !dazing, flight.words.isEmpty { homeAt = now; break }
        }
    }
    var out: [String: Any] = [
        "name": s.name, "hz": hz,
        "start": [Double(s.start.x), Double(s.start.y)], "velocity": [Double(s.v.dx), Double(s.v.dy)],
        "grip": [Double(s.grip.dx), Double(s.grip.dy)],
        "impacts": impacts, "hits": hits, "words": words,
        "dizzy": flight.dizzy, "solidHits": flight.solidHits,
        "landedAt": landedAt.map(r) as Any, "restAt": restAt.map(r) as Any, "dizzyFrom": dazedStarted.map(r) as Any,
        "homeAt": homeAt.map(r) as Any,
        "end": [r(Double(motion.position.x)), r(Double(motion.position.y))],
    ]
    if checkpoints { out["points"] = points }
    return out
}

// Hands: (x, y, seconds) samples, and the velocity read at a release time.
func hand(_ name: String, _ samples: [(Double, Double, Double)], at times: [Double]) -> [String: Any] {
    var v = CritterTossVelocity()
    for (x, y, t) in samples { v.record(CGPoint(x: x, y: y), at: t) }
    return ["name": name, "samples": samples.map { [$0.0, $0.1, $0.2] },
            "reads": times.map { t -> [Double] in let u = v.velocity(at: t); return [t, r(Double(u.dx)), r(Double(u.dy))] }]
}
func sample(_ x: Double, _ y: Double, _ t: Double) -> (Double, Double, Double) { (x, y, t) }
var steady: [(Double, Double, Double)] = []
var speeding: [(Double, Double, Double)] = []
var stopping: [(Double, Double, Double)] = []
for i in 0..<30 {
    let d = Double(i)
    let t: Double = 1 + 0.008 * d + 0.0001 * Double(i % 3)
    steady.append(sample(100 + 6 * d, 400 - 3 * d, t))
    let sq: Double = d * d
    speeding.append(sample(100 + 0.75 * sq, 400 - 0.4 * sq, t))
}
for i in 0..<20 {
    let x: Double = 100 + 8 * Double(min(i, 12))
    let t: Double = 2 + 0.0103 * Double(i)
    stopping.append(sample(x, 300, t))
}
let hands = [
    hand("steady", steady, at: [1.2322, 1.3, 1.3313, 1.34]),
    hand("speeding", speeding, at: [1.2322, 1.25]),
    hand("stopping", stopping, at: [2.1957, 2.2071, 2.31]),
]

func regrab(hz: Double) -> [String: Any] {
    var motion = MochiToss(position: CGPoint(x: 200, y: 400), velocity: CGVector(dx: 700, dy: -600), bodySize: box)
    var flight = CritterBonk.Flight(extent: extent, lifetime: lifetime)
    var samples = CritterTossVelocity()
    var grab = CGVector.zero
    var now = 0.0, tick = 0
    var points: [[Double]] = [], impacts: [[String: Any]] = []
    var caughtAt: [Double] = [], releasedAt: [Double] = []
    let dt = 1 / hz
    while now < 4 {
        tick += 1
        now = Double(tick) * dt
        // The hand: down on the body at 0.3 s, up and to the right for 0.1 s, let go.
        if now >= 0.3, now < 0.4 {
            let k = (now - 0.3) / 0.1
            let hand = CGPoint(x: 330 + 300 * k, y: 260 - 200 * k)
            if !motion.isHeld {
                grab = CGVector(dx: motion.position.x - hand.x, dy: motion.position.y - hand.y)
                caughtAt = [now, r(Double(motion.position.x)), r(Double(motion.position.y)), r(Double(grab.dx)), r(Double(grab.dy))]
                motion.catchAt(motion.position)
                flight.caught()
                samples = CritterTossVelocity()
            }
            samples.record(hand, at: now)
            motion.catchAt(CGPoint(x: hand.x + grab.dx, y: hand.y + grab.dy))
            motion.step(seconds: 0, bounds: bounds)
        } else if motion.isHeld {
            let hand = CGPoint(x: 630, y: 60)
            samples.record(hand, at: now)
            motion.catchAt(CGPoint(x: hand.x + grab.dx, y: hand.y + grab.dy))
            motion.step(seconds: 0, bounds: bounds)
            let v = samples.velocity(at: now)
            releasedAt = [now, r(Double(motion.position.x)), r(Double(motion.position.y)), r(Double(v.dx)), r(Double(v.dy))]
            motion.release(velocity: v, gripOffset: grab)
        }
        motion.step(seconds: dt, bounds: bounds)
        for i in motion.impacts {
            impacts.append(["t": r(now), "surface": surface(i.surface), "speed": r(Double(i.speed))])
        }
        if tick % 6 == 0 {
            points.append([r(now), r(Double(motion.position.x)), r(Double(motion.position.y)), motion.isHeld ? 1 : 0])
        }
        if motion.isResting { break }
    }
    return ["hz": hz, "caught": caughtAt, "released": releasedAt, "impacts": impacts, "points": points,
            "end": [r(Double(motion.position.x)), r(Double(motion.position.y))]]
}

let golden: [String: Any] = [
    "bounds": [Double(bounds.minX), Double(bounds.minY), Double(bounds.width), Double(bounds.height)],
    "box": [Double(box.width), Double(box.height)], "extent": [Double(extent.width), Double(extent.height)],
    "wordLife": lifetime, "dizzy": dazed,
    "flights": scenarios.map { run($0, hz: 120, checkpoints: true) },
    "flights60": scenarios.map { run($0, hz: 60, checkpoints: false) },
    "hands": hands,
    "regrab": regrab(hz: 120),
]
let data = try! JSONSerialization.data(withJSONObject: golden, options: [.sortedKeys])
FileManager.default.createFile(atPath: "golden.json", contents: data)
print("bytes", data.count)

// The few MochiRig names the world's physics reads, copied from
// the original's MochiRig.swift (restRows, profile, halfWidth(at:),
// keptWidth, rowCount); the drawing types are empty stand-ins.
public struct GridPoint: Hashable { public var x: Int, y: Int; public init(_ x: Int, _ y: Int) { self.x = x; self.y = y } }
public enum MochiRig {
    public enum Eyes: Equatable { case calm, open, sleepy, happy, squeeze, dizzy, none }
    public enum Mouth: Equatable { case none, smile, open, grin, wavy }
    public struct Arm: Equatable {}
    public static let restX = 15.5
    public static let restBase = 29
    public static let restRows = 16
    static let profile: [Double] = [10, 12, 13, 13, 13, 12, 12, 12, 11, 11, 11, 10, 10, 9, 8, 5]
    static func halfWidth(at t: Double) -> Double {
        let c = min(max(t, 0), Double(profile.count - 1)), i = Int(c), f = c - Double(i)
        return i + 1 < profile.count ? profile[i] * (1 - f) + profile[i + 1] * f : profile[i]
    }
    static func keptWidth(_ sy: Double) -> Double {
        let root = sy.squareRoot()
        return 1 / (root * root.squareRoot())
    }
    static func rowCount(_ sy: Double) -> Int {
        max(3, Int((Double(restRows) * max(sy, 0.25)).rounded()))
    }
}
