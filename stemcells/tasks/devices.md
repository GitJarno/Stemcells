# Devices

A person with two Macs and a phone wants to control every Mac from every
device. Upstream's model already does it: each Mac is an environment, each
app keeps a list of them and reaches each one over its best route. The
routes are the local network, Tailscale, SSH and T3 Connect. T3 Connect runs
on T3's cloud (its sign-in, its relay, its tunnels), so Stemcells uses
Tailscale, which upstream supports without it: one switch on the desktop,
the server behind `tailscale serve`, and HTTPS on the Mac's MagicDNS name.
What's missing is the door: pairing a phone takes Network access, a
restart, Tailscale HTTPS, another restart, Create link, the permissions
form, then Share.

Settings › Devices is the door, our page beside upstream's Connections,
which stays untouched for the details: Connections changes almost daily
upstream, so a section inside it would conflict at most syncs.

## Plan

- [x] Settings › Devices replaces Settings › Linked machines: one list of
      the person's devices (the computers this app reaches, then the
      phones, browsers and computers that reach this one), each with
      Remove; a Cells switch on a computer for what Linked machines did;
      an Add with "Phone or tablet" and "Computer"; a link to Connections.
- [x] Phone or tablet: picks this computer's address for a phone
      (Tailscale HTTPS, then its Tailscale IP, then the local network;
      only Tailscale HTTPS while Network access is off; never loopback,
      never T3's hosted app), mints a one-time link with the standard
      permissions, shows its QR, says "Paired" once the link is used by a
      device that isn't the command line's or an agent's, and takes an
      unused link back on close.
- [x] Over Tailscale, set up for the person (`apps/server/src/stemcells/tailscale/`).
      The server stays on loopback and Tailscale Serve answers for it on
      the tailnet with HTTPS: no Network access, no restart, nothing
      listening on a café's Wi-Fi, and an address that works away from
      home. (#276 had pointed phones at the tailnet IP over Network
      access instead; that opened the server on every network the laptop
      joins and sent a Wi-Fi pairing's token in the clear.) The dialog
      walks Tailscale on this computer → HTTPS for the tailnet → this
      computer on the tailnet, taking each step itself: it opens the app
      and flips its switch (`tailscale up`), sends a sign-in under way
      straight to the browser, takes the one-click page `tailscale serve`
      names when the tailnet lacks HTTPS (the only click that's the
      person's, once per tailnet), and puts Serve in front without a
      restart. Once on, a mark in our state folder keeps it on: Serve
      comes back after a restart and whenever Tailscale returns, and
      comes down when the server stops. Settings › Devices shows it with
      Turn off. Upstream's own Tailscale HTTPS switch (Connections) still
      serves on start when it's on; Turn off doesn't change that switch.
- [x] Wi-Fi only stays for a person without Tailscale: Network access
      (one restart), the local network address.
- [x] Computer: upstream's Add environment dialog, unchanged.
- [x] Only `upstream/devices.ts` imports upstream; a contract test pins
      the code's URL: this machine's own `/pair`, with the token upstream's
      shared parser (the phone's too) reads back.
- [x] Seams: the route file renamed, the route tree regenerated, both in
      `seams.md`. No upstream file changes otherwise.
- [ ] Checks: typecheck, lint, the tests beside the change, drift,
      check-local; merge.
