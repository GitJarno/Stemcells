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
      unused link back on close. Without a route it offers Network access
      (one restart).
- [x] The tailnet IP over Tailscale Serve: with Network access on, the
      desktop app lists the Mac's Tailscale address, and the phone app
      speaks plain HTTP inside Tailscale's tunnel (`NSAllowsArbitraryLoads`,
      Android cleartext). No Serve, no HTTPS certificates, no admin console:
      the dead end "Tailscale isn't answering" is gone. The routes refresh
      when the window regains focus, so starting Tailscale moves the code
      to the tailnet.
- [x] Computer: upstream's Add environment dialog, unchanged.
- [x] Only `upstream/devices.ts` imports upstream; a contract test pins
      the code's URL: this machine's own `/pair`, with the token upstream's
      shared parser (the phone's too) reads back.
- [x] Seams: the route file renamed, the route tree regenerated, both in
      `seams.md`. No upstream file changes otherwise.
- [ ] Checks: typecheck, lint, the tests beside the change, drift,
      check-local; merge.
