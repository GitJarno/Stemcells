// Lab rig: posts phased trackpad scroll events to one process, never to the screen's event
// stream, so nothing reaches the person's own apps.
//
//   swipepost windows <pid>                    lists the process's windows
//   swipepost post <pid> <window> <x> <y>      reads "at_ms dx dy phase momentum" lines on stdin
//
// dx/dy are in the DOM's sense (positive scrolls toward later content); phase and momentum are
// CoreGraphics' codes (phase: 1 began, 2 changed, 4 ended, 128 may begin; momentum: 1 begin,
// 2 continue, 3 end). Prints "index uptime_ms" as each event is posted.
import CoreGraphics
import Foundation

func uptimeNs() -> UInt64 { clock_gettime_nsec_np(CLOCK_UPTIME_RAW) }

let args = CommandLine.arguments
guard args.count >= 3, let pid = Int32(args[2]) else {
  FileHandle.standardError.write("usage: swipepost windows|post <pid> ...\n".data(using: .utf8)!)
  exit(2)
}

if args[1] == "windows" {
  let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
  for window in list where (window[kCGWindowOwnerPID as String] as? Int32) == pid {
    let bounds = window[kCGWindowBounds as String] as? [String: Double] ?? [:]
    let number = window[kCGWindowNumber as String] as? Int ?? 0
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    print("\(number) \(bounds["X"] ?? 0) \(bounds["Y"] ?? 0) \(bounds["Width"] ?? 0) \(bounds["Height"] ?? 0) \(layer)")
  }
  exit(0)
}

guard args[1] == "post", args.count >= 6, let window = Int64(args[3]), let x = Double(args[4]),
  let y = Double(args[5])
else { exit(2) }

struct Step { let at: Double; let dx: Double; let dy: Double; let phase: Int64; let momentum: Int64 }
var steps: [Step] = []
while let line = readLine() {
  let parts = line.split(separator: " ").compactMap { Double($0) }
  if parts.count < 5 { continue }
  steps.append(Step(at: parts[0], dx: parts[1], dy: parts[2], phase: Int64(parts[3]), momentum: Int64(parts[4])))
}

let start = uptimeNs()
setvbuf(stdout, nil, _IOLBF, 0)
for (index, step) in steps.enumerated() {
  let due = start + UInt64(step.at * 1_000_000)
  while true {
    let now = uptimeNs()
    if now >= due { break }
    let left = due - now
    if left > 2_000_000 { usleep(UInt32((left - 1_000_000) / 1000)) }
  }
  // The DOM's delta is the opposite of the system's.
  let sx = -step.dx
  let sy = -step.dy
  guard let event = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2,
    wheel1: Int32(sy.rounded()), wheel2: Int32(sx.rounded()), wheel3: 0)
  else { continue }
  event.setIntegerValueField(.scrollWheelEventIsContinuous, value: 1)
  event.setIntegerValueField(.scrollWheelEventPointDeltaAxis1, value: Int64(sy.rounded()))
  event.setIntegerValueField(.scrollWheelEventPointDeltaAxis2, value: Int64(sx.rounded()))
  event.setDoubleValueField(.scrollWheelEventFixedPtDeltaAxis1, value: sy)
  event.setDoubleValueField(.scrollWheelEventFixedPtDeltaAxis2, value: sx)
  event.setIntegerValueField(.scrollWheelEventScrollPhase, value: step.phase)
  event.setIntegerValueField(.scrollWheelEventMomentumPhase, value: step.momentum)
  event.setIntegerValueField(.mouseEventWindowUnderMousePointer, value: window)
  event.setIntegerValueField(.mouseEventWindowUnderMousePointerThatCanHandleThisEvent, value: window)
  event.location = CGPoint(x: x, y: y)
  let now = uptimeNs()
  event.timestamp = now
  event.postToPid(pid)
  print("\(index) \(Double(now) / 1_000_000)")
}
