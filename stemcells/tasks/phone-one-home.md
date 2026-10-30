# The phone has one home

The person, 2026-10-30, for the third time: after an update the phone's home read Asleep,
Active, Flying and Input again, where it should read Needs you, Flying, Landed and Settled.

## Why it kept coming back

Nothing was reverted. The phone carried two homes: the line, and the four tabs from before it,
for a machine that "has no line". The home showed the four tabs whenever every machine in view
read `none`, and `readNeeds` said `none` for a connection without a bearer token.

T3's saved connection carries its token only while a route is connected
(`state/remote-environment-projections.ts` reads it off the prepared connection, and
`EnvironmentSupervisor` clears that on every attempt). So on each launch, each return to the
front, a Mac's restart (an app install) or a switch between Wi-Fi and Tailscale, every machine
read `none` for a moment, and the four tabs took the home. Nothing read a machine again once its
token came back, so they stayed until the next minute or the next change in a chat.

Each earlier fix (#360, #364) narrowed when the four tabs showed and left them, and the
misreading, in place.

## Decisions

1. A connection without its token yet is out of reach, not without the line: what its machine
   said last stands (`line/read.ts`).
2. A machine is read again as soon as its token, address or route changes (`line/readings.ts`).
3. The four-tab home goes. A machine that hasn't answered, or has no line (T3's own server),
   stands its Cells where their own records do, as `lineOf` already did for one asleep. There is
   nothing left to fall back to.

## Plan

- [x] Failing test: a connection without a token reads as out of reach (`line/read.test.ts`)
- [x] `readNeeds` keeps the last list; `useKeepReading` reads on a changed connection
- [x] Remove `lineApplies`, the `Tabs` home, `HOME_TABS` and `countsOf`
- [x] `seams.md`, tests, typecheck, lint, drift
- [ ] Phone build from main, installed
