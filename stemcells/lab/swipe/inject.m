// Lab rig: posts phased trackpad scroll events inside the lab app's own process (its event
// queue, not the system's), so they reach only the lab's hidden window. A Node-API addon, built
// like stemcells/native/scroll-phases.m.
//
//   post(path): reads "window x y" then "at_ms dx dy phase momentum" lines (DOM-sense deltas,
//   CoreGraphics' phase codes) and posts each at its time; writes "<path>.out" with one
//   "index uptime_ms" line per event once the last has gone.
#import <AppKit/AppKit.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>

typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef int napi_status;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
enum { napi_ok = 0 };
extern napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *, napi_value *, void **);
extern napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *, napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
extern napi_status napi_get_value_string_utf8(napi_env, napi_value, char *, size_t, size_t *);
extern napi_status napi_get_undefined(napi_env, napi_value *);

typedef struct { double at, dx, dy; long long phase, momentum; double posted; } Step;

static double uptimeMs(void) { return (double)clock_gettime_nsec_np(CLOCK_UPTIME_RAW) / 1e6; }

static void postStep(Step *step, long long window, double x, double y, int heard) {
  double sx = -step->dx, sy = -step->dy;
  CGEventRef cg = CGEventCreateScrollWheelEvent2(NULL, kCGScrollEventUnitPixel, 2, (int32_t)lround(sy), (int32_t)lround(sx), 0);
  if (cg == NULL) return;
  CGEventSetIntegerValueField(cg, kCGScrollWheelEventIsContinuous, 1);
  CGEventSetIntegerValueField(cg, kCGScrollWheelEventPointDeltaAxis1, (int64_t)lround(sy));
  CGEventSetIntegerValueField(cg, kCGScrollWheelEventPointDeltaAxis2, (int64_t)lround(sx));
  CGEventSetDoubleValueField(cg, kCGScrollWheelEventFixedPtDeltaAxis1, sy);
  CGEventSetDoubleValueField(cg, kCGScrollWheelEventFixedPtDeltaAxis2, sx);
  CGEventSetIntegerValueField(cg, kCGScrollWheelEventScrollPhase, step->phase);
  CGEventSetIntegerValueField(cg, kCGScrollWheelEventMomentumPhase, step->momentum);
  // Field 51 is the event's window number, as NSEvent reads it (found by trying each field).
  CGEventSetIntegerValueField(cg, (CGEventField)51, window);
  CGEventSetIntegerValueField(cg, kCGMouseEventWindowUnderMousePointer, window);
  CGEventSetIntegerValueField(cg, kCGMouseEventWindowUnderMousePointerThatCanHandleThisEvent, window);
  CGEventSetLocation(cg, CGPointMake(x, y));
  // With field 58 set, NSEvent works the place in the window out from the place on screen
  // (found by trying each field); without it the event sits outside its window.
  CGEventSetIntegerValueField(cg, (CGEventField)146, 77);
  CGEventSetTimestamp(cg, clock_gettime_nsec_np(CLOCK_UPTIME_RAW));
  NSEvent *event = [NSEvent eventWithCGEvent:cg];
  step->posted = uptimeMs();
  step->posted = uptimeMs();
  static int inspected = 0;
  if (!inspected && event.window != nil) {
    inspected = 1;
    NSWindow *w = event.window;
    NSView *content = w.contentView;
    NSView *hit = [content.superview hitTest:event.locationInWindow] ?: [content hitTest:event.locationInWindow];
    NSLog(@"[lab inject] window visible %d ignores %d content %@ hit %@ frame %@", w.isVisible, w.ignoresMouseEvents, content.class, hit.class, NSStringFromRect(w.frame));
    for (NSView *v = hit; v != nil; v = v.superview) NSLog(@"[lab inject]   chain %@ hidden %d", v.class, v.isHidden);
  }
  static int logged = 0;
  if (logged++ < 1) {
    NSLog(@"[lab inject] event %@ type %ld windowNumber %ld window %@ phase %lu loc %@", event == nil ? @"nil" : @"ok", (long)event.type, (long)event.windowNumber, event.window, (unsigned long)event.phase, NSStringFromPoint(event.locationInWindow));
  }
  if (event == nil) { CFRelease(cg); return; }
  // The app's own dispatch first, so its event monitors (the scroll phases) hear it as they
  // would; the lab's window is hidden and ignores the mouse, so AppKit stops there, and the
  // view under the point is handed the event as its window would have.
  if (heard) [NSApp sendEvent:event];
  NSWindow *target = event.window;
  NSView *content = target.contentView;
  NSView *hit = [content.superview hitTest:event.locationInWindow] ?: [content hitTest:event.locationInWindow];
  [hit scrollWheel:event];
  CFRelease(cg);
}

static napi_value post(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value arg = NULL;
  napi_value result;
  napi_get_undefined(env, &result);
  char path[2048];
  size_t length = 0;
  if (napi_get_cb_info(env, info, &argc, &arg, NULL, NULL) != napi_ok || argc < 1) return result;
  if (napi_get_value_string_utf8(env, arg, path, sizeof path, &length) != napi_ok) return result;
  NSString *file = [NSString stringWithUTF8String:path];
  NSString *text = [NSString stringWithContentsOfFile:file encoding:NSUTF8StringEncoding error:nil];
  if (text == nil) return result;
  NSArray<NSString *> *rows = [text componentsSeparatedByString:@"\n"];
  long long window = 0;
  double x = 0, y = 0;
  int heard = 1;
  sscanf(rows[0].UTF8String, "%lld %lf %lf %d", &window, &x, &y, &heard);
  size_t count = 0;
  Step *steps = calloc(rows.count, sizeof(Step));
  for (NSUInteger i = 1; i < rows.count; i++) {
    Step step = {0};
    if (sscanf(rows[i].UTF8String, "%lf %lf %lf %lld %lld", &step.at, &step.dx, &step.dy, &step.phase, &step.momentum) == 5) steps[count++] = step;
  }
  if (count == 0) { free(steps); return result; }
  dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, DISPATCH_TIMER_STRICT, dispatch_get_main_queue());
  uint64_t base = clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
  __block size_t next = 0;
  dispatch_source_set_event_handler(timer, ^{
    uint64_t now = clock_gettime_nsec_np(CLOCK_UPTIME_RAW);
    while (next < count && base + (uint64_t)(steps[next].at * 1e6) <= now + 200000) {
      postStep(&steps[next], window, x, y, heard);
      next++;
    }
    if (next < count) {
      uint64_t due = base + (uint64_t)(steps[next].at * 1e6);
      uint64_t wait = due > now ? due - now : 0;
      dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, (int64_t)wait), DISPATCH_TIME_FOREVER, 0);
      return;
    }
    dispatch_source_cancel(timer);
    NSMutableString *out = [NSMutableString string];
    for (size_t i = 0; i < count; i++) [out appendFormat:@"%zu %.3f\n", i, steps[i].posted];
    [out writeToFile:[file stringByAppendingString:@".out"] atomically:YES encoding:NSUTF8StringEncoding error:nil];
    free(steps);
  });
  dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(steps[0].at * 1e6)), DISPATCH_TIME_FOREVER, 0);
  dispatch_resume(timer);
  return result;
}

__attribute__((visibility("default"))) napi_value napi_register_module_v1(napi_env env, napi_value exports) {
  napi_value fn;
  if (napi_create_function(env, "post", (size_t)-1, post, NULL, &fn) == napi_ok) napi_set_named_property(env, exports, "post", fn);
  return exports;
}
