// What our browser tests take from upstream: its render helper, which owns
// the React root and unmounts it when the test ends, and its fake timers for
// one test, the full set its lint asks for.

export { act, fakeTimers, render } from "../../../test/render";
