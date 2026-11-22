# Settings in the chat

Asked where something is, a reply gives directions: "open Settings →
Providers → Antigravity, sign in, then pick Neon". The person reads them,
leaves the chat, finds the page, then the row. A reply that talks about a
setting should hold it: a link to the place, the control itself, the
change one tap away.

## What carries it

1. **The reply names the setting; the app shows its truth.** A message
   stays one markdown string and carries which setting, never its value.
   The client reads the live value from its own store and writes through
   the path Settings writes with, under the same grants. An old reply
   stays true, the phone and a remote client work alike, and nothing new
   crosses the wire.
2. **The Cell suggests; the person's tap decides** (their choice,
   2026-11-22). Agents get no power to change settings. A reply can carry
   a suggested value; the tap applies it, and every change made in the
   chat has Undo.
3. **The words are the address.** Models already write "Settings →
   Providers → Antigravity". The app reads that path against upstream's
   own settings index, so no agent learns an id and every provider's
   replies, old ones too, link without a word of instruction.

## Slices

Each lands as its own pull request, on the Mac and the phone together.

- [x] 1. **Links.** A path to a place in Settings in a reply's prose
      becomes a chip that opens it: a row scrolls into view and pulses, a
      provider opens on its own card. The phone opens its own page for
      the place; one it has no page for stays as written.
- [ ] 2. **Cards.** A `setting` fence draws the setting as a card: its
      live control, a suggested value with Apply, Undo after. One list of
      controls replaces Aski's own switches. Forms teaches the fence.
- [ ] 3. **Provider cards.** A provider's card says whether it is on,
      whether the person is signed in (with Sign in), and which models it
      offers.
- [ ] 4. **Cells check first.** A read-only tool tells an agent what a
      setting is set to, so a reply says "you're signed in" instead of
      guessing.

## Slice 1: how a path reads

- `stemcells/settings/catalog.json` is upstream's settings index written
  out in the words the app shows (our name for upstream's, as the build
  renames it): its pages, the rows its search finds (privacy policy left
  out, as search leaves it), the providers. A web contract test writes and checks
  it, so the phone reads paths as the Mac does. Upstream adding a setting
  fails that test; run it with `STEMCELLS_WRITE_CATALOG=1` to write the
  catalog again.
- `stemcells/settings/places.ts` reads a path: "Settings", then steps
  split by `›`, `→`, `>`, `»`, `▸` or `->`, each a page, a row or a
  provider, any case, a plural "s" either way. Only prose links
  (`stemcells/words/prose.ts`, shared with Cell names): never code, an
  existing link or a URL.
- Another app's settings stay as written. "System Settings", "GitHub's
  Settings" and the like are another app's. A page other apps also have
  (General, Appearance, About…) links only when the step after it reads
  too, so "Settings → General → VPN" stays text; a page of ours alone
  (Providers, Worktrees…) links even when a deeper step doesn't read.
- The chip titles the steps as Settings does and copies as the reply's own
  words. A row's link carries its id (rows share anchors: Themes scrolls
  to Appearance's); a provider's opens its card on the chat's server.
- The phone maps the Mac's pages to its own (`chat/placeLinks.ts`), opens
  one through the app's own `settings/…` link, and has no row anchors.

## Verified (slice 1)

- `stemcells/settings/places.test.ts`: what links and what stays, the
  phone's partial map, keys read back, titles.
- `settingsCatalog.contract.test.ts`: the catalog is upstream's index;
  every place's key is one a context link carries and reads back.
- `ChatMarkdown.browser.test.tsx`: a reply's paths draw as links to the
  row and the provider's card, another app's stays, copying gives words.
- The phone: `placeLinks.test.ts` (every mapped page is a link path the
  app opens), the Hermes check over the shared reading, the type check.
- In a lab web client on Replay: both chips drew, System Settings stayed
  text, Antigravity's chip opened its card, Auto-settle's scrolled to the
  row. Not run on the phone's simulator yet.
