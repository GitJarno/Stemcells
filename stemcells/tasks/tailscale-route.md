# One scan, every way in

A phone pairs with a Mac once. Over Tailscale it then reaches the Mac at
home and away, with nothing to switch on and off. Three gaps stood in the
way after `devices.md`:

- A phone paired over Wi-Fi never learned the Mac's Tailscale address.
  Upstream's server tells every client its other addresses
  (`environment/DirectEndpoints.ts`), and the client saves them as more
  routes to the same Mac. It names the Tailscale one only behind upstream's
  own Tailscale switch, which relaunches the app; phones over Tailscale are
  ours (`tailscale/StemcellsTailscale.ts`), so the server never named it.
- Tailscale on the phone had to be turned on by hand before each use.
  Its iOS app's VPN On Demand connects by itself for a `*.ts.net` name.
- The phone's scan card sent people to `t3 pair` or desktop Connections
  settings, not to the Mac's Settings › Your devices.

Kept: our Tailscale setup over upstream's switch. Upstream's
(`setTailscaleServeEnabled`) relaunches the whole app on each change, and
any Cell at work stops; ours puts Serve up and down without a restart.

## Plan

- [x] The server names the Tailscale address while phones over Tailscale
      are on: upstream's `DirectEndpoints` over a config with its switch
      on, chosen per call by our mark (`upstream/directEndpoints.ts`, the
      one-line swap in `server.ts`, its seam row and budget).
- [x] Add a phone: VPN On Demand in Tailscale on the iPhone, said once the
      phone is on the tailnet; Wi-Fi pairing says Tailscale can come later.
- [x] The phone's scan card names Settings › Your devices (a one-line
      seam: text in a component's body). The empty home's Add environment
      already leads there, so it stays T3's.
- [x] `stemcells/docs/install.md`: the phone's way in, as above.
- [x] Checks, `drift`, `check-local`, merge.

## Review

- The server change is proved by `upstream/directEndpoints.test.ts`, which
  runs upstream's `make` for real over a faked Tailscale: the address is
  named with the mark on, and Tailscale isn't asked with it off. Without
  the wrapper the first case fails.
- `server.ts` grew one line, from 11 to 13 counted lines and 7 to 8 hunks.
  The swap passes upstream's own `make`, so its import stays in use and
  no second hunk touches the import block.
- Not seen on a device: whether a phone paired over Wi-Fi saves the address
  takes a connect after Tailscale is turned on.
