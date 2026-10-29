<pre align="center">
                   stemcellsst
                emcellsstemcellss
              temcellsstemcellsstem
             cellsstemcellsstemcellsstemc
            ellsstemcel    lsste     mcells
       stemcellsstemcel      lss     temcell
    sstemcellsstemcellss   temcel   lsstemcel
  lsstemcellsstemcellss   temcel  lsstemcells
  stemcellsstemcellsste mcellsst emcellsstem
 cellsstemcellsstemcel lsstemcellsstemcells
 stemcellsstemcellsstemcellsstemcellsstem
  cellsstemcellsstemcellsstemcellsstemcell
   sstemcellsstemcellsstemcellsstemcellsste
     mcellsstemcellsstemcellsstemcellsstemce
      llsstemcellsstemcellsstemcellsstemcell
      sstemcellsstemcellsstemcellsstemcells
       stemcellsstemcellsstemcellsstemcell
        sstemcellsstemc ellsstemcellsstem
           cellsstem       cellsstemce
</pre>

<h1 align="center">Stemcells</h1>

<p align="center"><b>Words become things.</b></p>

<p align="center">
  A Mac app for coding agents. Talk to one. Run many.<br>
  <a href="https://stemcells.sh">stemcells.sh</a> · <a href="#get-it">Get it</a> · <a href="#how-it-works">How it works</a>
</p>

---

You type a sentence, and an agent makes the thing it describes: an app, a
fix, a page, a feature. The code isn't the hard part anymore. What runs out
is you: your attention, your context, the tabs you keep checking.

Stemcells is built on one promise: **nothing between the idea and the
thing.** You tell **Aski** what you want. Aski divides the work into
**Cells**, coding agents that each take a part, keeps them moving, and
brings back only what needs you.

## How it works

**Talk to one. Run many.** Aski is the one you talk to. It starts Cells,
reads them, steers them and answers for them, across all your projects.
Ask "what did the design session decide?" or "tell the billing one to use
the new tokens", and Aski finds the right Cell. Aski holds the whole crew in
its head, so your head stays clear.

**Cells do the work.** Every chat is a Cell: one agent, one job, with a
small creature of its own that shows what it's doing. A Cell is _Flying_
while it works, _Needs you_ when it waits on your word, _Landed_ when it's
done. Keep many open: tabs, panes, ⌘T for a new one, ⌘D to put one beside.

**Grow your agents.** A frontier model is pluripotent. Give it a repo, a
brief, tests and memory, and it becomes a builder, a reviewer, a
researcher: whatever its niche asks for, like a stem cell. Stemcells tends
that niche and sends each Cell the right work, so month by month your Cells
go longer without you.

**Only what needs you.** When a Cell falls short, it waits for your word,
and Aski brings you the question, on your Mac or your phone. Everything else
keeps flying.

**Bring your own agents.** Cells run on the coding CLIs you already use,
Claude Code, Codex, Cursor, OpenCode and more, signed in with your own
accounts on your own machine. Your phone and your other computers reach it
over your own Tailscale network (the iPhone app builds from this repository
too). Nothing goes through anyone's cloud, and
Stemcells sends nothing about you anywhere: no telemetry, no analytics, no
crash reports.

## Get it

On a Mac with Apple silicon or Intel:

```sh
git clone https://github.com/GitJarno/Stemcells.git
cd Stemcells
stemcells/scripts/install-app
```

The script checks what it needs first (Xcode Command Line Tools, Node.js
24, pnpm, Rust, about 5 GB free) and says how to get anything missing. Then
it builds the app on your Mac and installs it as `/Applications/Stemcells.app`.
You'll also want at least one coding CLI signed in, such as Claude Code or
Codex.

[stemcells/docs/install.md](../stemcells/docs/install.md) has the details,
and doubles as instructions for a coding agent: point yours at it.

Stemcells keeps its own state in `~/.stemcells` and never touches T3 Code's,
so the two can live side by side.

## Stemcells gets better

Once installed, Stemcells updates itself from this repository. When there's
something new, the left column says **Stemcells gets better**, with what
changed; **Update** builds it while you keep working, then restarts into it
once no Cell is mid-turn. Settings › About › Update track picks **Stable**
(tagged releases) or **Nightly** (everything merged to `main`).

From a terminal, `stemcells/scripts/install-app --pull` does the same.

## Built on T3 Code

Stemcells is a fork of [T3 Code](https://github.com/pingdotgg/t3code) by
T3 Tools, which supplies the engine: providers, threads, the server and
remote access. Stemcells keeps taking upstream's work as it lands and keeps
its own layer apart, so the two stay easy to merge.
[stemcells/docs/fork.md](../stemcells/docs/fork.md) explains how, and
[README.md](../README.md) is T3 Code's own readme. Stemcells is not
affiliated with or endorsed by T3 Tools.

## Contributing

Stemcells is built mostly by coding agents, in the open. Agents and people
alike start with [stemcells/AGENTS.md](../stemcells/AGENTS.md);
[CONTRIBUTING.md](CONTRIBUTING.md) says how a change lands, and
[SECURITY.md](SECURITY.md) how to report a vulnerability privately.

## License

[MIT](../LICENSE), as upstream ships it.
