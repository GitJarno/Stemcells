# Installing Stemcells

Stemcells builds from source on your Mac and installs as
`/Applications/Stemcells.app`. One command does it:

```sh
stemcells/scripts/install-app
```

Run it from a clone of this repository. It stops before changing anything if
something is missing, and says what to do.

## What it needs

| | Why | How to get it |
| --- | --- | --- |
| macOS, Apple silicon or Intel | The app is a Mac app | — |
| Xcode Command Line Tools | Compilers for the native helpers | `xcode-select --install` |
| Node.js 24 | Runs the build | [nodejs.org](https://nodejs.org), or `brew install node@24` |
| pnpm | Installs dependencies | `corepack enable pnpm` |
| Rust | Builds the app's small resource monitor | [rustup.rs](https://rustup.rs), then `rustup target add aarch64-apple-darwin` (Apple silicon) or `x86_64-apple-darwin` (Intel) |
| About 5 GB free | Dependencies and the build | — |

You also need at least one coding CLI signed in, for example Claude Code
(`claude auth login`) or Codex (`codex login`). Stemcells runs the ones it
finds with your own accounts.

## What it does

1. Checks the list above.
2. With `--pull`, updates the checkout to the latest `main` first.
3. Installs dependencies exactly as locked (`pnpm install --frozen-lockfile`).
4. Builds the app for your Mac's processor.
5. Quits a running Stemcells, moves the old copy to the Trash, and puts the
   new one in `/Applications` (or the folder given with `--to`).
6. Opens it.

It only replaces an app that is Stemcells (bundle id `sh.stemcells.app`).
If `/Applications/Stemcells.app` is some other app, it stops and asks you
to move it.

## Updating

```sh
stemcells/scripts/install-app --pull
```

The build is unsigned, so the app updates only this way: it has no
automatic updater.

## Where it keeps things

| | |
| --- | --- |
| Chats, settings and state | `~/.stemcells` |
| Window and browser data | `~/Library/Application Support/sh.stemcells.app` |

It never touches T3 Code's data (`~/.t3`), so both can be installed side by
side.

## For coding agents

Run `stemcells/scripts/install-app` from the repository root. When it exits
non-zero, its last lines name the missing piece and the command that fixes
it. Ask the person before installing a toolchain (Node, pnpm, Rust, Xcode
tools) on their machine. Don't pass `--force` unless they agree to replace a
different app at `/Applications/Stemcells.app`.
