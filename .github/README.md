# Stemcells

Stemcells is a Mac app for working with many coding agents at once. Each chat
is a **Cell**, with a small creature that shows what it's doing and a "?" when
it needs you. You talk to **Aski**, who finds, reads, starts and steers the
Cells for you, across all your projects.

- **Tabs and panes.** Keep many Cells open: ⌘T for a new Cell in the tab,
  ⌘D to put one beside, ⌘⇧D to stack one below, + for a new tab, drag
  tabs to reorder.
- **Aski.** Ask "what did the design session in my web project decide?" or
  "tell the billing one to use the new tokens", and Aski reads the right
  Cell or passes your words to it unchanged.
- **Your own plans.** Cells run on the coding CLIs you already use (Claude
  Code, Codex and others), signed in with your own accounts.
- **Disk.** Settings › Disk shows what's filling your disk, and hands a
  cleanup to a Cell that removes only what you approve.
- **No telemetry.** Stemcells sends nothing about you anywhere.

## Install

On a Mac with Apple silicon or Intel:

```sh
git clone <this repository's URL> Stemcells
cd Stemcells
stemcells/scripts/install-app
```

The script checks what it needs first and says how to get anything missing.
[stemcells/docs/install.md](../stemcells/docs/install.md) has the details,
and works as instructions for a coding agent too: point it there.

## Built on T3 Code

Stemcells is a fork of [T3 Code](https://github.com/pingdotgg/t3code) (MIT),
which supplies the engine: providers, threads, the server and remote access.
Stemcells takes its updates every night and adds its own layer on top.
[stemcells/docs/fork.md](../stemcells/docs/fork.md) explains how the two
stay together, and [README.md](../README.md) is T3 Code's own readme.

## Contributing

Agents and people alike: start with
[stemcells/AGENTS.md](../stemcells/AGENTS.md).
