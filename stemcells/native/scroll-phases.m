// macOS's own phases for trackpad scrolls, which DOM wheel events lack: when
// the fingers touch, move and lift, and when the system's coast (momentum)
// runs after them. An NSEvent local monitor in the app's main process sees
// each scroll event before any window does, and hands its time and phases
// to a JavaScript callback.
//
// A Node-API addon. The few Node-API calls it makes are declared below
// (Node-API's ABI is stable), so it builds with the system's compiler alone:
// stemcells/scripts/build-scroll-phases.

#import <AppKit/AppKit.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct napi_env__ *napi_env;
typedef struct napi_value__ *napi_value;
typedef struct napi_callback_info__ *napi_callback_info;
typedef struct napi_threadsafe_function__ *napi_threadsafe_function;
typedef int napi_status;
typedef napi_value (*napi_callback)(napi_env, napi_callback_info);
typedef void (*napi_finalize)(napi_env, void *, void *);
typedef void (*napi_threadsafe_function_call_js)(napi_env, napi_value, void *, void *);
enum { napi_ok = 0 };
enum { napi_tsfn_release = 0 };
enum { napi_tsfn_nonblocking = 0 };

extern napi_status napi_get_cb_info(napi_env, napi_callback_info, size_t *, napi_value *,
                                    napi_value *, void **);
extern napi_status napi_create_function(napi_env, const char *, size_t, napi_callback, void *,
                                        napi_value *);
extern napi_status napi_set_named_property(napi_env, napi_value, const char *, napi_value);
extern napi_status napi_create_string_utf8(napi_env, const char *, size_t, napi_value *);
extern napi_status napi_create_double(napi_env, double, napi_value *);
extern napi_status napi_get_undefined(napi_env, napi_value *);
extern napi_status napi_call_function(napi_env, napi_value, napi_value, size_t, const napi_value *,
                                      napi_value *);
extern napi_status napi_create_threadsafe_function(napi_env, napi_value, napi_value, napi_value,
                                                   size_t, size_t, void *, napi_finalize, void *,
                                                   napi_threadsafe_function_call_js,
                                                   napi_threadsafe_function *);
extern napi_status napi_call_threadsafe_function(napi_threadsafe_function, void *, int);
extern napi_status napi_release_threadsafe_function(napi_threadsafe_function, int);
extern napi_status napi_unref_threadsafe_function(napi_env, napi_threadsafe_function);
extern napi_status napi_throw_error(napi_env, const char *, const char *);

/** One scroll event, on its way to JavaScript. */
typedef struct {
  double time;
  double phase;
  double momentum;
  double window;
  double dx;
  double dy;
} Scroll;

static id monitor = nil;
static napi_threadsafe_function delivery = NULL;

/** On the JavaScript thread: callback(time, phase, momentum, window, dx, dy, now), times in seconds since the system started. */
static void deliver(napi_env env, napi_value callback, void *context, void *data) {
  (void)context;
  Scroll *scroll = data;
  if (env != NULL && callback != NULL) {
    double values[7] = {scroll->time, scroll->phase, scroll->momentum, scroll->window,
                        scroll->dx, scroll->dy, [[NSProcessInfo processInfo] systemUptime]};
    napi_value args[7];
    bool made = true;
    for (int i = 0; i < 7; i++) made = made && napi_create_double(env, values[i], &args[i]) == napi_ok;
    napi_value receiver;
    if (made && napi_get_undefined(env, &receiver) == napi_ok) {
      napi_call_function(env, receiver, callback, 7, args, NULL);
    }
  }
  free(scroll);
}

static void stopMonitor(void) {
  if (monitor != nil) {
    [NSEvent removeMonitor:monitor];
    monitor = nil;
  }
  if (delivery != NULL) {
    napi_release_threadsafe_function(delivery, napi_tsfn_release);
    delivery = NULL;
  }
}

/** start(callback): calls back with every phased scroll event the app receives, until stop(). */
static napi_value start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value callback = NULL;
  if (napi_get_cb_info(env, info, &argc, &callback, NULL, NULL) != napi_ok || argc < 1) {
    napi_throw_error(env, NULL, "start needs a callback");
    return NULL;
  }
  stopMonitor();
  napi_value name;
  napi_create_string_utf8(env, "stemcells-scroll-phases", (size_t)-1, &name);
  if (napi_create_threadsafe_function(env, callback, NULL, name, 0, 1, NULL, NULL, NULL, deliver,
                                      &delivery) != napi_ok) {
    delivery = NULL;
    napi_throw_error(env, NULL, "could not set up delivery");
    return NULL;
  }
  // Delivery never keeps the process alive on its own.
  napi_unref_threadsafe_function(env, delivery);
  napi_threadsafe_function target = delivery;
  monitor = [NSEvent
      addLocalMonitorForEventsMatchingMask:NSEventMaskScrollWheel
                                   handler:^NSEvent *(NSEvent *event) {
                                     // A mouse wheel has no phases: only a trackpad's events go.
                                     if (event.phase == NSEventPhaseNone &&
                                         event.momentumPhase == NSEventPhaseNone) {
                                       return event;
                                     }
                                     Scroll *scroll = malloc(sizeof(Scroll));
                                     if (scroll == NULL) return event;
                                     *scroll = (Scroll){
                                         .time = event.timestamp,
                                         .phase = (double)event.phase,
                                         .momentum = (double)event.momentumPhase,
                                         .window = (double)event.windowNumber,
                                         .dx = event.scrollingDeltaX,
                                         .dy = event.scrollingDeltaY,
                                     };
                                     if (napi_call_threadsafe_function(
                                             target, scroll, napi_tsfn_nonblocking) != napi_ok) {
                                       free(scroll);
                                     }
                                     return event;
                                   }];
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

/** now(): the system's clock, the one scroll events are timed by (seconds since it started). */
static napi_value now(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value result = NULL;
  napi_create_double(env, [[NSProcessInfo processInfo] systemUptime], &result);
  return result;
}

/** stop(): no more callbacks. */
static napi_value stop(napi_env env, napi_callback_info info) {
  (void)info;
  stopMonitor();
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

__attribute__((visibility("default"))) int32_t node_api_module_get_api_version_v1(void) {
  return 8;
}

__attribute__((visibility("default"))) napi_value napi_register_module_v1(napi_env env,
                                                                           napi_value exports) {
  napi_value fn;
  if (napi_create_function(env, "start", (size_t)-1, start, NULL, &fn) == napi_ok) {
    napi_set_named_property(env, exports, "start", fn);
  }
  if (napi_create_function(env, "stop", (size_t)-1, stop, NULL, &fn) == napi_ok) {
    napi_set_named_property(env, exports, "stop", fn);
  }
  if (napi_create_function(env, "now", (size_t)-1, now, NULL, &fn) == napi_ok) {
    napi_set_named_property(env, exports, "now", fn);
  }
  return exports;
}
