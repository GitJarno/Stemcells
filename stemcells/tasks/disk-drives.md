# Disk: every drive, seen at a glance

Settings › Disk said how full one disk was in a sentence and a thin bar, and
listed the rest. Nothing showed a drive plugged in, or a drive on another
machine, and only the machine in front of you got its "What's large".

## What a person wants from this page

Am I fine? How much room is left? What's taking it? What could come back? And
across everything I own, where is there room? In that order.

## The picture: a drive as a field of Cells

| Form                      | For                                                                                                                | Against                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Thin bar (before)         | Exact, small                                                                                                       | Says one number; nothing to explore                                                                                   |
| Treemap (the earlier app) | Dense, hierarchical                                                                                                | Hard to compare areas; its largest tile is "not measured"; layout jumps when sizes change; free space reads as a hole |
| Sunburst                  | Striking                                                                                                           | Angles read worst; small arcs vanish; needs a square                                                                  |
| Platter of rings          | Says "disk"                                                                                                        | A metaphor most drives have outgrown; poor hit targets                                                                |
| **Field of Cells**        | A stacked bar you can count; made of what Stemcells is made of; every cell a hit target; the same form at any size | Needs a canvas to stay cheap at hundreds of cells                                                                     |

The field won. One cell is about 1 GB on this Mac (a nice unit, so a drive
stays near 600 cells at any size). Bands fill left to right: what's measured,
biggest first, then what wasn't, then what's free. What's free wears the
headline's colour and is the lightest thing there, so the eye goes from the word
to the room.

Motion is the brand's: the cells shuffle and lock in a wave, the figure with
them, once, and then nothing moves. A cell's colour changing later lands the same
way. Hovering lights a band and names the folder under the pointer; hovering what
could come back hollows those cells and shows the figure it would reach.

Colours: five hues checked for colour blindness on every pair, because bands sort
by size and any two can touch. Amber, red and green stay with the status.

## Reaching drives and machines

Reading the drives on a machine:

| Option                                              | For                                                                                  | Against                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `fs.statfs` on each mount                           | No process                                                                           | Runs on libuv's thread pool: one hung drive can starve the server's file system |
| `df` plus `diskutil`, each a process with a timeout | A hang costs one killable process; no file touched, so no privacy prompt and no wake | One short-lived process a few seconds apart, only while someone looks           |
| `fs.watch("/Volumes")`                              | Instant                                                                              | More machinery for what a 10 s poll already shows                               |

Reaching another machine:

| Option                                                    | For                                                                                | Against                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Grow `server.getHostResources`                            | Every transport carries it                                                         | Upstream's snapshot, polled for other reasons, grows; a map is too much for it                 |
| A new WebSocket RPC                                       | Upstream's own way                                                                 | Seams in `rpc.ts`, `ws.ts` and the client runtime, on each nightly sync                        |
| The peer link between servers                             | A client needs only one machine                                                    | Widens a link kept narrow on purpose, and acts for a client that can already reach the machine |
| **That machine's HTTP, from the client's own connection** | No seam; its token and its scopes decide; nothing leaves the person's own machines | A relay or SSH machine shows only its snapshot's figure                                        |

## Safe by construction

- Knowing how full a drive is reads none of its files.
- Looking inside is the person's choice, per drive, by volume UUID: a different
  drive with the same name inherits nothing. Choosing needs operate scope;
  reading needs read scope. It can be undone, and undoing forgets what was seen.
- A client names a drive by the id the list gave it. No path crosses the wire,
  and a drive with no UUID can't be opened, since a device name gets reused.
- `du` runs one drive at a time at low priority, stays on that volume, doesn't
  follow links, and stops when nobody is looking.
- Folder names on a drive are someone else's text: never handed to a Cell, and
  rendered as text.
- Network shares stay out: a dead one hangs whoever asks.

## Plan

- [x] Server: `drives.ts` parsers, `StemcellsDrives`, three routes, tests.
- [x] Web: `field.ts`, painter, hero, shelf, the page for any drive of any machine.
- [x] Real client, two servers: tiles, map and measure over the second machine's
      own HTTP, and "Not connected" when it goes away. 0 frames asked at rest.
- [ ] Phone: its Disk page keeps listing machines. Drives and the field come next.

## Review

Landed as planned, apart from the phone, which is next. An independent review
before landing found what the happy path hid, each fixed with a test where a test
could fail: looking at a roomy drive could clear the startup disk's hidden notice;
a drive too big for one walk was walked for as long as it stayed open; a measurement
bigger than its disk shrank the free band away from the headline; and a tiny drive
drew a field taller than the page.

A process stuck on a failing disk outlives its kill, and Effect's timeouts wait for
it. Nothing detaches it, on purpose: the list's cache already makes that one stuck
process and a stale shelf, not a pile-up, and the startup disk's own route is
untouched. Only closing a drive doesn't wait, so the person's answer stands.

Not proven: `du` on a real external (macOS would ask on the person's screen; it ran
on temporary folders) and a real second Mac (a second local server stood in).
