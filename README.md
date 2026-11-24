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
  Stemcells makes it fun and effective to work with your agents.<br>
  An open-source app for Claude Code, Codex and the other coding agents you use, on your Mac and your phone.<br>
  <a href="https://stemcells.sh">stemcells.sh</a> · <a href="#get-it">Get it</a> · <a href="#how-it-works">How it works</a>
</p>

---

You type a sentence, and an agent makes the thing it describes: an app, a
fix, a page, a feature. The code isn't the hard part anymore. What runs out
is you: your attention, the tabs you keep checking, the walls of text you
skim for the one line that matters.

Stemcells is the shortest way from a thought to the thing. It takes the
shape of your work and gets out of the way.

## How it works

Every chat is a **Cell**: one agent, one job, with a small creature of its
own that shows what it's doing. **Aski** is the one you talk to about all of
them: it starts Cells, reads them and tells you where things stand.

### Thrown until it lands

An ask is a throw. It flies toward its goal and lands, or it falls short
and asks you one clear question. Your answer is the next throw.

```
                     . · ˙ ˙ · .
                 . ˙      Flying   ˙ .
              . ˙                      ˙ .
   your     ˙                             ˙        the
   words  █                  Input         █      thing
  ─────────────────────────── ? ───────────────────────
           throw      falls short, asks,      Landed
                        flies again
```

| Stage       | Means                                 | You                 |
| ----------- | ------------------------------------- | ------------------- |
| **Input**   | It fell short and waits for your word | Answer; it flies    |
| **Flying**  | In the air, on its way                | Nothing. Hands free |
| **Landed**  | It stuck the landing                  | Read it             |
| **Settled** | Put away by you                       | Nothing, ever again |

Landing is the agent's finish. Settling is yours: a click on the Mac, a
swipe on the phone. A settled Cell is put away, not deleted; write to it and
it flies again.

### Shown, not told

Agents answer in walls of text. People read pictures faster. Stemcells
teaches every agent to pick the form you read fastest, and draws it:

| What it has to say  | The form                                     |
| ------------------- | -------------------------------------------- |
| Numbers to compare  | A chart                                      |
| A flow or structure | A diagram                                    |
| A choice to make    | One question, with a preview of each option  |
| Where it stands     | One closing line: what is done, what is left |

### It becomes what you need

A stem cell is plain until something is asked of it. A Cell is the same: it
grows the longer it flies on its own (nubs after ten minutes, arms after
thirty, biceps after two hours). So is the app: one chat or twelve, tabs,
panes and windows, ⌘T for a new Cell and ⌘D to put one beside.

### One crew, on every machine you own

Throw from your phone; it flies on the Mac in the closet. When a Cell asks,
every screen knows, and you answer from whichever is closest. Your phone and
your other computers reach each other over your own Tailscale network (the
iPhone app builds from this repository too).

### Bring your own agents

Cells run on the coding CLIs you already use, Claude Code, Codex, Cursor,
OpenCode and more, signed in with your own accounts on your own machine.
Stemcells adds no cloud of its own and sends nothing about you anywhere: no
telemetry, no analytics, no crash reports.

How Stemcells talks, looks and moves is written down in
[the brand book](stemcells/brand/book.md).

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

[stemcells/docs/install.md](stemcells/docs/install.md) has the details,
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

## Contributing

Stemcells is built mostly by coding agents, in the open. Agents and people
alike start with [stemcells/AGENTS.md](stemcells/AGENTS.md);
[CONTRIBUTING.md](.github/CONTRIBUTING.md) says how a change lands, and
[SECURITY.md](.github/SECURITY.md) how to report a vulnerability privately.

## License

[MIT](LICENSE), as upstream ships it.

---

<sub>Stemcells is an unofficial fork based on the
[T3 Code](https://github.com/pingdotgg/t3code) source code by T3 Tools, and
keeps taking its work as it lands ([how](stemcells/docs/fork.md)). Not
affiliated with, endorsed by or maintained by T3 Tools.</sub>
