# Installing Stemcells

Stemcells builds from source on your Mac and installs as
`/Applications/Stemcells.app`. One command does it:

```sh
stemcells/scripts/install-app
```

Run it from a clone of this repository. It stops before changing anything if
something is missing, and says what to do.

## What it needs

|                               | Why                                     | How to get it                                                                                                                  |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| macOS, Apple silicon or Intel | The app is a Mac app                    | —                                                                                                                              |
| Xcode Command Line Tools      | Compilers for the native helpers        | `xcode-select --install`                                                                                                       |
| Node.js 24                    | Runs the build                          | [nodejs.org](https://nodejs.org), or `brew install node@24`                                                                    |
| pnpm                          | Installs dependencies                   | `corepack enable pnpm`                                                                                                         |
| Rust                          | Builds the app's small resource monitor | [rustup.rs](https://rustup.rs), then `rustup target add aarch64-apple-darwin` (Apple silicon) or `x86_64-apple-darwin` (Intel) |
| About 5 GB free               | Dependencies and the build              | —                                                                                                                              |

You also need at least one coding CLI signed in, for example Claude Code
(`claude auth login`) or Codex (`codex login`). Stemcells runs the ones it
finds with your own accounts.

## What it does

1. Checks the list above.
2. With `--pull`, updates the checkout to the latest `main` first, then
   carries on with the updated script.
3. Installs dependencies exactly as locked (`pnpm install --frozen-lockfile`).
4. Builds the app for your Mac's processor, with the small addon that
   reads the trackpad's own phases for the tab swipe
   (`stemcells/scripts/build-scroll-phases`). It stops if the built app
   lacks the addon. The build carries its release's version at a release
   tag, and a nightly one (`0.1.1-nightly.20261023.7266`) anywhere else.
5. Waits for a `check-local` run in progress, since quitting would end it,
   and holds off the next one. Then it copies the new app into
   `/Applications` (or the folder given with `--to`) beside the old one,
   quits a running Stemcells, moves the old copy to the Trash and puts the
   new one in its place. If the copy fails, the old app stays.
6. Opens it, and records the repository it came from, so the app can
   update itself from there.

Run from inside Stemcells (a Cell, or the app's terminal), the script would
end with the app: when the app quits for the swap, or sooner, when its
server restarts mid-build. There it goes on as a process of its own, prints
that process's id (to call it off with `kill`) and returns at once. Once
it's built, the app quits, updates and opens again, and a notification says
how it went.

It only replaces an app that is Stemcells (bundle id `sh.stemcells.app`).
If `/Applications/Stemcells.app` is some other app, it stops and asks you
to move it.

## Updating

Once installed, Stemcells updates itself from that repository. When there's
an update, the left column says **Stemcells gets better** above its foot,
with how many changes it brings; hovering or clicking it lists them, a day
at a time: each merged pull request's title and number. **Download** gets
the update ready (it builds it, while you keep working); **Restart to
update** restarts into it. A restart ends every Cell's turn, so it's always
your click. With the column narrowed to its rail, or showing all chats, the
update button at its foot does the same.

Settings › About › Update track picks what to follow: **Nightly**, every
change merged to `main`, or **Stable**, the newest release (a `v*` tag).
A build of `main` follows Nightly, and a release's build, Stable, until
you pick. If an update builds but doesn't go in, the old app opens again and
offers it once more; the build's output is in
`~/Library/Application Support/sh.stemcells.app/updates/build.log`.

From a terminal, `stemcells/scripts/install-app --pull` does the same in
one go.

## Where it keeps things

|                                                                     |                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| Chats, settings and state                                           | `~/.stemcells`                                   |
| Window and browser data                                             | `~/Library/Application Support/sh.stemcells.app` |
| Whether the swipe reads the trackpad's phases, as of the last start | `stemcells-scroll-phases.log` in that folder     |

It never touches T3 Code's data (`~/.t3`), so both can be installed side by
side.

## Your phone and other computers

Settings › Devices lists your devices: the computers this app reaches, and
the phones, browsers and computers that reach this one. Each computer
running Stemcells is its own environment, and every app (the desktop app,
the phone app, a browser) can reach several of them. They reach each other
through Tailscale, at home and away, and nothing goes through anyone's
cloud. T3 Connect, T3 Code's own way, runs on T3's servers and is off in
Stemcells.

1. Install Tailscale on your phone, signed in to the account your
   computers use.
2. On each computer, open **Settings › Devices › Add › Phone or tablet**.
   Stemcells sets up Tailscale step by step: it starts Tailscale, opens
   its sign-in, and the first time on a tailnet opens Tailscale's page to
   turn on HTTPS, where you confirm once. Nothing restarts.
3. In Stemcells on your phone, scan the code. Each computer needs one scan.
   The dialog ticks once your phone is on your tailnet; until then a scan
   can't reach the computer, and it names the account to sign in with.
4. To reach one computer from another, choose **Copy link** in step 2 on
   the computer you want to reach, then **Add › Computer** on the one
   you're at, and paste it. Its **Cells** switch lets the two computers'
   Cells see each other.

**Remove** takes a device's access away, or forgets a computer on this
device; **Turn off** beside **Over Tailscale** stops phones reaching the
computer at all. Without Tailscale, **Wi-Fi only** pairs a phone on the same
Wi-Fi, after one restart.

### Notifications on your phone

When a Cell has waited on you for two minutes and nobody is at your
computer, your phone can hear of it, and a tap opens the Cell. The push goes
from your computer straight to Apple with a key of your own; nothing goes
through anyone else's service. It takes a paid Apple Developer account, once:

1. In your Apple Developer account, under Certificates, Identifiers &
   Profiles, register an App ID of your own (such as `com.example.cells`)
   with Push Notifications on. Under Keys, create a key with the Apple Push
   Notifications service, download its `.p8` file (Apple lets you download
   it once), and note its Key ID and your Team ID.
2. On each computer you want to hear from, open **Settings › Aski › Your
   phone › Add key** and give it the Key ID, Team ID and `.p8` file. The key
   stays on that computer.
3. Build the phone app under your team, with your iPhone connected and
   Xcode signed in to your Apple account. Xcode registers the app's
   extensions and app group under your team on the first build.

   ```
   cd apps/mobile
   STEMCELLS_IOS_TEAM_ID=<Team ID> STEMCELLS_IOS_BUNDLE_ID=<App ID> pnpm run ios:release -- --device
   ```

4. In Stemcells on your phone, tap **Settings › When a Cell needs you** and
   allow notifications. Each computer then lists your phone under **Your
   phone**, where **Send a test** checks the whole way.

Turning notifications off for Stemcells in the phone's iOS Settings stops
them; **Remove** beside a phone on a computer forgets it until the phone's
app next opens.

## For coding agents

Run `stemcells/scripts/install-app` from the repository root. When it exits
non-zero, its last lines name the missing piece and the command that fixes
it. Ask the person before installing a toolchain (Node, pnpm, Rust, Xcode
tools) on their machine. Don't pass `--force` unless they agree to replace a
different app at `/Applications/Stemcells.app`.

Inside Stemcells, the script returns at once and builds on its own; once
it's built, the app restarts, which ends your turn and every other Cell's.
Say so before you run it. Rather than run it, you can point the person at
the update button, which restarts only when they click.
